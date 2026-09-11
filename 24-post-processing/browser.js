'use strict';

const {
    alignSequences, evaluatePredictions, getEditDistanceTable,
    wordErrorRate, createBigramModel, suggestCorrection, filterByConfidence
} = require('../shared/24-post-processing');

const byId = id => document.getElementById(id);
const formatRatio = ratio => ratio === null ? '—（无分母）' : `${(ratio * 100).toFixed(2)}%`;
const showCharacter = character => character === null ? '∅' : character === ' ' ? '␠' : character === '\n' ? '↵' : character;
const operationLabels = { M: '匹配', S: '替换', D: '删除', I: '插入' };
let currentAlignment = null;
let currentTable = null;
let tableCells = new Map();
let pathCoordinates = [];
let lastReport = null;

function cell(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
}

function makeTable(container, headers, rows, captionText) {
    const table = document.createElement('table');
    if (captionText) table.append(cell('caption', captionText));
    const head = document.createElement('thead');
    const heading = document.createElement('tr');
    for (const header of headers) {
        const th = cell('th', header);
        th.scope = 'col';
        heading.append(th);
    }
    head.append(heading);
    table.append(head);
    const body = document.createElement('tbody');
    for (const values of rows) {
        const row = document.createElement('tr');
        for (const value of values) row.append(cell('td', value));
        body.append(row);
    }
    table.append(body);
    container.replaceChildren(table);
    return table;
}

function renderStep() {
    if (!currentAlignment) return;
    const step = Number(byId('alignment-step').value);
    byId('step-value').textContent = `${step} / ${currentAlignment.alignment.length}`;
    for (const element of tableCells.values()) element.classList.remove('path-active');
    for (let k = 0; k <= step; k++) tableCells.get(pathCoordinates[k])?.classList.add('path-active');
    const columns = Array.from(byId('alignment-columns').children);
    columns.forEach((column, index) => column.classList.toggle('column-active', index < step));
    if (step === 0) {
        byId('step-description').textContent = '从空前缀 (0,0) 开始。此处按阅读方向播放已确定的最优对齐；算法实际从右下角回溯。';
        byId('step-costs').replaceChildren();
        return;
    }
    const selected = currentAlignment.alignment[step - 1];
    const explanation = {
        M: '真值与预测相同，沿对角线移动，成本 +0。',
        S: '真值被识别成另一个字符，沿对角线移动，成本 +1。',
        D: '真值字符没有对应预测，只消耗真值，沿行向下，成本 +1。',
        I: '预测多出字符，只消耗预测，沿列向右，成本 +1。'
    };
    byId('step-description').textContent = `第${step}列：${selected.operation} ${operationLabels[selected.operation]}，${showCharacter(selected.truth)} → ${showCharacter(selected.prediction)}。${explanation[selected.operation]}`;
    // 只读取共享算法已完成的表，展示当前格三种前驱成本，不另写DP。
    const [i, j] = pathCoordinates[step].split(',').map(Number);
    const { matrix, truthCharacters, predictionCharacters } = currentTable;
    const candidates = [];
    if (i > 0 && j > 0) {
        const cost = truthCharacters[i - 1] === predictionCharacters[j - 1] ? 0 : 1;
        candidates.push([cost === 0 ? 'M 匹配' : 'S 替换', `d[${i - 1},${j - 1}]`, matrix[i - 1][j - 1], cost, matrix[i - 1][j - 1] + cost]);
    }
    if (i > 0) {
        candidates.push(['D 删除', `d[${i - 1},${j}]`, matrix[i - 1][j], 1, matrix[i - 1][j] + 1]);
    }
    if (j > 0) {
        candidates.push(['I 插入', `d[${i},${j - 1}]`, matrix[i][j - 1], 1, matrix[i][j - 1] + 1]);
    }
    makeTable(byId('step-costs'), ['候选操作', '前驱', '前驱值', '新增成本', '候选值', '是否最优'], candidates.map(row => [
        ...row, row[4] === matrix[i][j] ? '是（若平局按固定优先级）' : '否'
    ]), `当前格 d[${i},${j}]=${matrix[i][j]}：边界处不可用的前驱不列出。`);
}

function renderAlignment() {
    byId('alignment-error').textContent = '';
    try {
        const truth = byId('truth').value;
        const prediction = byId('prediction').value;
        if (Array.from(truth).length > 60 || Array.from(prediction).length > 60) throw new Error('为了看清矩阵，本页对齐输入限制为60个码点；共享模块支持更大的表。');
        const result = alignSequences(truth, prediction);
        const table = getEditDistanceTable(truth, prediction);
        currentAlignment = result;
        currentTable = table;
        byId('alignment-summary').textContent = `距离 ${result.distance} = S ${result.substitutions} + D ${result.deletions} + I ${result.insertions}；本对齐 CER ${formatRatio(truth === '' ? null : result.distance / Array.from(truth).length)}。`;
        byId('alignment-columns').replaceChildren();
        pathCoordinates = ['0,0'];
        let i = 0;
        let j = 0;
        for (const column of result.alignment) {
            const element = document.createElement('div');
            element.className = `alignment-column op-${column.operation}`;
            element.append(cell('span', showCharacter(column.truth)), cell('span', showCharacter(column.prediction)), cell('small', `${column.operation} ${operationLabels[column.operation]}`));
            element.setAttribute('aria-label', `真值 ${showCharacter(column.truth)}，预测 ${showCharacter(column.prediction)}，${operationLabels[column.operation]}`);
            byId('alignment-columns').append(element);
            if (column.truth !== null) i++;
            if (column.prediction !== null) j++;
            pathCoordinates.push(`${i},${j}`);
        }
        if (result.alignment.length === 0) byId('alignment-columns').append(cell('p', '两串均为空：没有对齐列，距离为0，CER无分母。'));
        const matrix = document.createElement('table');
        matrix.className = 'dp-table';
        matrix.append(cell('caption', `${table.matrix.length} × ${table.matrix[0].length}：行是真值前缀，列是预测前缀；绿色格为已播放路径。`));
        const head = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const label of ['真值↓ / 预测→', '∅', ...table.predictionCharacters.map(showCharacter)]) {
            const th = cell('th', label); th.scope = 'col'; headRow.append(th);
        }
        head.append(headRow); matrix.append(head);
        const body = document.createElement('tbody');
        tableCells = new Map();
        table.matrix.forEach((values, rowIndex) => {
            const row = document.createElement('tr');
            const label = cell('th', rowIndex === 0 ? '∅' : showCharacter(table.truthCharacters[rowIndex - 1]));
            label.scope = 'row'; row.append(label);
            values.forEach((value, columnIndex) => {
                const td = cell('td', value);
                td.title = `d[${rowIndex},${columnIndex}]=${value}`;
                tableCells.set(`${rowIndex},${columnIndex}`, td);
                row.append(td);
            });
            body.append(row);
        });
        matrix.append(body); byId('distance-table').replaceChildren(matrix);
        byId('alignment-step').max = result.alignment.length;
        byId('alignment-step').value = result.alignment.length;
        renderStep();
    } catch (error) {
        currentAlignment = null;
        currentTable = null;
        byId('alignment-error').textContent = error.message;
        byId('alignment-summary').textContent = '';
        byId('alignment-columns').replaceChildren();
        byId('distance-table').replaceChildren();
        byId('step-description').textContent = '';
        byId('step-costs').replaceChildren();
        byId('alignment-step').max = 0; byId('alignment-step').value = 0;
        byId('step-value').textContent = '0 / 0';
    }
}

const fixtures = [
    { id: '前导零完整', truth: '00110', prediction: '00110', status: 'ok' },
    { id: '漏掉一个0', truth: '1203', prediction: '123', status: 'ok' },
    { id: '有标签失败', truth: '305', prediction: '', status: 'failed', failureReason: '未找到数字' },
    { id: '等待答案', prediction: '09', status: 'ok' },
    { id: '损坏图片', truth: '7', prediction: '', status: 'error', exclusionReason: '损坏文件' }
];

function renderEvaluation() {
    byId('evaluation-error').textContent = '';
    lastReport = null;
    byId('download-report').disabled = true;
    try {
        const records = JSON.parse(byId('records-input').value);
        if (!Array.isArray(records) || records.length > 200) throw new Error('课堂页面支持最多200条记录的JSON数组。');
        if (records.some(row => row && ['truth', 'prediction'].some(key => typeof row[key] === 'string' && Array.from(row[key]).length > 200))) throw new Error('课堂页面的每条真值/预测最多200个码点。');
        const report = evaluatePredictions(records);
        lastReport = report;
        byId('micro-cer').textContent = formatRatio(report.microCER);
        byId('cer-fraction').textContent = `${report.totalErrors} 个错误 / ${report.totalTruthCharacters} 个真实字符`;
        byId('exact-accuracy').textContent = formatRatio(report.exactMatchAccuracy);
        byId('exact-fraction').textContent = `${report.exactMatches} 张完全正确 / ${report.evaluatedSamples} 张有标签有效照片`;
        byId('sample-counts').textContent = `总计 ${report.totalSamples}；纳入 ${report.evaluatedSamples}；待标注 ${report.pendingSamples}；排除 ${report.excludedSamples}；纳入的失败 ${report.failedSamples}。S=${report.substitutions}，D=${report.deletions}，I=${report.insertions}。`;
        const dispositionLabels = { evaluated: '纳入', pending: '待标注', excluded: '排除' };
        makeTable(byId('record-results'), ['样本', '真值', '预测', '去向 / 状态', 'S / D / I', 'CER', '完全正确', '原因'], report.records.map(row => [
            row.id, row.truth === '' ? '（待标注）' : row.truth, row.prediction === '' ? '（空串）' : row.prediction,
            `${dispositionLabels[row.disposition]} / ${row.status}`,
            row.included ? `${row.substitutions} / ${row.deletions} / ${row.insertions}` : '—', formatRatio(row.cer),
            row.exactMatch === null ? '—' : row.exactMatch ? '是' : '否', row.exclusionReason || row.failureReason || '—'
        ]), '逐条保留；失败状态不自动排除。');
        byId('report-json').textContent = JSON.stringify(report, null, 2);
        byId('download-report').disabled = false;
    } catch (error) {
        byId('evaluation-error').textContent = error.message;
        byId('micro-cer').textContent = '—'; byId('exact-accuracy').textContent = '—';
        byId('cer-fraction').textContent = ''; byId('exact-fraction').textContent = '';
        byId('sample-counts').textContent = '输入无效，当前没有评估结果。';
        byId('record-results').replaceChildren(); byId('report-json').textContent = '';
    }
}

const corpus = ['read the book', 'read the book', 'read the back', 'read a book'];
function renderCorrection() {
    try {
        const alpha = Number(byId('smoothing-alpha').value);
        const model = createBigramModel(corpus, { alpha });
        byId('alpha-value').textContent = alpha.toFixed(1);
        const previous = byId('previous-word').value;
        const result = suggestCorrection(byId('word-input').value, ['back', 'book'], {
            model, previousToken: previous, languageWeight: Number(byId('language-weight').value)
        });
        byId('language-weight-value').textContent = byId('language-weight').value;
        const reasonLabels = {
            'numeric-string-preserved': '数字串保持原样', 'in-dictionary': '词典内单词保持原样',
            'single-token-only': '只处理单个非空词', 'no-candidate': '距离不超过2的候选为空，保持原样',
            'toy-dictionary-suggestion': '有限词典的教学建议'
        };
        byId('correction-summary').textContent = `${result.original || '（空串）'} → ${result.suggestion || '（空串）'}；${reasonLabels[result.reason]}。`;
        makeTable(byId('candidate-results'), ['候选', '编辑距离', 'P(候选 | 左词)', '排序得分（非置信度）'], result.candidates.map(candidate => [candidate.word, candidate.distance, candidate.languageProbability.toFixed(4), candidate.score.toFixed(6)]));
        const transitions = model.vocabulary.map(word => model.inspectTransition(previous, word));
        makeTable(byId('bigram-counts'), ['后继词', 'C(h,w)', 'C(h)', 'V', '加平滑后分子', '分母', '概率'], transitions.map(row => [
            row.token, row.count, row.historyCount, row.vocabularySize, row.numerator.toFixed(1), row.denominator.toFixed(1), row.probability.toFixed(6)
        ]), `历史映射为 ${transitions[0].previousToken}；词表概率和=${transitions.reduce((sum, row) => sum + row.probability, 0).toFixed(6)}。`);
    } catch (error) {
        byId('correction-summary').textContent = error.message;
        byId('candidate-results').replaceChildren();
        byId('bigram-counts').replaceChildren();
    }
}

function renderWordUnits() {
    try {
        const truth = byId('word-truth').value;
        const prediction = byId('word-prediction').value;
        const words = wordErrorRate(truth, prediction);
        const characters = alignSequences(truth, prediction);
        byId('word-unit-summary').textContent = `真值词=${JSON.stringify(words.truthWords)}；预测词=${JSON.stringify(words.predictionWords)}。WER=${formatRatio(words.wer)} (${words.distance}/${words.truthWords.length})；码点CER=${formatRatio(truth === '' ? null : characters.distance / Array.from(truth).length)} (${characters.distance}/${Array.from(truth).length})。`;
        makeTable(byId('word-alignment'), ['真值词', '预测词', '操作', '真值词索引', '预测词索引'], words.alignment.map(column => [
            column.truth ?? '∅', column.prediction ?? '∅', `${column.operation} ${operationLabels[column.operation]}`,
            column.truthIndex ?? '—', column.predictionIndex ?? '—'
        ]), '词级对齐：先按空白切词，再执行相同的单位代价编辑对齐。');
    } catch (error) {
        byId('word-unit-summary').textContent = error.message;
        byId('word-alignment').replaceChildren();
    }
}

const scoredRecords = [
    { id: 'A', truth: '12', prediction: '12', scores: [0.95, 0.9] },
    { id: 'B', truth: '305', prediction: '308', scores: [0.9, 0.9, 0.55] }
];
function renderConfidence() {
    const threshold = Number(byId('confidence-threshold').value);
    byId('threshold-value').textContent = threshold.toFixed(2);
    const filtered = scoredRecords.map(row => ({ ...row, ...filterByConfidence(row.prediction, row.scores, threshold) }));
    const report = evaluatePredictions(filtered);
    const accepted = evaluatePredictions(filtered.filter(row => !row.rejected));
    byId('confidence-summary').textContent = `覆盖率 ${accepted.totalSamples}/2；仅已接受样本的整串正确率 ${formatRatio(accepted.exactMatchAccuracy)}；端到端 CER ${formatRatio(report.microCER)} (${report.totalErrors}/5)，整串完全正确率 ${formatRatio(report.exactMatchAccuracy)} (${report.exactMatches}/2)。`;
    makeTable(byId('confidence-results'), ['样本', '真值', '原始预测', '最低模型得分', '阈值后预测', '状态'], filtered.map(row => [row.id, row.truth, row.originalPrediction, row.minimumConfidence, row.prediction || '（空串）', row.status]));
}

byId('alignment-form').addEventListener('submit', event => { event.preventDefault(); renderAlignment(); });
byId('alignment-step').addEventListener('input', renderStep);
const presets = {
    deletion: ['1203', '123'], substitution: ['12', '21'], repeated: ['00110', '0110'],
    insertion: ['1', '1111'], failure: ['305', ''], empty: ['', '']
};
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
    [byId('truth').value, byId('prediction').value] = presets[button.dataset.preset]; renderAlignment();
}));
byId('evaluate-button').addEventListener('click', renderEvaluation);
byId('reset-records').addEventListener('click', () => { byId('records-input').value = JSON.stringify(fixtures, null, 2); renderEvaluation(); });
byId('empty-records').addEventListener('click', () => { byId('records-input').value = '[]'; renderEvaluation(); });
byId('download-report').addEventListener('click', () => {
    if (!lastReport) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'chapter-24-teaching-evaluation.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
byId('correction-form').addEventListener('submit', event => { event.preventDefault(); renderCorrection(); });
byId('language-weight').addEventListener('input', renderCorrection);
byId('smoothing-alpha').addEventListener('input', renderCorrection);
byId('word-unit-form').addEventListener('submit', event => {
    event.preventDefault();
    renderWordUnits();
});
byId('word-digit-example').addEventListener('click', () => {
    byId('word-truth').value = '00110';
    byId('word-prediction').value = '0110';
    renderWordUnits();
});
byId('word-text-example').addEventListener('click', () => {
    byId('word-truth').value = 'read the book';
    byId('word-prediction').value = 'read book';
    renderWordUnits();
});
byId('confidence-threshold').addEventListener('input', renderConfidence);
byId('word-rate').textContent = formatRatio(wordErrorRate('read the book', 'read book').wer);
byId('records-input').value = JSON.stringify(fixtures, null, 2);
renderAlignment();
renderEvaluation();
renderWordUnits();
renderCorrection();
renderConfidence();
byId('loading-note').hidden = true;
