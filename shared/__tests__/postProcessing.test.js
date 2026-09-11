'use strict';

const {
    alignSequences, evaluatePredictions, getEditDistanceTable,
    wordErrorRate, createBigramModel, suggestCorrection, filterByConfidence
} = require('../24-post-processing');

describe('Levenshtein 最小距离和完整对齐', () => {
    test.each([
        ['1203', '123', 0, 1, 0], ['12', '122', 0, 0, 1],
        ['12', '19', 1, 0, 0], ['305', '', 0, 3, 0],
        ['', '007', 0, 0, 3], ['', '', 0, 0, 0],
        ['00110', '00110', 0, 0, 0], ['00110', '0110', 0, 1, 0],
        ['1', '1111', 0, 0, 3], ['kitten', 'sitting', 2, 0, 1],
        ['🔢1', '🔢2', 1, 0, 0]
    ])('%j → %j 的 S/D/I', (truth, prediction, substitutions, deletions, insertions) => {
        const result = alignSequences(truth, prediction);
        expect(result).toMatchObject({ substitutions, deletions, insertions, distance: substitutions + deletions + insertions });
        expect(result.alignment.filter(column => column.truth !== null).map(column => column.truth).join('')).toBe(truth);
        expect(result.alignment.filter(column => column.prediction !== null).map(column => column.prediction).join('')).toBe(prediction);
    });

    test('回溯平局先替换，12 → 21 固定为两次替换', () => {
        expect(alignSequences('12', '21').alignment).toEqual([
            { operation: 'S', truth: '1', prediction: '2', truthIndex: 0, predictionIndex: 0 },
            { operation: 'S', truth: '2', prediction: '1', truthIndex: 1, predictionIndex: 1 }
        ]);
    });

    test('对角线非最优而删除与插入平局时，回溯优先删除', () => {
        const result = alignSequences('010', '101');
        expect(result).toMatchObject({ distance: 2, substitutions: 0, deletions: 1, insertions: 1 });
        expect(result.alignment.map(column => column.operation)).toEqual(['I', 'M', 'M', 'D']);
        expect(result.alignment[3]).toEqual({
            operation: 'D', truth: '0', prediction: null, truthIndex: 2, predictionIndex: null
        });
    });

    test('重复字符先从尾部匹配，固定删除第一个0', () => {
        expect(alignSequences('00110', '0110').alignment[0]).toEqual({
            operation: 'D', truth: '0', prediction: null, truthIndex: 0, predictionIndex: null
        });
        expect(alignSequences('1', '1111').alignment.map(column => column.operation)).toEqual(['I', 'I', 'I', 'M']);
    });

    test('对齐坐标是码点索引，字面连字符不是缺口，大小写/空白不归一化', () => {
        expect(alignSequences('🔢-', '🔢').alignment[1]).toMatchObject({ truth: '-', truthIndex: 1, prediction: null });
        expect(alignSequences('A ', 'a').distance).toBe(2);
        expect(alignSequences('é', 'e\u0301').distance).toBe(2);
    });

    test('表的维度、初始化与独立手算结果一致', () => {
        expect(getEditDistanceTable('1203', '123').matrix).toEqual([
            [0, 1, 2, 3], [1, 0, 1, 2], [2, 1, 0, 1], [3, 2, 1, 1], [4, 3, 2, 1]
        ]);
    });

    test('短二进制串穷举与独立图最短路参考值一致，并能按操作重建两端', () => {
        // 广度优先搜索前缀状态：匹配零成本，S/D/I 成本1；不复刻被测DP递推。
        function referenceDistance(a, b) {
            let states = [[0, 0]];
            const visited = new Set();
            for (let cost = 0; states.length; cost++) {
                const next = [];
                for (let k = 0; k < states.length; k++) {
                    const [i, j] = states[k];
                    const key = `${i},${j}`;
                    if (visited.has(key)) continue;
                    visited.add(key);
                    if (i === a.length && j === b.length) return cost;
                    if (i < a.length && j < b.length) {
                        (a[i] === b[j] ? states : next).push([i + 1, j + 1]);
                    }
                    if (i < a.length) next.push([i + 1, j]);
                    if (j < b.length) next.push([i, j + 1]);
                }
                states = next;
            }
            throw new Error('unreachable');
        }
        const strings = [''];
        for (let length = 1; length <= 3; length++) {
            for (let value = 0; value < 2 ** length; value++) strings.push(value.toString(2).padStart(length, '0'));
        }
        for (const a of strings) for (const b of strings) {
            const result = alignSequences(a, b);
            expect(result.distance).toBe(referenceDistance(a, b));
            let i = 0;
            let j = 0;
            for (const column of result.alignment) {
                if (column.truth !== null) { expect(column.truthIndex).toBe(i); expect(column.truth).toBe(a[i++]); }
                if (column.prediction !== null) { expect(column.predictionIndex).toBe(j); expect(column.prediction).toBe(b[j++]); }
                if (column.operation === 'M') expect(column.truth).toBe(column.prediction);
                if (column.operation === 'S') expect(column.truth).not.toBe(column.prediction);
                if (column.operation === 'D') expect(column.prediction).toBeNull();
                if (column.operation === 'I') expect(column.truth).toBeNull();
            }
            expect(i).toBe(a.length);
            expect(j).toBe(b.length);
        }
    });

    test('拒绝非字符串和超过教学内存上限的输入', () => {
        expect(() => alignSequences(123, '123')).toThrow(TypeError);
        expect(() => alignSequences('1', null)).toThrow(TypeError);
        expect(() => alignSequences('0'.repeat(2000), '0'.repeat(2000))).toThrow(RangeError);
    });
});

describe('独立数字串评估与分母', () => {
    test('聚合microCER而非逐图均值，整串按照片计数', () => {
        const report = evaluatePredictions([{ truth: '12', prediction: '12' }, { truth: '1203', prediction: '123' }]);
        expect(report).toMatchObject({ totalSamples: 2, evaluatedSamples: 2, totalTruthCharacters: 6, substitutions: 0, deletions: 1, insertions: 0, totalErrors: 1, exactMatches: 1 });
        expect(report.microCER).toBeCloseTo(1 / 6, 12);
        expect(report.microCER).not.toBeCloseTo(1 / 8, 12);
        expect(report.exactMatchAccuracy).toBe(0.5);
    });

    test('失败、空预测、前导零、重复数字及CER大于100%', () => {
        const report = evaluatePredictions([
            { truth: '00110', prediction: '00110' },
            { truth: '305', status: 'failed', failureReason: '未检测到数字' },
            { truth: '1', prediction: '1111' }
        ]);
        expect(report).toMatchObject({ evaluatedSamples: 3, failedSamples: 1, totalTruthCharacters: 9, deletions: 3, insertions: 3, exactMatches: 1 });
        expect(report.microCER).toBeCloseTo(6 / 9, 12);
        expect(report.records[1]).toMatchObject({ prediction: '', rawPrediction: null, included: true, cer: 1, failureReason: '未检测到数字', exactMatch: false });
        expect(report.records[2].cer).toBe(3);
        expect(evaluatePredictions([{ truth: '1', prediction: '1111' }]).microCER).toBe(3);
    });

    test('无标签三种形式均待标注；排除优先且保留理由、原始记录和元数据', () => {
        const records = [
            { id: 'undefined', prediction: '10' }, { id: 'null', truth: null, prediction: '00' },
            { id: 'empty', truth: '', prediction: '11' },
            { id: 'excluded', truth: '305', status: 'failed', exclusionReason: '  损坏图片  ', modelId: 'v1', config: { threshold: 0.5 } },
            { id: 'excluded-unlabeled', exclusionReason: '多行，超出约定' }
        ];
        const before = JSON.stringify(records);
        const report = evaluatePredictions(records);
        expect(report).toMatchObject({ totalSamples: 5, evaluatedSamples: 0, pendingSamples: 3, excludedSamples: 2, failedSamples: 0, microCER: null, exactMatchAccuracy: null });
        expect(report.records[3]).toMatchObject({ included: false, disposition: 'excluded', exclusionReason: '  损坏图片  ', modelId: 'v1', config: { threshold: 0.5 }, alignment: null, cer: null, exactMatch: null });
        expect(JSON.stringify(records)).toBe(before);
    });

    test('空数组无分母为null；JSON可序列化且不产生NaN', () => {
        const report = evaluatePredictions([]);
        expect(report).toMatchObject({ totalSamples: 0, totalErrors: 0, totalTruthCharacters: 0, microCER: null, exactMatchAccuracy: null, records: [] });
        expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    });

    test('status不会替代字符串比较；部分失败保留部分原始预测', () => {
        const report = evaluatePredictions([
            { truth: '1203', prediction: '123', status: 'error' },
            { truth: '001', prediction: '', status: 'ok' },
            { truth: '22', prediction: '22', status: 'failed' },
            { truth: '90', prediction: '90', status: 'custom-stage-status' }
        ]);
        expect(report).toMatchObject({ evaluatedSamples: 4, failedSamples: 3, exactMatches: 2, deletions: 4 });
        expect(report.records[0]).toMatchObject({ prediction: '123', rawPrediction: '123', cer: 0.25 });
    });

    test('数字真值、预测不强制转数字，不清理空白或非数字幻觉', () => {
        const report = evaluatePredictions([{ truth: '00', prediction: 'O0 ' }, { truth: '9', prediction: '9', exclusionReason: '   ' }]);
        expect(report).toMatchObject({ evaluatedSamples: 2, substitutions: 1, insertions: 1, excludedSamples: 0 });
        expect(report.records[0].prediction).toBe('O0 ');
    });

    test('逐图S/D/I之和等于聚合，样本三种去向互斥且完整', () => {
        const report = evaluatePredictions([
            { id: 'same', truth: '1', prediction: '2' }, { id: 'same', truth: '305', prediction: '' },
            { truth: '12', prediction: '122' }, { prediction: '9' }, { exclusionReason: '非照片' }
        ]);
        expect(report).toMatchObject({ substitutions: 1, deletions: 3, insertions: 1, totalErrors: 5, totalTruthCharacters: 6 });
        expect(report.totalSamples).toBe(report.evaluatedSamples + report.pendingSamples + report.excludedSamples);
        expect(report.totalErrors).toBe(report.records.filter(row => row.included).reduce((sum, row) => sum + row.distance, 0));
        expect(report.records).toHaveLength(5); // 重复ID不会隐式合并
    });

    test.each([
        null, {}, [null], new Array(1), [{ truth: 110 }], [{ truth: ' 12' }],
        [{ truth: '１２' }], [{ prediction: 12 }], [{ status: null }],
        [{ exclusionReason: true }], [{ id: NaN }]
    ])('拒绝无效记录 %j', records => expect(() => evaluatePredictions(records)).toThrow(TypeError));
});

describe('WER和有明确限制的bigram词典实验', () => {
    const corpus = ['read the book', 'read the book', 'read the back', 'read a book'];
    test('WER用词作单位，不是空格数字的CER', () => {
        expect(wordErrorRate('read the book', 'read book')).toMatchObject({ distance: 1, deletions: 1, wer: 1 / 3 });
        expect(wordErrorRate('00110', '0110').wer).toBe(1);
        expect(wordErrorRate(' \n ', 'book')).toMatchObject({ insertions: 1, wer: null });
        expect(wordErrorRate('Read book.', 'read book').substitutions).toBe(2);
    });
    test('add-one数值可复核：7种后继词，the后book=3/10、back=2/10', () => {
        const model = createBigramModel(corpus);
        expect(model.vocabulary).toHaveLength(7);
        expect(model.probability('the', 'book')).toBeCloseTo(3 / 10, 12);
        expect(model.probability('the', 'back')).toBeCloseTo(2 / 10, 12);
        expect(model.vocabulary.reduce((sum, word) => sum + model.probability('the', word), 0)).toBeCloseTo(1, 12);
        expect(model.probability('unseen-history', 'unseen-word')).toBeCloseTo(1 / 7, 12);
        expect(model.probability('<s>', 'read')).toBeCloseTo(5 / 11, 12);
        expect(model.logProbability('read the book')).toBeCloseTo(Math.log((5 / 11) * (4 / 11) * (3 / 10) * (4 / 10)), 12);
    });
    test('同编辑距离候选可被上下文重排，禁用语言权重恢复字典序', () => {
        const model = createBigramModel(corpus);
        const dictionary = ['book', 'back'];
        expect(suggestCorrection('bock', dictionary).suggestion).toBe('back');
        const result = suggestCorrection('bock', dictionary, { model, previousToken: 'the' });
        expect(result.suggestion).toBe('book');
        expect(result.candidates[0].score).toBeCloseTo(-1 + Math.log(0.3), 12);
        expect(suggestCorrection('bock', dictionary, { model, previousToken: 'the', languageWeight: 0 }).suggestion).toBe('back');
    });
    test('检查接口暴露实际计数和归一化项；改变alpha有可解释结果', () => {
        const model = createBigramModel(corpus);
        expect(model.inspectTransition('the', 'book')).toMatchObject({
            count: 2, historyCount: 3, vocabularySize: 7, alpha: 1,
            numerator: 3, denominator: 10, probability: 0.3
        });
        const less = createBigramModel(corpus, { alpha: 0.1 });
        const more = createBigramModel(corpus, { alpha: 3 });
        expect(less.probability('the', 'book')).toBeCloseTo(2.1 / 3.7, 12);
        expect(more.probability('the', 'book')).toBeCloseTo(5 / 24, 12);
        expect(more.probability('the', 'new')).toBeGreaterThan(less.probability('the', 'new'));
    });
    test('保护任意数字和词典内单词，候选不可用时不编造', () => {
        expect(suggestCorrection('00110', ['110'])).toMatchObject({ suggestion: '00110', changed: false, reason: 'numeric-string-preserved' });
        expect(suggestCorrection('111', ['1']).suggestion).toBe('111');
        expect(suggestCorrection('back', ['book', 'back']).reason).toBe('in-dictionary');
        expect(suggestCorrection('zzzzzz', ['book']).reason).toBe('no-candidate');
        expect(suggestCorrection('', ['book']).reason).toBe('single-token-only');
    });
    test('非法语料、平滑、字典和评分参数均报错', () => {
        expect(() => createBigramModel([])).toThrow(TypeError);
        expect(() => createBigramModel([''])).toThrow(TypeError);
        expect(() => createBigramModel(['<s> book'])).toThrow(TypeError);
        expect(() => createBigramModel(corpus, { alpha: 0 })).toThrow(RangeError);
        expect(() => suggestCorrection('bok', [])).toThrow(TypeError);
        expect(() => suggestCorrection('bok', ['book'], { editWeight: NaN })).toThrow(RangeError);
        expect(() => suggestCorrection('bok', ['book'], { maxDistance: -1 })).toThrow(RangeError);
        expect(() => suggestCorrection('bok', ['book'], { model: { probability: () => 0 } })).toThrow(RangeError);
    });
});

describe('置信度拒识保留分母', () => {
    test('整串拒识保留原预测，等于阈值允许通过', () => {
        expect(filterByConfidence('001', [0.9, 0.5, 0.9], 0.5)).toMatchObject({ prediction: '001', rejected: false, minimumConfidence: 0.5 });
        expect(filterByConfidence('001', [0.9, 0.5, 0.9], 0.51)).toMatchObject({ originalPrediction: '001', prediction: '', rejected: true, status: 'rejected' });
        expect(filterByConfidence('', [], 0)).toMatchObject({ prediction: '', status: 'failed', minimumConfidence: null });
    });
    test('拒识后CER从1/5变为3/5，照片分母仍为2', () => {
        const records = [
            { truth: '12', prediction: '12', scores: [0.95, 0.9] },
            { truth: '305', prediction: '308', scores: [0.9, 0.9, 0.55] }
        ];
        const result = evaluatePredictions(records.map(row => ({ ...row, ...filterByConfidence(row.prediction, row.scores, 0.8) })));
        expect(evaluatePredictions(records).microCER).toBe(0.2);
        expect(result).toMatchObject({ microCER: 0.6, exactMatchAccuracy: 0.5, evaluatedSamples: 2, failedSamples: 1 });
        expect(result.records[1].originalPrediction).toBe('308');
    });
    test('高模型得分也可能错误', () => {
        const result = evaluatePredictions([{ truth: '1', ...filterByConfidence('7', [0.999], 0.9) }]);
        expect(result).toMatchObject({ microCER: 1, exactMatchAccuracy: 0, failedSamples: 0 });
    });
    test('拒绝错误维度、非概率、稀疏分数和无效阈值', () => {
        expect(() => filterByConfidence('00', [0.9])).toThrow(TypeError);
        expect(() => filterByConfidence('0', [NaN])).toThrow(TypeError);
        expect(() => filterByConfidence('0', new Array(1))).toThrow(TypeError);
        expect(() => filterByConfidence('0', [1.1])).toThrow(TypeError);
        expect(() => filterByConfidence('0', [0.9], -1)).toThrow(RangeError);
    });
});
