const tf = require('@tensorflow/tfjs');
const { createTinyCrnn, renderSyntheticLine, imageBatch } = require('../20-crnn');
const { lstmForward } = require('../18-rnn-basics');

beforeAll(async () => { await tf.setBackend('cpu'); await tf.ready(); });

describe('20 本轮独立正确性回归（不训练）', () => {
    test('批量列序与两方向LSTM和独立数组实现一致', () => {
        const before = tf.memory().numTensors, model = createTinyCrnn(tf, { channels: 2, hiddenSize: 3 });
        const batch = imageBatch(tf, [renderSyntheticLine('001'), renderSyntheticLine('10')], model.config);
        try {
            const stages = model.inspect(batch), F = stages.sequence.shape[2], H = model.config.hiddenSize;
            for (let b = 0; b < 2; b++) {
                stages.sequence.values[b].forEach((frame, t) => expect(frame).toEqual(stages.pooled.values[b].flatMap(row => row[t])));
                for (const direction of ['forward', 'backward']) {
                    const kernel = model.variables[`${direction}Kernel`].arraySync();
                    const p = { Wx: kernel.slice(0, F), Wh: kernel.slice(F), b: model.variables[`${direction}Bias`].arraySync() };
                    const inputs = stages.sequence.values[b].slice();
                    if (direction === 'backward') inputs.reverse();
                    const states = lstmForward(inputs, p).states.map(x => x.h);
                    if (direction === 'backward') states.reverse();
                    states.forEach((h, t) => {
                        expect(h).toHaveLength(H);
                        h.forEach((v, j) => expect(stages[`${direction}States`].values[b][t][j]).toBeCloseTo(v, 6));
                    });
                }
            }
        } finally { batch.dispose(); model.dispose(); }
        expect(tf.memory().numTensors).toBe(before);
    });

    test.each(['alphabet', 'float32-overflow', 'sparse-values'])('无效权重 %s 在任何变量赋值前被拒绝', kind => {
        const before = tf.memory().numTensors, model = createTinyCrnn(tf);
        try {
            const original = model.exportWeights(), artifact = JSON.parse(JSON.stringify(original));
            artifact.weights.convKernel.values[0] = 42;
            if (kind === 'alphabet') artifact.alphabet = ['', '1', '0'];
            if (kind === 'float32-overflow') artifact.weights.outputBias.values[2] = 1e100;
            if (kind === 'sparse-values') delete artifact.weights.outputBias.values[2];
            expect(() => model.importWeights(artifact)).toThrow();
            expect(model.exportWeights()).toEqual(original);
        } finally { model.dispose(); }
        expect(tf.memory().numTensors).toBe(before);
    });
});
