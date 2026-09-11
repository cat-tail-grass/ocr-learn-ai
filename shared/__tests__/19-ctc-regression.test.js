const tf = require('@tensorflow/tfjs');
const { ctcForwardBackward, ctcLossAndGradient, differentiableCtcLoss, collapsePath,
    minimumFrames, prefixBeamDecode } = require('../19-ctc-loss');

beforeAll(async () => { await tf.setBackend('cpu'); await tf.ready(); });

describe('19 本轮独立正确性回归', () => {
    test.each([1e12, 1e16, -1e16])('logits共同平移 %s 后概率/损失/梯度不变', offset => {
        const result = ctcLossAndGradient([[offset, offset]], [1]);
        expect(result.loss).toBeCloseTo(Math.log(2), 12);
        expect(result.probabilities[0]).toEqual([0.5, 0.5]);
        expect(result.gradient[0]).toEqual([0.5, -0.5]);
    });

    test('不同帧的大偏移和可精确表示的类间差值，保持重复目标的梯度', () => {
        const logits = [[0, 2, -2], [4, 0, 2], [-2, 2, 0]], shifts = [1e16, -1e16, 1e16];
        const base = ctcLossAndGradient(logits, [1, 1]);
        const shifted = ctcLossAndGradient(logits.map((row, t) => row.map(x => x + shifts[t])), [1, 1]);
        expect(shifted.loss).toBeCloseTo(base.loss, 12);
        shifted.gradient.flat().forEach((g, i) => expect(g).toBeCloseTo(base.gradient.flat()[i], 12));
    });

    test('customGrad同样保留大偏移下批平均与上游缩放', () => {
        const before = tf.memory().numTensors;
        const x = tf.fill([2, 1, 2], 1e16);
        const loss = differentiableCtcLoss(tf, x, [[1], []]);
        const grad = tf.grad(z => differentiableCtcLoss(tf, z, [[1], []]).mul(3))(x);
        try {
            expect(loss.dataSync()[0]).toBeCloseTo(Math.log(2), 6);
            expect(Array.from(grad.dataSync())).toEqual([0.75, -0.75, -0.75, 0.75]);
        } finally { x.dispose(); loss.dispose(); grad.dispose(); }
        expect(tf.memory().numTensors).toBe(before);
    });

    test('前后向后验与独立路径累加一致：非零blank、空目标、重复目标', () => {
        const p = [[0.4, 0.3, 0.3], [0.2, 0.5, 0.3], [0.6, 0.1, 0.3], [0.3, 0.4, 0.3]];
        const blank = 2, distribution = new Map();
        // 此处不调用课程collapsePath或枚举函数，避免共享折叠错误。
        for (let n = 0; n < 3 ** p.length; n++) {
            let code = n, probability = 1;
            const path = [], labels = [];
            for (let t = 0; t < p.length; t++) {
                const k = code % 3; code = Math.floor(code / 3);
                path.push(k); probability *= p[t][k];
                if (k !== blank && (t === 0 || k !== path[t - 1])) labels.push(k);
            }
            const key = JSON.stringify(labels);
            if (!distribution.has(key)) distribution.set(key, { mass: 0, counts: p.map(() => [0, 0, 0]) });
            const item = distribution.get(key); item.mass += probability;
            path.forEach((k, t) => { item.counts[t][k] += probability; });
        }
        for (const target of [[], [0], [0, 0], [0, 1], [1, 1, 1]]) {
            const exact = distribution.get(JSON.stringify(target)), dp = ctcForwardBackward(p, target, blank);
            expect(dp.probability).toBeCloseTo(exact?.mass || 0, 12);
            if (exact) dp.posterior.forEach((row, t) => row.forEach((q, k) => expect(q).toBeCloseTo(exact.counts[t][k] / exact.mass, 12)));
        }
        for (const beam of prefixBeamDecode(p, blank, 1000)) {
            expect(beam.probability).toBeCloseTo(distribution.get(JSON.stringify(beam.labels)).mass, 12);
        }
    });

    test('稀疏概率、logits、路径和目标必须报错，不能返回possible=true且loss=NaN', () => {
        expect(() => ctcForwardBackward([[0.5, , 0.5]], [1])).toThrow();
        expect(() => ctcLossAndGradient([[0, , 0]], [1])).toThrow();
        expect(() => ctcForwardBackward([[0.5, 0.5]], Array(1))).toThrow();
        expect(() => ctcForwardBackward([, [0.5, 0.5]], [1])).toThrow();
        expect(() => minimumFrames(Array(1))).toThrow();
        expect(() => collapsePath([1, , 1])).toThrow();
    });
});
