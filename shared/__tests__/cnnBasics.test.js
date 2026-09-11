'use strict';

const cnn = require('../15-cnn-basics');

describe('第15章：卷积、池化与简单 CNN', () => {
    test('非对称核验证互相关不翻核', () => {
        const output = cnn.conv2d(cnn.tensor([1, 3, 3], [1, 2, 3, 4, 5, 6, 7, 8, 9]), cnn.tensor([1, 1, 2, 2], [1, 2, 3, 4]));
        expect(output.shape).toEqual([1, 2, 2]);
        expect(Array.from(output.data)).toEqual([37, 47, 67, 77]);
    });

    test('跨输入通道求和，每个输出通道单独核和一个偏置', () => {
        const input = cnn.tensor([2, 2, 2], [1, 2, 3, 4, 10, 20, 30, 40]);
        const kernels = cnn.tensor([2, 2, 1, 1], [2, 3, -1, 0.5]);
        const output = cnn.conv2d(input, kernels, { bias: [1, -2] });
        expect(output.shape).toEqual([2, 2, 2]);
        expect(Array.from(output.data)).toEqual([33, 65, 97, 129, 2, 6, 10, 14]);
    });

    test('stride/padding 和非整除输出采用 floor，矩形支持高宽分别设置', () => {
        const input = cnn.tensor([1, 3, 3], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
        const kernel = cnn.tensor([1, 1, 2, 2], [1, 1, 1, 1]);
        expect(Array.from(cnn.conv2d(input, kernel, { stride: 2, padding: 1 }).data)).toEqual([1, 5, 11, 28]);
        expect(cnn.outputShape([2, 6, 7], [3, 2, 3, 2], { stride: [2, 3], padding: [1, 0] })).toEqual([3, 3, 2]);
    });

    test('参数共享不随分辨率改变参数数，输出尺寸影响计算量', () => {
        const result = cnn.parameterCount([8, 1, 3, 3], [1, 28, 28], { padding: 1 });
        expect(result).toEqual({ outputShape: [8, 28, 28], convolution: 80, locallyConnected: 62720,
            fullyConnected: 4923520, multiplyAccumulates: 56448 });
        expect(cnn.parameterCount([8, 1, 3, 3], [1, 56, 56], { padding: 1 }).convolution).toBe(80);
    });

    test('共享核和重叠窗口梯度按路径累加', () => {
        const input = cnn.tensor([1, 3, 3], Array(9).fill(1));
        const kernel = cnn.tensor([1, 1, 2, 2], Array(4).fill(1));
        const grad = cnn.conv2dBackward(input, kernel, cnn.tensor([1, 2, 2], Array(4).fill(1)));
        expect(Array.from(grad.dInput.data)).toEqual([1, 2, 1, 2, 4, 2, 1, 2, 1]);
        expect(Array.from(grad.dKernel.data)).toEqual([4, 4, 4, 4]);
        expect(Array.from(grad.dBias)).toEqual([4]);
    });

    test('多通道、双输出、矩形核、stride/padding 的所有输入/权重/偏置梯度通过数值差分', () => {
        const input = cnn.tensor([2, 3, 4], Array.from({ length: 24 }, (_, i) => Math.sin(i + 1)));
        const kernel = cnn.tensor([2, 2, 2, 3], Array.from({ length: 24 }, (_, i) => Math.cos(i + 2) / 3));
        const bias = [0.2, -0.3];
        const options = { stride: [2, 1], padding: [1, 0], bias };
        const shape = cnn.outputShape(input.shape, kernel.shape, options);
        const upstream = cnn.tensor(shape, Array.from({ length: shape.reduce((a, b) => a * b, 1) }, (_, i) => (i - 2) / 7));
        const gradients = cnn.conv2dBackward(input, kernel, upstream, options);
        // 独立标量目标 L=<Y,G>，让不同位置和输出通道具有不同导数。
        const loss = () => cnn.conv2d(input, kernel, options).data.reduce((sum, v, i) => sum + v * upstream.data[i], 0);
        for (const [values, analytical] of [[input.data, gradients.dInput.data], [kernel.data, gradients.dKernel.data], [bias, gradients.dBias]]) {
            for (let i = 0; i < values.length; i++) {
                const original = values[i];
                const epsilon = 1e-5;
                values[i] = original + epsilon;
                const plus = loss();
                values[i] = original - epsilon;
                const minus = loss();
                values[i] = original;
                expect(analytical[i]).toBeCloseTo((plus - minus) / (2 * epsilon), 8);
            }
        }
    });

    test('卷积权重梯度能实际降低平方损失', () => {
        const input = cnn.tensor([1, 2, 3], [1, 0, 2, -1, 1, 3]);
        const kernel = cnn.tensor([1, 1, 2, 2], [0.1, -0.2, 0.3, 0.1]);
        const y = cnn.conv2d(input, kernel);
        const loss = a => a.data.reduce((sum, v) => sum + v * v / 2, 0);
        const gradients = cnn.conv2dBackward(input, kernel, y);
        kernel.data.forEach((v, i) => { kernel.data[i] = v - 0.01 * gradients.dKernel.data[i]; });
        expect(loss(cnn.conv2d(input, kernel))).toBeLessThan(loss(y));
    });

    test('池化逐通道，负输入的 max 不能初始化为零，边缘不足窗口时丢弃', () => {
        const input = cnn.tensor([2, 2, 3], [-4, -2, 99, -3, -1, 99, 1, 2, 99, 3, 4, 99]);
        expect(Array.from(cnn.pool2d(input).data)).toEqual([-1, 4]);
        expect(Array.from(cnn.pool2d(input, { mode: 'average' }).data)).toEqual([-2.5, 2.5]);
    });

    test('最大池化重叠和并列按确定规则反传；平均池化均分再累加', () => {
        const input = cnn.tensor([1, 3, 3], [0, 0, 0, 0, 9, 0, 0, 0, 0]);
        const upstream = cnn.tensor([1, 2, 2], [1, 1, 1, 1]);
        expect(Array.from(cnn.pool2dBackward(input, upstream, { stride: 1 }).data)).toEqual([0, 0, 0, 0, 4, 0, 0, 0, 0]);
        expect(Array.from(cnn.pool2dBackward(input, upstream, { stride: 1, mode: 'average' }).data)).toEqual([0.25, 0.5, 0.25, 0.5, 1, 0.5, 0.25, 0.5, 0.25]);
        const tied = cnn.tensor([1, 2, 2], [4, 4, 4, 4]);
        expect(Array.from(cnn.pool2dBackward(tied, cnn.tensor([1, 1, 1], [2])).data)).toEqual([2, 0, 0, 0]);
    });

    test('flatten 的 CHW 次序、dense 维度和稳定 softmax', () => {
        const t = cnn.tensor([2, 1, 2], [1, 2, 3, 4]);
        const flat = cnn.flatten(t);
        expect(Array.from(flat)).toEqual([1, 2, 3, 4]);
        flat[0] = 9;
        expect(t.data[0]).toBe(1);
        expect(Array.from(cnn.dense([2, 3], cnn.tensor([2, 2], [1, 2, -1, 1]), [1, 2]))).toEqual([9, 3]);
        expect(Array.from(cnn.softmax([1000, 1000]))).toEqual([0.5, 0.5]);
    });

    test.each([['vertical', '竖线'], ['horizontal', '横线']])('固定权重 CNN 对 %s 的整条前向', (orientation, label) => {
        const result = cnn.tinyCNNForward(cnn.makeLineImage({ orientation }));
        expect(result.convolution.shape).toEqual([2, 4, 4]);
        expect(result.pooled.shape).toEqual([2, 2, 2]);
        expect(result.features.length).toBe(8);
        expect(result.parameterCount).toBe(38);
        expect(result.label).toBe(label);
        expect(result.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 14);
    });

    test.each([
        () => cnn.tensor([1, 2, 2], [1]),
        () => cnn.tensor([1, 1, 1], [NaN]),
        () => cnn.outputShape([1, 3, 3], [2, 2, 1, 1]),
        () => cnn.outputShape([1, 3, 3], [2, 1, 1, 1], { stride: 0 }),
        () => cnn.outputShape([1, 3, 3], [2, 1, 1, 1], { padding: -1 }),
        () => cnn.outputShape([1, 2, 2], [1, 1, 4, 4]),
        () => cnn.conv2d(cnn.tensor([1, 2, 2]), cnn.tensor([1, 1, 1, 1]), { bias: [] }),
        () => cnn.conv2dBackward(cnn.tensor([1, 2, 2]), cnn.tensor([1, 1, 1, 1]), cnn.tensor([1, 1, 1])),
        () => cnn.pool2d(cnn.tensor([1, 2, 2]), { mode: 'median' }),
        () => cnn.pool2d(cnn.tensor([1, 2, 2]), { size: 3 }),
        () => cnn.softmax([]),
        () => cnn.makeLineImage({ position: 6 })
    ])('拒绝无效输入 %#', action => expect(action).toThrow());
});
