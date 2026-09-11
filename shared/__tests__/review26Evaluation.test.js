const path = require('node:path');
const fs = require('node:fs');
const { validateRecords, summarizeExperiments, sampleKindLabel } = require('../26-validation');
const { validateManifest } = require('../../26-validation/manifest');
const directory = path.resolve(__dirname, '../../26-validation');
const row = { id: 'first', path: 'photos/first.png', imageId: 'source-first', truth: '00110', sampleKind: 'photo' };

describe('第26章独立样本与来源复核', () => {
  test('缺省来源与明确实拍必须分组；不能因缺字段新增实拍成绩', () => {
    const groups = summarizeExperiments([
      { id: 'unknown', truth: '001', prediction: '001' },
      { id: 'photo', sampleKind: 'photo', truth: '001', prediction: '001' },
    ]);
    expect(groups.map(group => group.sampleKind)).toEqual(['unknown', 'photo']);
    expect(groups.map(group => group.report.evaluatedSamples)).toEqual([1, 1]);
    expect(sampleKindLabel('unknown')).toBe('来源未标注');
    expect(sampleKindLabel('synthetic-custom')).toBe('其他来源：synthetic-custom');
  });
  test('清单在推理前拒绝重复id、同源id及等价路径', () => {
    for (const second of [
      { ...row, path: 'photos/second.png', imageId: 'second' },
      { ...row, id: 'second', path: 'photos/second.png' },
      { ...row, id: 'second', imageId: 'second', path: 'photos/../photos/first.png' },
    ]) expect(() => validateManifest({ mode: 'review', rows: [row, second] }, directory)).toThrow(/唯一|重复/);
  });
  test('错误真值、无效路径和非字符串来源不能进入批量评分', () => {
    for (const change of [{ truth: 110 }, { path: '' }, { imageId: {} }, { sampleKind: 42 }])
      expect(() => validateManifest({ rows: [{ ...row, ...change }] }, directory)).toThrow();
    expect(() => validateManifest({ mode: '../test', rows: [row] }, directory)).toThrow(/mode/);
    expect(() => validateRecords([{ id: '   ', prediction: '', truth: null }])).toThrow(/非空/);
  });
  test('来源缺失保留为unknown，合法清单不改写前导零或原对象', () => {
    const source = { rows: [{ ...row, sampleKind: undefined }] };
    const result = validateManifest(source, directory);
    expect(result.rows[0].sampleKind).toBe('unknown');
    expect(result.rows[0].truth).toBe('00110');
    expect(source.rows[0].sampleKind).toBeUndefined();
    expect(result.rows[0].prediction).toBeUndefined();
  });
  test('已有两份合成清单符合严格校验，仍明确为合成来源', () => {
    for (const name of ['development', 'test']) {
      const input = JSON.parse(fs.readFileSync(path.join(directory, `${name}-manifest.json`), 'utf8'));
      const validated = validateManifest(input, directory);
      expect(validated.rows).toHaveLength(12);
      expect(validated.rows.every(item => item.sampleKind === 'synthetic-mnist')).toBe(true);
    }
  });
});
