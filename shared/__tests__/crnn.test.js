const tf = require('@tensorflow/tfjs');
const { createTinyCrnn, cnnSequenceShape, renderSyntheticLine, createSyntheticDataset,
    imageBatch, predictRows, gradientCheck, trainTinyCrnn } = require('../20-crnn');
const { differentiableCtcLoss } = require('../19-ctc-loss');

beforeAll(async () => { await tf.setBackend('cpu'); await tf.ready(); });

describe('第20章真正的CNN + BiLSTM + CTC', () => {
    test('宽度决定时间轴且池化向下取整', () => {
        expect(cnnSequenceShape().sequence).toEqual([1, 10, 16]);
        expect(cnnSequenceShape({ width: 21, height: 9 }, 3).logits).toEqual([3, 10, 3]);
        expect(() => cnnSequenceShape({ width: 0 })).toThrow();
    });
    test('合成种子复现，重复字符串保留；非法图像拒绝', () => {
        expect(renderSyntheticLine('001', { seed: 7 }).pixels).toEqual(renderSyntheticLine('001', { seed: 7 }).pixels);
        expect(renderSyntheticLine('001', { seed: 7 }).pixels).not.toEqual(renderSyntheticLine('001', { seed: 8 }).pixels);
        expect(createSyntheticDataset({ copies: 1 }).find(x => x.truth === '000').labels).toEqual([1, 1, 1]);
        expect(() => renderSyntheticLine('2')).toThrow();
        expect(() => renderSyntheticLine('000', { width: 5 })).toThrow();
    });
    test('CTC梯度有限差分误差小于1e-5', () => {
        expect(gradientCheck(tf).maxAbsoluteError).toBeLessThan(1e-5);
    });
    test('端到端梯度经过CNN和两个LSTM，并核对卷积参数有限差分', () => {
        const baseline = tf.memory().numTensors, model = createTinyCrnn(tf);
        const records = createSyntheticDataset({ copies: 1 }).slice(2, 4), batch = imageBatch(tf, records, model.config);
        const objective = () => differentiableCtcLoss(tf, model.forward(batch), records.map(x => x.labels));
        const result = tf.variableGrads(objective, Object.values(model.variables));
        try {
            for (const variable of Object.values(model.variables)) {
                const values = Array.from(result.grads[variable.name].dataSync());
                expect(values.every(Number.isFinite)).toBe(true);
                expect(values.some(x => Math.abs(x) > 1e-9)).toBe(true);
            }
            const kernel = model.variables.convKernel, values = Array.from(kernel.dataSync());
            const analytic = Array.from(result.grads[kernel.name].dataSync());
            const coordinate = analytic.reduce((best, x, i) => Math.abs(x) > Math.abs(analytic[best]) ? i : best, 0), eps = 0.005;
            function shifted(delta) {
                const next = values.slice(); next[coordinate] += delta;
                tf.tidy(() => kernel.assign(tf.tensor(next, kernel.shape)));
                return tf.tidy(() => objective().dataSync()[0]);
            }
            const numerical = (shifted(eps) - shifted(-eps)) / (2 * eps);
            expect(Math.abs(numerical - analytic[coordinate])).toBeLessThan(5e-4);
        } finally { tf.dispose(result); batch.dispose(); model.dispose(); }
        expect(tf.memory().numTensors).toBe(baseline);
    });
    test('导出重载预测相同；预测不读取truth或labels；释放无泄漏', () => {
        const baseline = tf.memory().numTensors, model = createTinyCrnn(tf), restored = createTinyCrnn(tf);
        try {
            restored.importWeights(JSON.parse(JSON.stringify(model.exportWeights())));
            const image = renderSyntheticLine('00');
            Object.defineProperty(image, 'truth', { get() { throw new Error('禁止读取真值'); } });
            Object.defineProperty(image, 'labels', { get() { throw new Error('禁止读取标签'); } });
            expect(predictRows(tf, restored, [image])).toEqual(predictRows(tf, model, [image]));
            expect(() => restored.importWeights({})).toThrow();
            expect(() => predictRows(tf, model, [{ ...renderSyntheticLine('0'), pixels: [NaN] }])).toThrow();
        } finally { model.dispose(); restored.dispose(); }
        expect(tf.memory().numTensors).toBe(baseline);
    });
    test('少量真实全模型更新使CTC损失下降且卷积权重改变', async () => {
        const before = tf.memory().numTensors;
        const { model, report } = await trainTinyCrnn(tf, { steps: 8 });
        try {
            expect(report.finalLoss).toBeLessThan(report.initialLoss);
            expect(report.maxConvolutionWeightChange).toBeGreaterThan(0.001);
            expect(report.firstGradientNorms.forwardKernel).toBeGreaterThan(0);
            expect(report.firstGradientNorms.backwardKernel).toBeGreaterThan(0);
        } finally { model.dispose(); }
        expect(tf.memory().numTensors).toBe(before);
    }, 30000);
});
