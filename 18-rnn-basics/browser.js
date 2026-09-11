'use strict';
const { teachingExample, rnnForward, lstmForward, bidirectionalRnn, scalarSensitivity } = require('../shared/18-rnn-basics');
const $ = id => document.getElementById(id);

function draw(values) {
    const canvas = $('state-plot'), ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#f5f7fc'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a7b5c8'; ctx.beginPath(); ctx.moveTo(20, h / 2); ctx.lineTo(w - 20, h / 2); ctx.stroke();
    for (const [key, color] of [['rnn', '#2563eb'], ['lstm', '#d97706']]) {
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
        values.forEach((row, i) => { const x = 25 + i * (w - 50) / Math.max(1, values.length - 1), y = h / 2 - row[key] * (h / 2 - 20);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
    }
}

function run() {
    try {
        const parts = $('inputs').value.split(',').map(x => x.trim());
        if (parts.length > 40 || parts.some(x => !x || !Number.isFinite(Number(x)))) throw new Error('请输入1–40个逗号分隔的有限数字');
        const inputs = parts.map(x => [Number(x)]), { rnn, lstm } = teachingExample();
        rnn.Wh = [[Number($('weight').value)]]; $('weight-value').textContent = rnn.Wh[0][0].toFixed(2);
        lstm.b[1] = Number($('forget-bias').value);
        $('forget-value').textContent = lstm.b[1].toFixed(1);
        const a = rnnForward(inputs, rnn), b = lstmForward(inputs, lstm), bi = bidirectionalRnn(inputs, rnn, rnn);
        const body = $('states'); body.replaceChildren();
        inputs.forEach((x, t) => {
            const s = b.states[t], tr = document.createElement('tr');
            [t, x[0], a.states[t][0], s.gates.i[0], s.gates.f[0], s.gates.g[0], s.gates.o[0], s.c[0], s.h[0], bi.backward[t][0]].forEach(value => {
                const td = document.createElement('td'); td.textContent = Number(value).toFixed(4); tr.appendChild(td);
            }); body.appendChild(tr);
        });
        draw(inputs.map((_, t) => ({ rnn: a.states[t][0], lstm: b.states[t].h[0] })));
        const sensitivity = scalarSensitivity(Array(20).fill(0), rnn.Wh[0][0]);
        $('sensitivity').textContent = `20步零输入（t=0…19）、初始h₋₁=0：∂h₁₉/∂h₋₁ = ${sensitivity.derivative.toExponential(5)}。只改变循环权重，观察梯度消失或爆炸。`;
        const changed = inputs.map(x => x.slice()); changed[changed.length - 1][0] += 1;
        const changedBi = bidirectionalRnn(changed, rnn, rnn);
        $('comparison').textContent = `反事实对照：只把末帧输入增加1\n首帧前向 h：${bi.forward[0][0].toFixed(6)} → ${changedBi.forward[0][0].toFixed(6)}\n首帧反向 h：${bi.backward[0][0].toFixed(6)} → ${changedBi.backward[0][0].toFixed(6)}\n序列长度至少2时，首帧前向不受末帧扰动影响。`;
        $('status').textContent = `已计算 ${inputs.length} 步。蓝色 RNN，橙色 LSTM；表格保留三个门、候选和 cell 数值。`;
    } catch (error) {
        $('status').textContent = error.message;
        $('states').replaceChildren(); $('sensitivity').textContent = ''; $('comparison').textContent = '';
        const canvas = $('state-plot'); canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
}
$('run').addEventListener('click', run);
$('weight').addEventListener('input', run);
$('forget-bias').addEventListener('input', run);
$('reset').addEventListener('click', () => { $('inputs').value = '1,0,-1,1'; $('weight').value = '0.8'; $('forget-bias').value = '1'; run(); });
run();
