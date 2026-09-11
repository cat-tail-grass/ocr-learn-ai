const tf = require('@tensorflow/tfjs');
const { collapsePath, minimumFrames, ctcForwardBackward, ctcLossAndGradient, enumeratePaths,
    greedyDecode, prefixBeamDecode, differentiableCtcLoss } = require('../19-ctc-loss');

beforeAll(async () => { await tf.setBackend('cpu'); await tf.ready(); });

describe('第19章 CTC', () => {
    test('先合并连续重复再移除blank，保留blank隔开的重复', () => {
        expect(collapsePath([1, 1, 0, 1, 2, 2, 0])).toEqual([1, 1, 2]);
        expect(collapsePath([0, 0, 0])).toEqual([]);
        expect(collapsePath([])).toEqual([]);
        expect(minimumFrames([1, 1, 1])).toBe(5);
    });
    test('两帧单字有三条路径，总概率0.76', () => {
        const p = [[0.4, 0.6], [0.6, 0.4]];
        expect(ctcForwardBackward(p, [1]).probability).toBeCloseTo(0.76, 12);
        expect(enumeratePaths(p, [1]).matchingPaths).toBe(3);
        expect(ctcForwardBackward(p, []).probability).toBeCloseTo(0.24, 12);
    });
    test.each([[], [1], [2], [1, 1], [1, 2], [2, 1], [1, 2, 1], [2, 2, 2]].map(target => ({ target })))(
        '四帧DP与独立全路径枚举一致：$target', ({ target }) => {
            const p = [[0.2, 0.5, 0.3], [0.6, 0.1, 0.3], [0.3, 0.4, 0.3], [0.1, 0.7, 0.2]];
            const result = ctcForwardBackward(p, target), exact = enumeratePaths(p, target);
            expect(result.probability).toBeCloseTo(exact.probability, 12);
            if (result.possible) result.posterior.forEach(row => expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10));
        });
    test('相邻重复必须多一帧；不可能路径概率0、loss无穷，训练明确拒绝', () => {
        const result = ctcForwardBackward([[0.5, 0.5], [0.5, 0.5]], [1, 1]);
        expect(result.loss).toBe(Infinity); expect(result.possible).toBe(false);
        expect(() => ctcLossAndGradient([[0, 0], [0, 0]], [1, 1])).toThrow(/至少需要 3/);
        expect(ctcForwardBackward([[0, 1], [1, 0], [0, 1]], [1, 1]).probability).toBe(1);
    });
    test('全blank、零概率及极端logits不会产生NaN', () => {
        expect(ctcForwardBackward([[1, 0], [1, 0]], []).loss).toBeCloseTo(0);
        expect(ctcForwardBackward([[1, 0], [1, 0]], [1]).loss).toBe(Infinity);
        const r = ctcLossAndGradient([[1000, -1000], [1000, -1000]], [1]);
        expect(Number.isFinite(r.loss)).toBe(true); expect(r.loss).toBeGreaterThan(1000);
        expect(r.gradient.flat().every(Number.isFinite)).toBe(true);
    });
    test('beam聚合所有对齐：blank是最佳单路径但不是最佳字符串', () => {
        const p = [[0.4, 0.35, 0.25], [0.4, 0.35, 0.25]];
        expect(greedyDecode(p).labels).toEqual([]);
        expect(prefixBeamDecode(p, 0, 20)[0].labels).toEqual([1]);
        expect(prefixBeamDecode(p, 0, 20)[0].probability).toBeCloseTo(0.4025, 12);
    });
    test('足够宽的prefix beam与完整分布逐项一致，包括重复数字', () => {
        const p = [[0.2, 0.5, 0.3], [0.6, 0.1, 0.3], [0.3, 0.4, 0.3], [0.1, 0.7, 0.2]];
        const exact = enumeratePaths(p, []).distribution;
        const beam = prefixBeamDecode(p, 0, 1000);
        expect(beam).toHaveLength(exact.filter(x => x.probability > 0).length);
        for (const item of beam) expect(item.probability).toBeCloseTo(exact.find(x => JSON.stringify(x.labels) === JSON.stringify(item.labels)).probability, 12);
    });
    test.each([[1, 1], [1, 2], []].map(target => ({ target })))('解析logits梯度与中心差分一致：$target', ({ target }) => {
        const logits = [[0.2, -0.3, 0.8], [0.4, 0.6, -0.2], [0.9, 0.1, -0.4]], epsilon = 1e-5;
        const analytic = ctcLossAndGradient(logits, target);
        for (let t = 0; t < 3; t++) {
            expect(analytic.gradient[t].reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
            for (let k = 0; k < 3; k++) {
                const p = logits.map(row => row.slice()), m = logits.map(row => row.slice());
                p[t][k] += epsilon; m[t][k] -= epsilon;
                const numeric = (ctcLossAndGradient(p, target).loss - ctcLossAndGradient(m, target).loss) / (2 * epsilon);
                expect(analytic.gradient[t][k]).toBeCloseTo(numeric, 7);
            }
        }
    });
    test('blank可以使用非零索引，类别0仍能作为正常输出', () => {
        const p = [[0.9, 0.05, 0.05], [0.05, 0.05, 0.9], [0.9, 0.05, 0.05]];
        expect(greedyDecode(p, 2).labels).toEqual([0, 0]);
        expect(prefixBeamDecode(p, 2, 100)[0].labels).toEqual([0, 0]);
        expect(ctcForwardBackward(p, [0, 0], 2).probability).toBeCloseTo(0.9 ** 3, 12);
        expect(enumeratePaths(p, [0, 0], 2).probability).toBeCloseTo(0.9 ** 3, 12);
    });
    test('customGrad支持批平均、上游系数，优化真实logits后CTC下降', () => {
        const before = tf.memory().numTensors;
        const init = tf.zeros([2, 3, 3]), logits = tf.variable(init); init.dispose();
        const targets = [[1, 1], [2]], optimizer = tf.train.sgd(0.5);
        const loss = () => differentiableCtcLoss(tf, logits, targets);
        const start = tf.tidy(() => loss().dataSync()[0]);
        const derivative = tf.grad(x => differentiableCtcLoss(tf, x, targets).mul(3))(logits);
        const expected = ctcLossAndGradient([[0, 0, 0], [0, 0, 0], [0, 0, 0]], targets[0]).gradient.flat();
        Array.from(derivative.dataSync()).slice(0, 9).forEach((x, i) => expect(x).toBeCloseTo(expected[i] * 1.5, 6));
        derivative.dispose();
        for (let i = 0; i < 20; i++) optimizer.minimize(loss, false, [logits]);
        expect(tf.tidy(() => loss().dataSync()[0])).toBeLessThan(start * 0.5);
        logits.dispose(); optimizer.dispose();
        expect(tf.memory().numTensors).toBe(before);
    });
    test('非法概率、标签、blank、长度、beam宽度和枚举量报错', () => {
        for (const p of [[], [[0.2, 0.2]], [[-0.1, 1.1]], [[NaN, 0]], [[0.5, 0.5], [1]], [[1]]]) {
            expect(() => ctcForwardBackward(p, [1])).toThrow();
        }
        expect(() => ctcForwardBackward([[0.5, 0.5]], [0])).toThrow();
        expect(() => ctcForwardBackward([[0.5, 0.5]], [2])).toThrow();
        expect(() => greedyDecode([[0.5, 0.5]], 2)).toThrow();
        expect(() => prefixBeamDecode([[0.5, 0.5]], 0, 0)).toThrow();
        expect(() => enumeratePaths(Array(30).fill([0.5, 0.5]), [])).toThrow();
    });
});
