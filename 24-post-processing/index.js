'use strict';

/**
 * 第24章教学实验：node 24-post-processing/index.js
 * 对标05章“核→运算→对照”和11章“输入→中间向量→距离”的展开方式。
 * 输入固定、无训练；内置自检失败抛出异常，进程以非0状态退出。
 */
const assert = require('node:assert/strict');
const {
    alignSequences, evaluatePredictions, getEditDistanceTable,
    wordErrorRate, createBigramModel, suggestCorrection, filterByConfidence
} = require('../shared/24-post-processing');

const CORPUS = ['read the book', 'read the book', 'read the back', 'read a book'];

function heading(number, title) {
    console.log(`\n【实验${number}：${title}】`);
}

function printAlignment(truth, prediction) {
    const result = alignSequences(truth, prediction);
    console.log(`${JSON.stringify(truth)} → ${JSON.stringify(prediction)}；距离=${result.distance}，S/D/I=${result.substitutions}/${result.deletions}/${result.insertions}`);
    console.table(result.alignment);
    return result;
}

function experimentMatrix() {
    heading(1, '从前缀、三种候选到完整回溯');
    const truth = '1203';
    const prediction = '123';
    const { matrix } = getEditDistanceTable(truth, prediction);
    console.log(`真值=${truth} (m=4)，预测=${prediction} (n=3)；表尺寸=${matrix.length}×${matrix[0].length}`);
    console.log('第一行是空真值的插入成本，第一列是空预测的删除成本。');
    console.table(matrix);
    // 读取已有矩阵，解释一个格的三个候选，不重写递推算法。
    const i = 3;
    const j = 2;
    const cost = truth[i - 1] === prediction[j - 1] ? 0 : 1;
    console.log('单格d[3,2]：120 → 12，当前字符0与2不同：');
    console.table([
        { operation: 'S', predecessor: 'd[2,1]', previous: matrix[i - 1][j - 1], cost, candidate: matrix[i - 1][j - 1] + cost },
        { operation: 'D', predecessor: 'd[2,2]', previous: matrix[i - 1][j], cost: 1, candidate: matrix[i - 1][j] + 1 },
        { operation: 'I', predecessor: 'd[3,1]', previous: matrix[i][j - 1], cost: 1, candidate: matrix[i][j - 1] + 1 }
    ]);
    console.log('三候选2/1/3，取删除成本1；最后3匹配使d[4,3]=1。');
    const result = printAlignment(truth, prediction);
    assert.equal(matrix[3][2], 1);
    assert.equal(result.deletions, 1);
    assert.equal(result.distance, 1);
    console.log('自检通过：手算单格、完整距离和删除计数一致。');
}

function experimentTieAndBoundaries() {
    heading(2, '固定平局、前导零、重复、空预测与300%');
    const tied = printAlignment('12', '21');
    console.log('另一条等成本路径：∅12 → 21∅，I+M+D成本也是2；本模块固定选择S+S。');
    assert.deepEqual(tied.alignment.map(column => column.operation), ['S', 'S']);
    const repeated = printAlignment('00110', '0110');
    assert.equal(repeated.alignment[0].truthIndex, 0);
    assert.equal(repeated.alignment[0].operation, 'D');
    console.log('从右向左优先匹配，固定把第一个0记为删除；仅此不能定位照片根因。');
    printAlignment('1', '1111');
    printAlignment('305', '');
    const overOne = evaluatePredictions([{ truth: '1', prediction: '1111' }]);
    console.log(`CER=${overOne.totalErrors}/${overOne.totalTruthCharacters}=${overOne.microCER * 100}%，不截断。`);
    assert.equal(overOne.microCER, 3);
    assert.equal(alignSequences('00110', '00110').distance, 0);
    console.log('自检通过：前导零和重复保留，CER可以超过1。');
}

function experimentEvaluation() {
    heading(3, '逐图记录、micro聚合与分母审计');
    const records = [
        { id: 'exact', truth: '12', prediction: '12', modelId: 'teaching-fixture' },
        { id: 'deletion', truth: '1203', prediction: '123' },
        { id: 'failed', truth: '305', prediction: '', status: 'failed', failureReason: '未找到数字' },
        { id: 'pending', prediction: '09' },
        { id: 'excluded', truth: '7', prediction: '', status: 'error', exclusionReason: '损坏的图片' }
    ];
    console.table(records);
    const report = evaluatePredictions(records);
    console.table(report.records.map(row => ({
        id: row.id, truth: row.truth, prediction: row.prediction, disposition: row.disposition,
        S: row.substitutions, D: row.deletions, I: row.insertions, N: row.truthLength, cer: row.cer
    })));
    console.log(`microCER=${report.totalErrors}/${report.totalTruthCharacters}=${report.microCER}`);
    console.log(`整串正确率=${report.exactMatches}/${report.evaluatedSamples}=${report.exactMatchAccuracy}`);
    console.log(`总数${report.totalSamples}=纳入${report.evaluatedSamples}+待标注${report.pendingSamples}+排除${report.excludedSamples}；纳入失败${report.failedSamples}`);
    const pair = evaluatePredictions(records.slice(0, 2));
    const macroCER = pair.records.reduce((sum, row) => sum + row.cer, 0) / pair.evaluatedSamples;
    console.table([
        { metric: '前两图microCER', numerator: 1, denominator: 6, value: pair.microCER },
        { metric: '前两图CER平均', numerator: 0 + 1 / 4, denominator: 2, value: macroCER },
        { metric: '前两图整串正确率', numerator: 1, denominator: 2, value: pair.exactMatchAccuracy }
    ]);
    assert.equal(report.microCER, 4 / 9);
    assert.equal(report.exactMatchAccuracy, 1 / 3);
    assert.equal(report.failedSamples, 1);
    assert.equal(pair.microCER, 1 / 6);
    assert.equal(macroCER, 1 / 8);
    console.log('自检通过：统计单位不同导致比率不同，失败不从分母消失。');
    return report;
}

function experimentWordUnits() {
    heading(4, '字符与词的计数单位对照');
    for (const [truth, prediction] of [['read the book', 'read book'], ['00110', '0110']]) {
        const words = wordErrorRate(truth, prediction);
        const characters = alignSequences(truth, prediction);
        console.log(`真值=${JSON.stringify(truth)}，预测=${JSON.stringify(prediction)}`);
        console.log('切词结果：', words.truthWords, '→', words.predictionWords);
        console.table(words.alignment);
        console.log(`WER=${words.distance}/${words.truthWords.length}=${words.wer}；码点CER=${characters.distance}/${Array.from(truth).length}`);
    }
    assert.equal(wordErrorRate('read the book', 'read book').wer, 1 / 3);
    assert.equal(wordErrorRate('00110', '0110').wer, 1);
    console.log('自检通过：无空格数字串被当一个词，WER不能解释具体漏了几位。');
}

function experimentBigram() {
    heading(5, 'Bigram计数→平滑→概率→整句对数概率');
    console.table(CORPUS.map((sentence, index) => ({ sentence: index + 1, tokens: `<s> ${sentence} </s>` })));
    const model = createBigramModel(CORPUS);
    console.log(`后继词表V=${model.vocabulary.length}：`, model.vocabulary);
    console.table(model.vocabulary.map(word => model.inspectTransition('the', word)));
    const sum = model.vocabulary.reduce((total, word) => total + model.probability('the', word), 0);
    console.log('历史the的整行概率和=', sum);
    const smoothing = [];
    for (const alpha of [0.1, 1, 3]) {
        const current = createBigramModel(CORPUS, { alpha });
        smoothing.push({ alpha, book: current.probability('the', 'book'), back: current.probability('the', 'back'), unknown: current.probability('the', 'never-seen') });
    }
    console.log('alpha增大压平计数差异，未见词获得更多概率质量：');
    console.table(smoothing);
    const transitions = [['<s>', 'read'], ['read', 'the'], ['the', 'book'], ['book', '</s>']];
    console.table(transitions.map(([previous, word]) => ({
        previous, word, probability: model.probability(previous, word), logProbability: Math.log(model.probability(previous, word))
    })));
    console.log('整句logProbability=', model.logProbability('read the book'));
    assert.ok(Math.abs(sum - 1) < 1e-12);
    assert.equal(model.probability('the', 'book'), 0.3);
    assert.equal(model.probability('the', 'back'), 0.2);
    console.log('自检通过：2次book与1次back经add-one得到3/10与2/10。');
    return model;
}

function experimentDictionary(model) {
    heading(6, '候选距离、语言权重与错误改写风险');
    const dictionary = ['back', 'book'];
    console.log('观测词bock，词典=', dictionary);
    for (const languageWeight of [0, 1, 3]) {
        const result = suggestCorrection('bock', dictionary, { model, previousToken: 'the', languageWeight });
        console.log(`lambda=${languageWeight}；建议=${result.suggestion}`);
        console.table(result.candidates);
    }
    console.log('maxDistance=0：', suggestCorrection('bock', dictionary, { maxDistance: 0 }).reason);
    console.log('数字保护：', suggestCorrection('00110', ['110']));
    console.log('若bock原本就是正确词，改为book会制造错误；本实验没有图像证据、右侧上下文或真实混淆概率。');
    assert.equal(suggestCorrection('bock', dictionary).suggestion, 'back');
    assert.equal(suggestCorrection('bock', dictionary, { model, previousToken: 'the' }).suggestion, 'book');
    assert.equal(suggestCorrection('00110', ['110']).suggestion, '00110');
    console.log('自检通过：参数改变排序，不证明候选是真值；数字不被改写。');
}

function experimentConfidence() {
    heading(7, '拒识阈值、覆盖率与原始/最终结果对照');
    const scored = [
        { id: 'A', truth: '12', prediction: '12', scores: [0.95, 0.9] },
        { id: 'B', truth: '305', prediction: '308', scores: [0.9, 0.9, 0.55] }
    ];
    console.table(scored);
    const comparison = [];
    for (const threshold of [0, 0.55, 0.8, 0.91]) {
        const filtered = scored.map(row => ({ ...row, ...filterByConfidence(row.prediction, row.scores, threshold) }));
        const all = evaluatePredictions(filtered);
        const accepted = evaluatePredictions(filtered.filter(row => !row.rejected));
        comparison.push({
            threshold, predictions: JSON.stringify(filtered.map(row => row.prediction)),
            coverage: accepted.evaluatedSamples / all.evaluatedSamples,
            acceptedAccuracy: accepted.exactMatchAccuracy,
            fullCER: all.microCER, fullExactAccuracy: all.exactMatchAccuracy, denominator: all.evaluatedSamples
        });
    }
    console.table(comparison);
    assert.equal(comparison[2].fullCER, 0.6);
    assert.equal(comparison[2].fullExactAccuracy, 0.5);
    assert.equal(comparison[3].acceptedAccuracy, null);
    assert.equal(comparison[3].denominator, 2);
    console.log('自检通过：阈值0.8覆盖1/2，完整CER从0.2升到0.6；0.91全拒识仍有2张分母。');
}

function experimentInvalidInputs() {
    heading(8, '空值与无效输入的可见处理');
    for (const records of [[], [{ prediction: '09' }], [{ exclusionReason: '损坏文件' }]]) {
        const result = evaluatePredictions(records);
        console.log('输入=', JSON.stringify(records), '，CER=', result.microCER, '，整串正确率=', result.exactMatchAccuracy);
        assert.equal(result.microCER, null);
    }
    console.log('通用空串对齐=', alignSequences('', ''), '；数字评估中空真值表示待标注。');
    const invalidCases = [
        { name: '真值数值110', run: () => evaluatePredictions([{ truth: 110, prediction: '00110' }]) },
        { name: '真值含前置空格', run: () => evaluatePredictions([{ truth: ' 12', prediction: '12' }]) },
        { name: '得分维度不足', run: () => filterByConfidence('001', [0.9], 0.8) }
    ];
    for (const example of invalidCases) {
        let error = null;
        try {
            example.run();
        } catch (caught) {
            error = caught;
        }
        assert.ok(error instanceof TypeError, `${example.name}应明确拒绝`);
        console.log(`${example.name} → ${error.message}`);
    }
    console.log('自检通过：没有把无标签当0%错误，没有隐式转数值或清理非法字符。');
}

function runDemo() {
    console.log('第24章：后处理与独立评估；固定教学输入，不是照片识别成绩。');
    experimentMatrix();
    experimentTieAndBoundaries();
    const report = experimentEvaluation();
    experimentWordUnits();
    const model = experimentBigram();
    experimentDictionary(model);
    experimentConfidence();
    experimentInvalidInputs();
    console.log('\n八组实验及全部内置自检通过。下一章将原始预测交给独立评估，不传答案给识别器。');
    return report;
}

if (require.main === module) {
    runDemo();
}
module.exports = {
    runDemo, experimentMatrix, experimentTieAndBoundaries, experimentEvaluation,
    experimentWordUnits, experimentBigram, experimentDictionary, experimentConfidence, experimentInvalidInputs
};
