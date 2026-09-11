const { appendRecord, annotateRecord, summarizeExperiments, readRecords, saveRecords, validateRecords, STORAGE_KEY } = require('../26-validation');
const original = { id: 'a', imageId: 'image-a', experimentId: 'first', modelId: 'm1', sampleKind: 'photo', prediction: '0010', truth: null, status: 'ok' };
describe('现场评估记录', () => {
    test('保存再读取保留前导零；补标注不修改原始预测', () => {
        const data = new Map(); const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
        const rows = appendRecord([], original); saveRecords(storage, rows);
        const annotated = annotateRecord(readRecords(storage), 'a', '00110');
        expect(annotated[0].prediction).toBe('0010'); expect(annotated[0].truth).toBe('00110');
        expect(original.truth).toBeNull(); expect(data.has(STORAGE_KEY)).toBe(true);
    });
    test('同一图片同轮重试不能充当新样本或覆盖首次预测', () => {
        expect(() => appendRecord([original], { ...original, id: 'b', prediction: '999' })).toThrow(/已记录/);
        // 导入会跳过 appendRecord，但仍必须拦截改 id 后重复计数。
        const duplicate = { ...original, id: 'imported-copy', prediction: '0010' };
        expect(() => validateRecords([original, duplicate])).toThrow(/重复的照片/);
        expect(validateRecords([original, { ...duplicate, experimentId: 'second' }])).toHaveLength(2);
    });
    test('按模型、输入类型和预处理配置隔离实验，不混合合成与实拍成绩', () => {
        const variants = [{}, { modelId: 'm2' }, { sampleKind: 'synthetic-mnist' }, { pipelineId: 'adaptive' }];
        const rows = variants.map((change, i) => ({ ...original, imageId: `image${i}`, truth: '0010', id: `row${i}`, ...change }));
        expect(summarizeExperiments(rows)).toHaveLength(4);
    });
    test('有效照片空预测计入失败；待标注不进入分母', () => {
        const result = summarizeExperiments([original, { ...original, id: 'b', imageId: 'image-b', prediction: '', truth: '123', status: 'failed' }])[0].report;
        expect(result.evaluatedSamples).toBe(1); expect(result.pendingSamples).toBe(1);
        expect(result.microCER).toBe(1); expect(result.exactMatchAccuracy).toBe(0);
    });
});
