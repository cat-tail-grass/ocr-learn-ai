'use strict';

function vector(value, size, name) {
    if (!Array.isArray(value) || value.length !== size || Array.from(value).some(x => !Number.isFinite(x))) {
        throw new TypeError(`${name} 必须是长度 ${size} 的有限数值数组`);
    }
}

function matrix(value, rows, cols, name) {
    if (!Array.isArray(value) || value.length !== rows) throw new TypeError(`${name} 行数必须为 ${rows}`);
    for (const row of value) vector(row, cols, name);
}

function sigmoid(x) {
    if (!Number.isFinite(x)) throw new TypeError('sigmoid 输入必须有限');
    return x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
}

function affine(x, h, Wx, Wh, b) {
    const output = b.slice();
    for (let j = 0; j < b.length; j++) {
        for (let k = 0; k < x.length; k++) {
            output[j] += x[k] * Wx[k][j];
        }
        for (let k = 0; k < h.length; k++) {
            output[j] += h[k] * Wh[k][j];
        }
    }
    return output;
}

function dimensions(parameters, gates = 1) {
    const { Wx, Wh, b } = parameters || {};
    if (!Array.isArray(Wh) || !Wh.length || !Array.isArray(Wx) || !Wx.length) {
        throw new TypeError('Wx、Wh 必须为非空矩阵');
    }
    const D = Wx.length, H = Wh.length;
    matrix(Wx, D, gates * H, 'Wx');
    matrix(Wh, H, gates * H, 'Wh');
    vector(b, gates * H, 'b');
    return { D, H };
}

function rnnStep(x, h, parameters) {
    const { D, H } = dimensions(parameters);
    vector(x, D, 'x'); vector(h, H, 'h');
    return affine(x, h, parameters.Wx, parameters.Wh, parameters.b).map(Math.tanh);
}

function rnnForward(inputs, parameters, initialState) {
    const { D, H } = dimensions(parameters);
    if (!Array.isArray(inputs)) throw new TypeError('inputs 必须为时间步数组');
    for (const x of inputs) vector(x, D, 'inputs[t]');
    if (initialState !== undefined) vector(initialState, H, 'initialState');
    let h = initialState === undefined ? Array(H).fill(0) : initialState.slice();
    const states = [];
    for (const x of inputs) {
        h = rnnStep(x, h, parameters);
        states.push(h);
    }
    return { states, finalState: h };
}

// 合并参数的列顺序为 input、forget、candidate、output（i,f,g,o）。
function lstmStep(x, state, parameters) {
    const { D, H } = dimensions(parameters, 4);
    vector(x, D, 'x'); vector(state.h, H, 'h'); vector(state.c, H, 'c');
    const a = affine(x, state.h, parameters.Wx, parameters.Wh, parameters.b);
    const i = a.slice(0, H).map(sigmoid);
    const f = a.slice(H, 2 * H).map(sigmoid);
    const g = a.slice(2 * H, 3 * H).map(Math.tanh);
    const o = a.slice(3 * H).map(sigmoid);
    const c = state.c.map((v, j) => f[j] * v + i[j] * g[j]);
    const h = c.map((v, j) => o[j] * Math.tanh(v));
    return { h, c, gates: { i, f, g, o } };
}

function lstmForward(inputs, parameters, initialState) {
    const { D, H } = dimensions(parameters, 4);
    if (!Array.isArray(inputs)) throw new TypeError('inputs 必须为时间步数组');
    for (const x of inputs) vector(x, D, 'inputs[t]');
    let state = initialState || { h: Array(H).fill(0), c: Array(H).fill(0) };
    vector(state.h, H, 'initialState.h'); vector(state.c, H, 'initialState.c');
    const states = [];
    for (const x of inputs) {
        state = lstmStep(x, state, parameters);
        states.push(state);
    }
    return { states, finalState: { h: state.h.slice(), c: state.c.slice() } };
}

function bidirectionalRnn(inputs, forwardParameters, backwardParameters) {
    const forward = rnnForward(inputs, forwardParameters).states;
    const backward = rnnForward(inputs.slice().reverse(), backwardParameters).states.reverse();
    return { forward, backward, states: forward.map((h, t) => h.concat(backward[t])) };
}

// 一维 RNN 的 dh_{T-1}/dh_init，h_init=h_{-1}；沿完整时间路径相乘。
function scalarSensitivity(inputs, recurrentWeight, inputWeight = 1, initialState = 0) {
    if (![recurrentWeight, inputWeight, initialState].every(Number.isFinite) || !Array.isArray(inputs)
        || Array.from(inputs).some(x => !Number.isFinite(x))) throw new TypeError('灵敏度实验需要有限数值');
    let h = initialState, derivative = 1;
    const trace = inputs.map(x => {
        h = Math.tanh(x * inputWeight + h * recurrentWeight);
        const localDerivative = (1 - h * h) * recurrentWeight;
        derivative *= localDerivative;
        return { h, localDerivative, derivative };
    });
    return { finalState: h, derivative, trace };
}

function teachingExample() {
    const inputs = [[1], [0], [-1], [1]];
    const rnn = { Wx: [[0.5]], Wh: [[0.8]], b: [0] };
    const lstm = { Wx: [[0, 0, 1, 0]], Wh: [[0, 0, 0, 0]], b: [0, 1, 0, 0] };
    return { inputs, rnn, lstm };
}

module.exports = { sigmoid, rnnStep, rnnForward, lstmStep, lstmForward, bidirectionalRnn, scalarSensitivity, teachingExample };
