'use strict';

const nn = require('../14-neural-network-basics');

describe('第14章：手写 MLP 的数学正确性', () => {
    test('极端 logit 的 sigmoid 和 BCE 保持有限，正负类别对称', () => {
        expect(nn.sigmoid(1000)).toBe(1);
        expect(nn.sigmoid(-1000)).toBe(0);
        expect(nn.binaryCrossEntropyWithLogits(1000, 0)).toBe(1000);
        expect(nn.binaryCrossEntropyWithLogits(-1000, 1)).toBe(1000);
        expect(nn.binaryCrossEntropyWithLogits(1000, 1)).toBe(0);
        expect(nn.binaryCrossEntropyWithLogits(0, 1)).toBeCloseTo(Math.log(2), 14);
    });

    test('无隐藏层的 logistic 梯度直接对照 p-y、(p-y)x', () => {
        const model = nn.createMLP({ sizes: [2, 1] });
        model.layers[0].weights.fill(0);
        const { loss, gradients } = nn.backward(model, [{ input: [2, -3], target: 1 }]);
        expect(loss).toBeCloseTo(Math.log(2), 14);
        expect(Array.from(gradients[0].weights)).toEqual([-1, 1.5]);
        expect(Array.from(gradients[0].biases)).toEqual([-0.5]);
    });

    test('完整单样本算例的前向、全部参数梯度、更新后损失', () => {
        const t = nn.traceExample();
        expect(Array.from(t.cache.preActivations[0])).toEqual([0.5, 0.1]);
        expect(t.cache.probability).toBeCloseTo(0.5453108404505155, 13);
        expect(t.loss).toBeCloseTo(0.6063992974558354, 13);
        expect(t.gradients[0].weights[1]).toBeCloseTo(-0.06411218423517116, 13);
        expect(t.gradients[1].weights[0]).toBeCloseTo(-0.2830255101579055, 13);
        expect(t.after.layers[1].biases[0]).toBeCloseTo(0.14546891595494846, 13);
        expect(t.afterLoss).toBeCloseTo(0.5718183470703851, 13);
    });

    test.each(['sigmoid', 'tanh', 'relu'])('多隐藏层 %s 对所有参数做中心差分，检查不修改模型', activation => {
        const model = nn.createMLP({ sizes: [2, 3, 2, 1], activation, seed: 7 });
        // ReLU 避开 0 的折点；额外覆盖负激活支路。
        model.layers[0].biases.set([0.6, -0.7, 0.4]);
        model.layers[1].biases.set([0.5, -0.3]);
        const before = nn.cloneModel(model);
        const samples = [{ input: [0.2, -0.3], target: 0 }, { input: [-0.4, 0.7], target: 1 }];
        const result = nn.gradientCheck(model, samples);
        expect(result.parameterCount).toBe(20);
        expect(result.passed).toBe(true);
        expect(result.maxAbsError).toBeLessThan(1e-7);
        expect(model).toEqual(before);
    });

    test('对样本取平均；重复整个批次不改变损失和梯度', () => {
        const model = nn.createMLP();
        const samples = nn.xorSamples();
        const single = nn.backward(model, samples);
        const doubled = nn.backward(model, [...samples, ...samples]);
        expect(single.loss).toBeCloseTo(doubled.loss, 14);
        single.gradients.forEach((layer, l) => ['weights', 'biases'].forEach(key => {
            layer[key].forEach((v, i) => expect(v).toBeCloseTo(doubled.gradients[l][key][i], 14));
        }));
    });

    test('下降一步确实减小同一个目标，backward 不修改参数', () => {
        const model = nn.createMLP();
        const before = nn.cloneModel(model);
        const { loss, gradients } = nn.backward(model, nn.xorSamples());
        expect(model).toEqual(before);
        nn.applyGradients(model, gradients, 0.01);
        expect(nn.evaluate(model, nn.xorSamples()).loss).toBeLessThan(loss);
    });

    test('XOR 是真实学习结果且相同种子完全复现', () => {
        const a = nn.createMLP({ seed: 42 });
        const b = nn.createMLP({ seed: 42 });
        const result = nn.train(a, nn.xorSamples(), { epochs: 1500, recordEvery: 500 });
        nn.train(b, nn.xorSamples(), { epochs: 1500, recordEvery: 500 });
        expect(result.accuracy).toBe(1);
        expect(result.loss).toBeLessThan(0.01);
        expect(result.loss).toBeLessThan(result.history[0].loss / 50);
        expect(a).toEqual(b);
        expect(result.history.map(h => h.epoch)).toEqual([0, 500, 1000, 1500]);
    });

    test('ReLU 在零点使用约定的 0，sigmoid 的最大导数为 0.25', () => {
        expect(nn.activationDerivative(0, 'relu')).toBe(0);
        expect(nn.activationDerivative(-3, 'relu')).toBe(0);
        expect(nn.activationDerivative(3, 'relu')).toBe(1);
        expect(nn.activationDerivative(0, 'sigmoid')).toBe(0.25);
    });

    test('更新异常时不会留下半更新状态', () => {
        const model = nn.createMLP();
        const before = nn.cloneModel(model);
        const { gradients } = nn.backward(model, nn.xorSamples());
        gradients[1].biases[0] = NaN;
        expect(() => nn.applyGradients(model, gradients)).toThrow();
        expect(model).toEqual(before);
    });

    test.each([
        () => nn.createMLP({ sizes: [2, 2] }),
        () => nn.createMLP({ activation: 'unknown' }),
        () => nn.createMLP({ seed: -1 }),
        () => nn.forward(nn.createMLP(), [1]),
        () => nn.forward(nn.createMLP(), [Infinity, 0]),
        () => nn.backward(nn.createMLP(), []),
        () => nn.backward(nn.createMLP(), [{ input: [0, 1], target: 2 }]),
        () => nn.train(nn.createMLP(), nn.xorSamples(), { learningRate: 0 }),
        () => nn.train(nn.createMLP(), nn.xorSamples(), { epochs: -1 }),
        () => nn.gradientCheck(nn.createMLP(), nn.xorSamples(), { epsilon: 0 })
    ])('拒绝无效输入 %#', action => expect(action).toThrow());
});
