'use strict';

// 完整回溯需要二维表；本教学模块给出明确资源上限，避免浏览器意外耗尽内存。
const MAX_ALIGNMENT_CELLS = 4_000_000;

function requireString(value, name) {
    if (typeof value !== 'string') {
        throw new TypeError(`${name} 必须是字符串`);
    }
}

function requireObject(value, name) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${name} 必须是对象`);
    }
}

function buildTable(truthTokens, predictionTokens) {
    const rows = truthTokens.length + 1;
    const columns = predictionTokens.length + 1;
    if (rows * columns > MAX_ALIGNMENT_CELLS) {
        throw new RangeError(`对齐表不能超过 ${MAX_ALIGNMENT_CELLS} 个单元格`);
    }
    const table = Array.from({ length: rows }, () => new Uint32Array(columns));
    for (let i = 0; i < rows; i++) {
        table[i][0] = i;
    }
    for (let j = 0; j < columns; j++) {
        table[0][j] = j;
    }
    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < columns; j++) {
            const cost = truthTokens[i - 1] === predictionTokens[j - 1] ? 0 : 1;
            table[i][j] = Math.min(
                table[i - 1][j - 1] + cost,
                table[i - 1][j] + 1,
                table[i][j - 1] + 1
            );
        }
    }
    return table;
}

function alignTokens(truthTokens, predictionTokens) {
    const table = buildTable(truthTokens, predictionTokens);
    let i = truthTokens.length;
    let j = predictionTokens.length;
    const result = {
        distance: table[i][j], substitutions: 0, deletions: 0, insertions: 0, alignment: []
    };
    while (i > 0 || j > 0) {
        // 固定优先级：匹配 M → 替换 S → 删除 D → 插入 I。
        // 从右下角回溯，因此重复字符的缺口位置也由这条规则唯一确定。
        if (i > 0 && j > 0 && table[i][j] === table[i - 1][j - 1]
            + (truthTokens[i - 1] === predictionTokens[j - 1] ? 0 : 1)) {
            const operation = truthTokens[i - 1] === predictionTokens[j - 1] ? 'M' : 'S';
            if (operation === 'S') {
                result.substitutions++;
            }
            result.alignment.push({
                operation, truth: truthTokens[i - 1], prediction: predictionTokens[j - 1],
                truthIndex: i - 1, predictionIndex: j - 1
            });
            i--;
            j--;
        } else if (i > 0 && table[i][j] === table[i - 1][j] + 1) {
            result.deletions++;
            result.alignment.push({
                operation: 'D', truth: truthTokens[i - 1], prediction: null,
                truthIndex: i - 1, predictionIndex: null
            });
            i--;
        } else {
            result.insertions++;
            result.alignment.push({
                operation: 'I', truth: null, prediction: predictionTokens[j - 1],
                truthIndex: null, predictionIndex: j - 1
            });
            j--;
        }
    }
    result.alignment.reverse();
    return result;
}

/** Unicode 码点级单位代价 Levenshtein 对齐；方向为真值 → 预测。 */
function alignSequences(truth, prediction) {
    requireString(truth, 'truth');
    requireString(prediction, 'prediction');
    return alignTokens(Array.from(truth), Array.from(prediction));
}

/** 为教学页面提供与对齐算法一致的表；不在页面重新实现动态规划。 */
function getEditDistanceTable(truth, prediction) {
    requireString(truth, 'truth');
    requireString(prediction, 'prediction');
    const truthCharacters = Array.from(truth);
    const predictionCharacters = Array.from(prediction);
    return {
        truthCharacters, predictionCharacters,
        matrix: buildTable(truthCharacters, predictionCharacters).map(row => Array.from(row))
    };
}

/**
 * 数字串端到端评估。无 DOM、无推理、无纠错，不修改输入记录。
 * 排除优先于待标注；失败状态不构成排除依据。
 */
function evaluatePredictions(records) {
    if (!Array.isArray(records)) {
        throw new TypeError('records 必须是数组');
    }
    const report = {
        totalSamples: records.length, evaluatedSamples: 0, pendingSamples: 0,
        excludedSamples: 0, failedSamples: 0, totalTruthCharacters: 0,
        substitutions: 0, deletions: 0, insertions: 0, totalErrors: 0,
        microCER: null, exactMatches: 0, exactMatchAccuracy: null, records: []
    };
    // 使用 for-of，使稀疏数组中的缺失记录也被明确拒绝。
    for (const [index, record] of records.entries()) {
        requireObject(record, `records[${index}]`);
        const truth = record.truth == null ? '' : record.truth;
        const prediction = record.prediction == null ? '' : record.prediction;
        const status = record.status === undefined ? 'ok' : record.status;
        const exclusionReason = record.exclusionReason == null ? '' : record.exclusionReason;
        requireString(truth, `records[${index}].truth`);
        requireString(prediction, `records[${index}].prediction`);
        requireString(status, `records[${index}].status`);
        requireString(exclusionReason, `records[${index}].exclusionReason`);
        if (truth !== '' && !/^[0-9]+$/.test(truth)) {
            throw new TypeError(`records[${index}].truth 必须是非空 0–9 字符串或待标注空值`);
        }
        const id = record.id == null ? `sample-${index + 1}` : record.id;
        if (typeof id !== 'string' && !(typeof id === 'number' && Number.isFinite(id))) {
            throw new TypeError(`records[${index}].id 必须是字符串或有限数值`);
        }
        // 排除优先，其次缺标签；模型失败不能进入这两个分支。
        let disposition = 'evaluated';
        if (exclusionReason.trim() !== '') {
            disposition = 'excluded';
        } else if (truth === '') {
            disposition = 'pending';
        }
        const included = disposition === 'evaluated';
        const failed = prediction === '' || ['failed', 'error', 'rejected'].includes(status.toLowerCase());
        const comparison = included ? alignSequences(truth, prediction) : null;
        const row = {
            ...record, id, truth, prediction, status, exclusionReason,
            rawPrediction: record.prediction == null ? null : record.prediction,
            disposition, included, failed, truthLength: truth.length,
            distance: comparison ? comparison.distance : null,
            substitutions: comparison ? comparison.substitutions : null,
            deletions: comparison ? comparison.deletions : null,
            insertions: comparison ? comparison.insertions : null,
            cer: comparison ? comparison.distance / truth.length : null,
            exactMatch: included ? truth === prediction : null,
            alignment: comparison ? comparison.alignment : null
        };
        report.records.push(row);
        if (disposition === 'excluded') {
            report.excludedSamples++;
            continue;
        }
        if (disposition === 'pending') {
            report.pendingSamples++;
            continue;
        }
        report.evaluatedSamples++;
        if (failed) {
            report.failedSamples++;
        }
        report.totalTruthCharacters += truth.length;
        report.substitutions += comparison.substitutions;
        report.deletions += comparison.deletions;
        report.insertions += comparison.insertions;
        if (row.exactMatch) {
            report.exactMatches++;
        }
    }
    report.totalErrors = report.substitutions + report.deletions + report.insertions;
    if (report.totalTruthCharacters > 0) {
        report.microCER = report.totalErrors / report.totalTruthCharacters;
    }
    if (report.evaluatedSamples > 0) {
        report.exactMatchAccuracy = report.exactMatches / report.evaluatedSamples;
    }
    return report;
}

function splitWords(text) {
    requireString(text, 'text');
    return text.trim() === '' ? [] : text.trim().split(/\s+/u);
}

/** 教学 WER：按空白切词、区分大小写、不移除标点；不用于任意数字串评分。 */
function wordErrorRate(truth, prediction) {
    const truthWords = splitWords(truth);
    const predictionWords = splitWords(prediction);
    const comparison = alignTokens(truthWords, predictionWords);
    return {
        ...comparison, truthWords, predictionWords,
        wer: truthWords.length === 0 ? null : comparison.distance / truthWords.length
    };
}

/** 教学拒识策略：最低字符得分不足阈值时整串输出空串，保留原始串供复核。 */
function filterByConfidence(prediction, scores, threshold = 0.7) {
    requireString(prediction, 'prediction');
    if (!Array.isArray(scores) || scores.length !== Array.from(prediction).length
        || Array.from(scores).some(score => !Number.isFinite(score) || score < 0 || score > 1)) {
        throw new TypeError('scores 须与预测码点数相同，且每项为 [0, 1] 内的有限数值');
    }
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        throw new RangeError('threshold 必须属于 [0, 1]');
    }
    let minimumConfidence = null;
    for (const score of scores) {
        if (minimumConfidence === null || score < minimumConfidence) {
            minimumConfidence = score;
        }
    }
    const rejected = minimumConfidence === null || minimumConfidence < threshold;
    return {
        originalPrediction: prediction, prediction: rejected ? '' : prediction,
        minimumConfidence, threshold, rejected,
        status: prediction === '' ? 'failed' : rejected ? 'rejected' : 'ok'
    };
}

/** 词级 bigram + add-alpha 平滑。只用于有限语料的课堂实验。 */
function createBigramModel(sentences, options = {}) {
    if (!Array.isArray(sentences) || sentences.length === 0) {
        throw new TypeError('sentences 必须是非空字符串数组');
    }
    requireObject(options, 'options');
    const { alpha = 1 } = options;
    if (!Number.isFinite(alpha) || alpha <= 0) {
        throw new RangeError('alpha 必须为有限正数');
    }
    const vocabulary = new Set(['</s>', '<unk>']);
    const sequences = Array.from(sentences, sentence => {
        const words = splitWords(sentence);
        if (words.length === 0 || words.some(word => ['<s>', '</s>', '<unk>'].includes(word))) {
            throw new TypeError('训练句子不能为空或包含保留的边界/未知词标记');
        }
        for (const word of words) {
            vocabulary.add(word);
        }
        return ['<s>', ...words, '</s>'];
    });
    const counts = new Map();
    const totals = new Map();
    for (const sequence of sequences) {
        for (let i = 1; i < sequence.length; i++) {
            const previous = sequence[i - 1];
            const word = sequence[i];
            if (!counts.has(previous)) {
                counts.set(previous, new Map());
            }
            const row = counts.get(previous);
            row.set(word, (row.get(word) || 0) + 1);
            totals.set(previous, (totals.get(previous) || 0) + 1);
        }
    }
    // 暴露公式各项，让页面和Node展示实际计数，不另外伪造教学中间值。
    const inspectTransition = (previous, word) => {
        requireString(previous, 'previous');
        requireString(word, 'word');
        if (word === '<s>') {
            throw new TypeError('<s> 只能作为历史，不能作为预测词');
        }
        const previousToken = previous === '<s>' || vocabulary.has(previous) ? previous : '<unk>';
        const token = vocabulary.has(word) ? word : '<unk>';
        const count = counts.get(previousToken)?.get(token) || 0;
        const historyCount = totals.get(previousToken) || 0;
        const numerator = count + alpha;
        const denominator = historyCount + alpha * vocabulary.size;
        const probability = numerator / denominator;
        if (!Number.isFinite(probability) || probability <= 0) {
            throw new RangeError('alpha超出当前浮点计数可稳定计算的范围');
        }
        return {
            previous, word, previousToken, token, count, historyCount,
            vocabularySize: vocabulary.size, alpha, numerator, denominator, probability
        };
    };
    const probability = (previous, word) => inspectTransition(previous, word).probability;
    return Object.freeze({
        vocabulary: Object.freeze(Array.from(vocabulary).sort()), alpha, probability, inspectTransition,
        logProbability(text) {
            const tokens = ['<s>', ...splitWords(text), '</s>'];
            let logProbability = 0;
            for (let i = 1; i < tokens.length; i++) {
                logProbability += Math.log(probability(tokens[i - 1], tokens[i]));
            }
            return logProbability;
        }
    });
}

/** 编辑距离生成候选，再以左侧一个词的语言概率排序；不接入数字识别。 */
function suggestCorrection(observed, dictionary, options = {}) {
    requireString(observed, 'observed');
    requireObject(options, 'options');
    if (!Array.isArray(dictionary) || dictionary.length === 0
        || Array.from(dictionary).some(word => typeof word !== 'string' || !word || /\s/u.test(word))) {
        throw new TypeError('dictionary 必须是非空的单词字符串数组');
    }
    const { model = null, previousToken = '<s>', editWeight = 1, languageWeight = 1, maxDistance = 2 } = options;
    requireString(previousToken, 'previousToken');
    if (![editWeight, languageWeight].every(value => Number.isFinite(value) && value >= 0)
        || !Number.isInteger(maxDistance) || maxDistance < 0) {
        throw new RangeError('权重须为有限非负数，maxDistance 须为非负整数');
    }
    if (model !== null && typeof model.probability !== 'function') {
        throw new TypeError('model 必须提供 probability 方法');
    }
    const unchanged = reason => ({ original: observed, suggestion: observed, changed: false, reason, candidates: [] });
    if (/^[0-9]+$/.test(observed)) {
        return unchanged('numeric-string-preserved');
    }
    if (observed === '' || /\s/u.test(observed)) {
        return unchanged('single-token-only');
    }
    if (dictionary.includes(observed)) {
        return unchanged('in-dictionary');
    }
    const candidates = [];
    for (const word of new Set(dictionary)) {
        const distance = alignSequences(word, observed).distance;
        if (distance > maxDistance) {
            continue;
        }
        const languageProbability = model ? model.probability(previousToken, word) : null;
        if (model && (!Number.isFinite(languageProbability) || languageProbability <= 0 || languageProbability > 1)) {
            throw new RangeError('语言概率必须属于 (0, 1]');
        }
        candidates.push({
            word, distance, languageProbability,
            score: -editWeight * distance + (model ? languageWeight * Math.log(languageProbability) : 0)
        });
    }
    candidates.sort((a, b) => {
        if (a.score !== b.score) {
            return b.score - a.score;
        }
        if (a.distance !== b.distance) {
            return a.distance - b.distance;
        }
        return a.word < b.word ? -1 : a.word > b.word ? 1 : 0;
    });
    if (candidates.length === 0) {
        return unchanged('no-candidate');
    }
    return { original: observed, suggestion: candidates[0].word, changed: true, reason: 'toy-dictionary-suggestion', candidates };
}

module.exports = {
    alignSequences, evaluatePredictions, getEditDistanceTable,
    wordErrorRate, createBigramModel, suggestCorrection, filterByConfidence
};
