'use strict';

const {
  createMLP,
  forward,
  evaluate,
  train,
  gradientCheck,
  xorSamples,
  traceExample,
  activate,
  activationDerivative
} = require('../shared/14-neural-network-basics');
const $ = id => document.getElementById(id);
const samples = xorSamples();
let model;
let epoch = 0;
let history = [];
let running = false;
let stopRequested = false;
let initialPredictions = [];
function tableRow(values) {
  const row = document.createElement('tr');
  values.forEach(v => {
    const cell = document.createElement('td');
    cell.textContent = v;
    row.append(cell);
  });
  return row;
}
function renderProbe() {
  try {
    if (!$('probe-x1').checkValidity() || !$('probe-x2').checkValidity()) {
      throw new Error('探针输入需要在 −2 到 2 之间');
    }
    const input = [Number($('probe-x1').value), Number($('probe-x2').value)];
    const result = forward(model, input);
    $('probe-output').textContent = [`输入 [${input.join(', ')}]`, ...result.preActivations.map((z, l) => `第${l + 1}层 z=[${Array.from(z, v => v.toFixed(6)).join(', ')}]\n第${l + 1}层 ${l === model.layers.length - 1 ? 'logit' : 'a'}=[${Array.from(result.activations[l + 1], v => v.toFixed(6)).join(', ')}]`), `P(y=1)=${result.probability.toFixed(6)}`].join('\n');
  } catch (error) {
    $('probe-output').textContent = error.message;
  }
}
function renderActivation() {
  const z = Number($('activation-z').value);
  $('activation-caption').textContent = `激活输入 z=${z.toFixed(1)}：同时比较输出与导数`;
  $('activation-values').replaceChildren(...['sigmoid', 'tanh', 'relu'].map(name => tableRow([name, activate(z, name).toFixed(6), activationDerivative(z, name).toFixed(6)])));
}
function setStatus(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}
function plotLoss() {
  const canvas = $('loss-plot');
  const ctx = canvas.getContext('2d');
  const left = 64,
    top = 24,
    width = canvas.width - 90,
    height = canvas.height - 72;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const maxLoss = Math.max(0.1, ...history.map(p => p.loss)) * 1.1;
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#52635b';
  ctx.strokeStyle = '#d9e4de';
  for (let i = 0; i <= 4; i++) {
    const y = top + i * height / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + width, y);
    ctx.stroke();
    ctx.fillText((maxLoss * (1 - i / 4)).toFixed(3), 10, y + 4);
  }
  ctx.fillText('0', left, top + height + 25);
  ctx.fillText(`${epoch} 次更新`, left + width - 95, top + height + 25);
  ctx.strokeStyle = '#126451';
  ctx.lineWidth = 2;
  ctx.beginPath();
  history.forEach((p, i) => {
    const x = left + p.epoch / Math.max(1, epoch) * width;
    const y = top + (1 - p.loss / maxLoss) * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  canvas.setAttribute('aria-label', `共 ${epoch} 次更新，当前平均损失 ${history.at(-1).loss.toFixed(6)}`);
}
function plotDecision() {
  const canvas = $('decision-plot');
  const ctx = canvas.getContext('2d');
  const left = 52,
    top = 18,
    size = 252,
    steps = 36;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < steps; y++) {
    for (let x = 0; x < steps; x++) {
      const p = forward(model, [-0.25 + (x + 0.5) * 1.5 / steps, 1.25 - (y + 0.5) * 1.5 / steps]).probability;
      ctx.fillStyle = `rgb(${Math.round(244 - 208 * p)},${Math.round(248 - 126 * p)},${Math.round(235 - 144 * p)})`;
      ctx.fillRect(left + x * size / steps, top + y * size / steps, size / steps + 1, size / steps + 1);
    }
  }
  ctx.font = '13px sans-serif';
  samples.forEach(sample => {
    const x = left + (sample.input[0] + 0.25) / 1.5 * size;
    const y = top + (1.25 - sample.input[1]) / 1.5 * size;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#172b39';
    ctx.stroke();
    ctx.fillStyle = '#172b39';
    ctx.fillText(String(sample.target), x - 4, y + 4);
  });
  ctx.fillStyle = '#52635b';
  ctx.fillText('−0.25', left - 12, top + size + 23);
  ctx.fillText('1.25', left + size - 13, top + size + 23);
  ctx.fillText('x₁', left + size + 24, top + size + 23);
  ctx.fillText('1.25', 12, top + 6);
  ctx.fillText('x₂', 15, top + 31);
  ctx.fillText('−0.25', 6, top + size);
}
function render() {
  const result = evaluate(model, samples);
  $('prediction-table').replaceChildren(...result.predictions.map((p, i) => tableRow([p.input.join(', '), p.target, initialPredictions[i].probability.toFixed(6), p.probability.toFixed(6), p.predicted])));
  plotLoss();
  plotDecision();
  renderProbe();
  setStatus(`结构 ${model.sizes.join(' → ')} · 隐藏激活 ${model.activation} · 更新 ${epoch} 次 · 平均损失 ${result.loss.toFixed(6)} · 四点拟合率 ${(result.accuracy * 100).toFixed(0)}%`);
}
function reset() {
  if (!$('seed').checkValidity()) {
    throw new Error('种子应为 0 到 4294967295 的整数');
  }
  model = createMLP({
    seed: Number($('seed').value),
    activation: $('activation').value,
    sizes: $('architecture').value === 'linear' ? [2, 1] : [2, 4, 1]
  });
  epoch = 0;
  history = [{
    epoch,
    loss: evaluate(model, samples).loss
  }];
  initialPredictions = evaluate(model, samples).predictions;
  $('gradient-report').textContent = '当前参数尚未检查。';
  render();
}
function busy(value) {
  running = value;
  ['architecture', 'activation', 'seed', 'learning-rate', 'epsilon', 'reset', 'check', 'step', 'train'].forEach(id => {
    $(id).disabled = value;
  });
  $('stop').disabled = !value;
}
async function run(count) {
  if (running) {
    return;
  }
  if (!$('learning-rate').checkValidity() || Number($('learning-rate').value) <= 0) {
    setStatus('学习率应为 0.001 到 10 的正数', true);
    return;
  }
  busy(true);
  stopRequested = false;
  try {
    for (let completed = 0; completed < count && !stopRequested;) {
      const chunk = Math.min(100, count - completed);
      const result = train(model, samples, {
        epochs: chunk,
        learningRate: Number($('learning-rate').value),
        recordEvery: chunk
      });
      epoch += chunk;
      completed += chunk;
      history.push({
        epoch,
        loss: result.loss
      });
      render();
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    if (stopRequested) {
      setStatus(`${$('status').textContent} · 已停止，可继续训练`);
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    busy(false);
  }
}
$('reset').addEventListener('click', () => {
  try {
    reset();
  } catch (error) {
    setStatus(error.message, true);
  }
});
$('step').addEventListener('click', () => run(1));
$('train').addEventListener('click', () => run(5000));
$('stop').addEventListener('click', () => {
  stopRequested = true;
});
$('check').addEventListener('click', () => {
  try {
    const result = gradientCheck(model, samples, {
      epsilon: Number($('epsilon').value)
    });
    $('gradient-report').textContent = [`检查 ${result.parameterCount} 个参数：${result.passed ? '通过' : '未通过（ReLU 需检查是否跨越零点）'}`, `最大绝对误差 ${result.maxAbsError.toExponential(3)}；最大相对误差 ${result.maxRelativeError.toExponential(3)}`, '参数 | 解析梯度 | 数值梯度 | 绝对误差', ...result.entries.map(e => `${e.parameter} | ${e.analytical.toExponential(5)} | ${e.numerical.toExponential(5)} | ${e.absError.toExponential(2)}`)].join('\n');
    $('gradient-report').parentElement.open = true;
    setStatus(`梯度检查${result.passed ? '通过' : '未通过'}：${result.parameterCount} 个参数，最大绝对误差 ${result.maxAbsError.toExponential(3)}`);
  } catch (error) {
    setStatus(error.message, true);
  }
});
$('probe').addEventListener('click', renderProbe);
$('activation-z').addEventListener('input', renderActivation);
renderActivation();
const trace = traceExample();
$('trace').textContent = JSON.stringify({
  hiddenZ: trace.cache.preActivations[0],
  hiddenA: trace.cache.activations[1],
  logit: trace.cache.logit,
  probability: trace.cache.probability,
  lossBefore: trace.loss,
  gradients: trace.gradients,
  updatedLayers: trace.after.layers,
  lossAfter: trace.afterLoss
}, (_, value) => ArrayBuffer.isView(value) ? Array.from(value) : value, 2);
try {
  reset();
} catch (error) {
  setStatus(error.message, true);
}
