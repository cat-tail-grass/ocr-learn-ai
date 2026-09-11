'use strict';

const tf = require('@tensorflow/tfjs');
const {
  tensorArithmetic,
  runLinearExperiment,
  captureModel,
  reloadModel,
  predictValues,
  firstGradientStep
} = require('../shared/16-tensorflowjs-intro');
const output = document.getElementById('output');
const button = document.getElementById('run');
function show(value) {
  output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
function drawLoss(history) {
  const canvas = document.getElementById('loss');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#455c51';
  ctx.fillText('更新前的批次 MSE（线性轴）；横轴为轮次', 16, 22);
  const max = Math.max(0.01, ...history.map(row => row.loss));
  ctx.fillText(max.toFixed(2), 8, 48);
  ctx.fillText('0', 16, 212);
  ctx.strokeStyle = '#dbe2df';
  ctx.beginPath();
  ctx.moveTo(48, 35);
  ctx.lineTo(48, 212);
  ctx.lineTo(650, 212);
  ctx.stroke();
  ctx.strokeStyle = '#126451';
  ctx.lineWidth = 2;
  ctx.beginPath();
  history.forEach((row, i) => {
    const x = 48 + 590 * i / Math.max(1, history.length - 1);
    const y = 210 - 165 * row.loss / max;
    if (i === 0) ctx.moveTo(x, y);else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillText(`${history.length} 轮；末批次损失 ${history.at(-1)?.loss.toExponential(3) || '待运行'}`, 270, 235);
}
function drawFit(weight = 0, bias = 0) {
  const canvas = document.getElementById('fit');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const xPixel = x => 60 + (x + 2) / 4 * 560;
  const yPixel = y => 205 - (y + 3) / 8 * 160;
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#455c51';
  ctx.fillText('黑点：训练数据；灰虚线：初始预测；绿色：训练后预测', 12, 22);
  ctx.strokeStyle = '#9da9a4';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(xPixel(-2), yPixel(0));
  ctx.lineTo(xPixel(2), yPixel(0));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#126451';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(xPixel(-2), yPixel(-2 * weight + bias));
  ctx.lineTo(xPixel(2), yPixel(2 * weight + bias));
  ctx.stroke();
  ctx.fillStyle = '#182b39';
  for (const x of [-1, -0.5, 0, 0.5, 1]) {
    ctx.beginPath();
    ctx.arc(xPixel(x), yPixel(2 * x + 1), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillText(`w=${weight.toFixed(5)}，b=${bias.toFixed(5)}；在 x=2 外推`, 220, 235);
  ctx.fillText('x=-2', 40, 230);
  ctx.fillText('x=2', 610, 230);
}
function renderArithmetic(arithmetic, step) {
  const container = document.getElementById('arithmetic');
  container.replaceChildren();
  for (const [name, values] of Object.entries(arithmetic)) {
    if (name === 'shape') continue;
    const card = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = name;
    const table = document.createElement('table');
    for (const row of values) {
      const tr = document.createElement('tr');
      for (const value of row) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      table.append(tr);
    }
    card.append(title, table);
    container.append(card);
  }
  document.getElementById('gradient').textContent = `初始 MSE=${step.loss}；dw=${step.dw}，db=${step.db}；η=${step.learningRate} → 一步之后 w=${step.nextWeight}，b=${step.nextBias}`;
}
button.addEventListener('click', async () => {
  button.disabled = true;
  let trained, loaded;
  try {
    show('正在检查后端并训练……');
    await tf.ready();
    const epochs = Number(document.getElementById('epochs').value);
    const learningRate = Number(document.getElementById('learning-rate').value);
    const baseline = tf.memory().numTensors;
    const arithmetic = tensorArithmetic(tf);
    renderArithmetic(arithmetic, firstGradientStep(tf, learningRate));
    const curve = [];
    trained = await runLinearExperiment(tf, {
      epochs,
      learningRate,
      onEpochEnd: async (epoch, logs) => {
        curve.push({
          epoch: epoch + 1,
          loss: logs.loss
        });
        if (epoch % 5 === 0 || epoch === epochs - 1) {
          show(`后端：${tf.getBackend()}；第 ${epoch + 1}/${epochs} 轮，更新前批次 MSE=${logs.loss.toExponential(5)}`);
          drawLoss(curve);
          await tf.nextFrame();
        }
      }
    });
    drawFit(trained.learned.weight, trained.learned.bias);
    const artifacts = await captureModel(tf, trained.model);
    loaded = await reloadModel(tf, artifacts);
    const predictions = predictValues(tf, loaded, [-2, 0, 2]);
    const before = tf.memory().numTensors;
    for (let i = 0; i < 100; i++) predictValues(tf, loaded, [2]);
    const after = tf.memory().numTensors;
    const summary = {
      backend: tf.getBackend(),
      version: tf.version.tfjs,
      epochs,
      learningRate,
      learned: trained.learned,
      lastBatchLossBeforeUpdate: trained.history.at(-1).loss,
      finalModelLoss: trained.finalLoss,
      inputs: [-2, 0, 2],
      expected: [-3, 1, 5],
      reloadedPredictions: predictions,
      serializedWeights: artifacts.weightSpecs,
      inferenceLoops: 100,
      tensorsBefore: before,
      tensorsAfter: after,
      baseline
    };
    trained.model.dispose();
    trained.model.optimizer.dispose();
    trained = null;
    loaded.dispose();
    loaded = null;
    summary.tensorsAfterDispose = tf.memory().numTensors;
    show(summary);
  } catch (error) {
    show(`运行失败：${error.message}`);
  } finally {
    if (trained) {
      trained.model.dispose();
      trained.model.optimizer.dispose();
    }
    if (loaded) loaded.dispose();
    button.disabled = false;
  }
});
document.getElementById('reset').addEventListener('click', () => {
  if (button.disabled) return;
  document.getElementById('epochs').value = '120';
  document.getElementById('learning-rate').value = '0.1';
  document.getElementById('arithmetic').replaceChildren();
  document.getElementById('gradient').textContent = '运行后显示真实自动微分的第一步。';
  drawLoss([]);
  drawFit();
  show('已恢复默认输入和初始模型示意。');
});
drawLoss([]);
drawFit();
