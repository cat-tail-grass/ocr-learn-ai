const { rnnStep, rnnForward, lstmStep, lstmForward, scalarSensitivity, teachingExample } = require('../18-rnn-basics');

describe('18 本轮独立正确性回归', () => {
    test('二维非对称循环矩阵的雅可比是 diag(1-h²) Whᵀ', () => {
        const p = { Wx: [[0.3, -0.4]], Wh: [[0.2, 0.7], [-0.5, 0.1]], b: [0.1, -0.2] };
        const previous = [0.4, -0.3], current = rnnStep([0.6], previous, p), epsilon = 1e-5;
        for (let j = 0; j < 2; j++) {
            const plus = previous.slice(), minus = previous.slice();
            plus[j] += epsilon; minus[j] -= epsilon;
            const hp = rnnStep([0.6], plus, p), hm = rnnStep([0.6], minus, p);
            for (let i = 0; i < 2; i++) {
                expect((hp[i] - hm[i]) / (2 * epsilon)).toBeCloseTo((1 - current[i] ** 2) * p.Wh[j][i], 9);
            }
        }
    });

    test('两维LSTM三门与候选的顺序，包含非零历史h/c', () => {
        const p = {
            Wx: [[0.1, 0.2, 0.3, 0.4, -0.5, 0.6, 0.7, -0.8]],
            Wh: [[0.2, -0.1, 0.4, 0.3, 0.5, -0.6, -0.7, 0.8], [-0.3, 0.2, 0.1, -0.4, 0.6, 0.5, 0.8, -0.7]],
            b: [0.1, -0.2, 0.7, 0.8, -0.1, 0.3, -0.4, 0.2]
        };
        const state = { h: [0.3, -0.2], c: [0.6, -0.7] }, result = lstmStep([0.4], state, p);
        const a = p.b.map((bias, j) => bias + 0.4 * p.Wx[0][j] + 0.3 * p.Wh[0][j] - 0.2 * p.Wh[1][j]);
        const sigmoid = x => 1 / (1 + Math.exp(-x));
        for (let j = 0; j < 2; j++) {
            const i = sigmoid(a[j]), f = sigmoid(a[j + 2]), g = Math.tanh(a[j + 4]), o = sigmoid(a[j + 6]);
            const cell = f * state.c[j] + i * g;
            expect(result.c[j]).toBeCloseTo(cell, 12);
            expect(result.h[j]).toBeCloseTo(o * Math.tanh(cell), 12);
        }
    });

    test('拒绝缺项数组：不能让有限数值校验漏过空槽并产生NaN', () => {
        const { rnn, lstm } = teachingExample();
        const hole = Array(1);
        expect(() => rnnForward([[1]], { ...rnn, b: hole })).toThrow(/有限/);
        expect(() => rnnForward([[1]], { ...rnn, Wx: [hole] })).toThrow(/有限/);
        expect(() => rnnForward([[1]], { ...rnn, Wh: hole })).toThrow();
        expect(() => rnnForward([hole], rnn)).toThrow(/有限/);
        expect(() => rnnForward(hole, rnn)).toThrow();
        expect(() => rnnForward([], rnn, hole)).toThrow(/有限/);
        expect(() => lstmForward([], lstm, { h: [0], c: hole })).toThrow(/有限/);
        expect(() => scalarSensitivity(hole, 0.8)).toThrow(/有限/);
    });
});
