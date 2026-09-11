const { rnnForward, lstmStep, lstmForward, bidirectionalRnn, scalarSensitivity, teachingExample, sigmoid } = require('../18-rnn-basics');

describe('第18章 RNN / LSTM', () => {
    test('共享权重逐步展开，首帧与第二帧可手算', () => {
        const { inputs, rnn } = teachingExample(), result = rnnForward(inputs, rnn);
        expect(result.states[0][0]).toBeCloseTo(Math.tanh(0.5), 12);
        expect(result.states[1][0]).toBeCloseTo(Math.tanh(0.8 * Math.tanh(0.5)), 12);
        expect(result.finalState).toEqual(result.states[3]);
    });
    test('双向输出按原时间位置拼接；改未来只影响反向首帧', () => {
        const p = teachingExample().rnn;
        const a = bidirectionalRnn([[1], [0]], p, p), b = bidirectionalRnn([[1], [2]], p, p);
        expect(a.forward[0]).toEqual(b.forward[0]);
        expect(a.backward[0][0]).not.toBeCloseTo(b.backward[0][0]);
        expect(a.states[1][1]).toBeCloseTo(0);
    });
    test('LSTM 三个门、候选、中间 cell 和输出分别符合独立手算', () => {
        const p = teachingExample().lstm, r = lstmStep([1], { h: [0], c: [0] }, p);
        expect(r.gates.i[0]).toBe(0.5); expect(r.gates.o[0]).toBe(0.5);
        expect(r.gates.f[0]).toBeCloseTo(0.7310585786, 9);
        expect(r.c[0]).toBeCloseTo(0.5 * Math.tanh(1), 12);
        expect(r.h[0]).toBeCloseTo(0.5 * Math.tanh(0.5 * Math.tanh(1)), 12);
        const zero = { Wx: [[0, 0, 0, 0]], Wh: [[0, 0, 0, 0]], b: [0, 0, 0, 0] };
        expect(lstmStep([0], { h: [0], c: [2] }, zero).c[0]).toBe(1);
    });
    test('灵敏度符合有限差分，并包含消失、爆炸、饱和反例', () => {
        const inputs = [0.2, -0.1, 0.3], epsilon = 1e-5;
        const p = scalarSensitivity(inputs, 0.8, 1, 0.1);
        const numeric = (scalarSensitivity(inputs, 0.8, 1, 0.1 + epsilon).finalState
            - scalarSensitivity(inputs, 0.8, 1, 0.1 - epsilon).finalState) / (2 * epsilon);
        expect(p.derivative).toBeCloseTo(numeric, 8);
        expect(scalarSensitivity(Array(20).fill(0), 0.5).derivative).toBeCloseTo(0.5 ** 20, 12);
        expect(scalarSensitivity(Array(20).fill(0), 1.2).derivative).toBeCloseTo(1.2 ** 20, 8);
        expect(scalarSensitivity(Array(20).fill(4), 1.2).derivative).toBeLessThan(1e-10);
    });
    test('空序列保留初始状态，不修改输入', () => {
        const { rnn, lstm } = teachingExample(), state = [0.2];
        expect(rnnForward([], rnn, state).finalState).toEqual(state);
        expect(lstmForward([], lstm).finalState).toEqual({ h: [0], c: [0] });
        rnnForward([[1]], rnn, state); expect(state).toEqual([0.2]);
        expect(sigmoid(-1000)).toBe(0); expect(sigmoid(1000)).toBe(1);
    });
    test('拒绝非法维度、非有限输入与非法初始状态', () => {
        expect(() => rnnForward([[NaN]], teachingExample().rnn)).toThrow();
        expect(() => rnnForward([[1, 2]], teachingExample().rnn)).toThrow();
        expect(() => lstmForward([[1]], { ...teachingExample().lstm, b: [0] })).toThrow();
        expect(() => scalarSensitivity([0], Infinity)).toThrow();
        expect(() => rnnForward([], teachingExample().rnn, [1, 2])).toThrow();
    });
});
