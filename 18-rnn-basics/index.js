'use strict';
/** 第18章：node 18-rnn-basics/index.js；六个可手算/自检的循环网络实验。 */
const { teachingExample, rnnForward, lstmForward, bidirectionalRnn, scalarSensitivity } = require('../shared/18-rnn-basics');
const assert = require('node:assert/strict');
const section = text => console.log(`\n【${text}】`);

function main() {
    const { inputs, rnn, lstm } = teachingExample();
    console.log('18 RNN / LSTM：参数为教学手设值，展示前向计算，不是已训练识别器。');
    section('1. 普通RNN逐步展开：输入项 + 历史项');
    const recurrent = rnnForward(inputs, rnn), gated = lstmForward(inputs, lstm);
    console.table(inputs.map((x, t) => ({ t, inputTerm: x[0] * 0.5,
        historyTerm: (t ? recurrent.states[t - 1][0] : 0) * 0.8,
        h: recurrent.states[t][0] })));
    assert.ok(Math.abs(recurrent.states[0][0] - Math.tanh(0.5)) < 1e-12);
    section('2. LSTM三个门、候选与cell：同一输入序列对比RNN');
    console.table(inputs.map((x, t) => ({ t, x: x[0], rnnH: recurrent.states[t][0],
        i: gated.states[t].gates.i[0], f: gated.states[t].gates.f[0],
        g: gated.states[t].gates.g[0], o: gated.states[t].gates.o[0], c: gated.states[t].c[0], lstmH: gated.states[t].h[0] })));
    section('3. 双向原位置对齐与未来输入扰动');
    const bi = bidirectionalRnn(inputs, rnn, rnn), changed = inputs.map(x => x.slice()); changed[3][0] += 1;
    const biChanged = bidirectionalRnn(changed, rnn, rnn);
    console.table(bi.states.map((h, t) => ({ t, forward: h[0], backward: h[1],
        forwardChange: biChanged.forward[t][0] - bi.forward[t][0], backwardChange: biChanged.backward[t][0] - bi.backward[t][0] })));
    assert.equal(bi.forward[0][0], biChanged.forward[0][0]);
    assert.notEqual(bi.backward[0][0], biChanged.backward[0][0]);
    section('4. 循环权重与饱和输入的梯度对照');
    console.table([0.5, 0.9, 1.2].map(w => ({ recurrentWeight: w,
        dh19dhInitial: scalarSensitivity(Array(20).fill(0), w).derivative,
        saturated: scalarSensitivity(Array(20).fill(4), w).derivative })));
    const epsilon = 1e-5, xs = [0.2, -0.1, 0.3], analytic = scalarSensitivity(xs, 0.8, 1, 0.1).derivative;
    const numerical = (scalarSensitivity(xs, 0.8, 1, 0.1 + epsilon).finalState - scalarSensitivity(xs, 0.8, 1, 0.1 - epsilon).finalState) / (2 * epsilon);
    console.log('中心差分自检', { analytic, numerical, error: Math.abs(analytic - numerical) });
    assert.ok(Math.abs(analytic - numerical) < 1e-7);
    section('5. 遗忘门参数如何影响20步记忆');
    console.table([-2, 0, 1, 3].map(bias => {
        const parameters = { Wx: [[0, 0, 0, 0]], Wh: [[0, 0, 0, 0]], b: [0, bias, 0, 0] };
        const result = lstmForward(Array.from({ length: 20 }, () => [0]), parameters, { h: [0], c: [1] });
        return { forgetBias: bias, forgetGate: 1 / (1 + Math.exp(-bias)), cellAfter20: result.finalState.c[0] };
    }));
    section('6. 失败输入与运行自检');
    assert.throws(() => rnnForward([[1, 2]], rnn));
    assert.throws(() => lstmForward([[NaN]], lstm));
    console.log('通过：首步手算、双向因果方向、梯度差分、非法维度与NaN拒绝。下一章：CTC对齐。');
}
if (require.main === module) main();
module.exports = { main };
