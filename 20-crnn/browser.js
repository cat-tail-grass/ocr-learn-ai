'use strict';
const tf = require('@tensorflow/tfjs');
const { createTinyCrnn, renderSyntheticLine, predictRows, cnnSequenceShape, trainTinyCrnn, imageBatch } = require('../shared/20-crnn');
const $ = id => document.getElementById(id);
let model, image, lastStages, drawing = false, brush = 1;

function invalidatePrediction() {
    lastStages = null;
    $('prediction').textContent = '';
    $('frames').textContent = '';
    $('selected-frame').textContent = '';
    $('frame-index').disabled = true;
    const canvas = $('features');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function showFrame() {
    if (!lastStages) return;
    const t = Number($('frame-index').value);
    $('frame-value').textContent = String(t);
    const format = values => values.map(x => x.toFixed(4)).join(', ');
    $('selected-frame').textContent = `t=${t}，按高度→通道展开的16维CNN特征\n[${format(lastStages.sequence.values[0][t])}]\n左→右LSTM h（8维）\n[${format(lastStages.forwardStates.values[0][t])}]\n右→左LSTM h（恢复原列序，8维）\n[${format(lastStages.backwardStates.values[0][t])}]`;
}

function showFeatures(stages) {
    lastStages = stages;
    $('frame-index').disabled = false;
    const canvas = $('features'), ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let c = 0; c < 4; c++) {
        ctx.fillStyle = '#25344a'; ctx.font = '13px sans-serif'; ctx.fillText(`通道 ${c} · 4行×10列`, 10, c * 70 + 14);
        for (let y = 0; y < 4; y++) {
            for (let t = 0; t < 10; t++) {
                const value = stages.pooled.values[0][y][t][c], pale = Math.round(255 * (1 - Math.abs(value)));
                ctx.fillStyle = value >= 0 ? `rgb(${pale},${pale},255)` : `rgb(255,${pale},${pale})`;
                ctx.fillRect(t * 60, c * 70 + 20 + y * 10, 59, 9);
            }
        }
    }
    showFrame();
}

function drawLoss(history) {
    const canvas = $('loss-plot'), ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!history.length) return;
    const max = Math.max(...history.map(x => x.loss), 0.01);
    const steps = Number($('steps').value);
    ctx.fillStyle = '#334155'; ctx.font = '12px sans-serif';
    ctx.fillText(`平均CTC损失，当前纵轴上限 ${max.toFixed(3)}`, 12, 13);
    ctx.fillText('0', 4, canvas.height - 5);
    ctx.fillText(`更新次数 → ${steps}`, canvas.width - 115, canvas.height - 5);
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3; ctx.beginPath();
    history.forEach((point, i) => {
        const x = 20 + point.step / steps * (canvas.width - 40), y = canvas.height - 20 - point.loss / max * (canvas.height - 40);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function paint() {
    const canvas = $('line'), ctx = canvas.getContext('2d'), size = canvas.width / image.width;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const value = Math.round(255 * (1 - image.pixels[y * image.width + x]));
        ctx.fillStyle = `rgb(${value},${value},${value})`; ctx.fillRect(x * size, y * size, size, size);
    }
    $('pixels').value = Array.from({ length: image.height }, (_, y) => Array.from(image.pixels.slice(y * image.width, (y + 1) * image.width)).map(v => v > 0.5 ? '1' : '0').join('')).join('\n');
}
function generate() {
    try { image = renderSyntheticLine($('text').value, { seed: Number($('seed').value) }); paint(); invalidatePrediction(); $('status').textContent = '已生成整行像素，点击识别。数字串输入仅用于绘图。'; }
    catch (error) { $('status').textContent = error.message; }
}
function recognize() {
    try {
        if (!model) throw new Error('模型尚未就绪');
        const result = predictRows(tf, model, [image])[0];
        const batch = imageBatch(tf, [image], model.config);
        try { showFeatures(model.inspect(batch)); } finally { batch.dispose(); }
        $('prediction').textContent = `Prefix beam：${result.prediction || '（空串）'}；贪婪：${result.greedy || '（空串）'}`;
        $('frames').textContent = result.probabilities.map((p, t) => `t=${String(t).padStart(2)}  blank=${p[0].toFixed(4)}  0=${p[1].toFixed(4)}  1=${p[2].toFixed(4)}`).join('\n');
        $('status').textContent = '已仅根据整行像素预测。手工改图后可再次识别；训练字形范围外可能失败。';
    } catch (error) { invalidatePrediction(); $('status').textContent = error.message; }
}
function busy(value) {
    for (const id of ['generate', 'recognize', 'train', 'clear', 'apply-pixels', 'steps', 'learning-rate']) {
        $(id).disabled = value;
    }
}
async function initialize() {
    busy(true); generate();
    $('dimensions').textContent = Object.entries(cnnSequenceShape()).map(([key, shape]) => `${key.padEnd(14)} [${shape.join(', ')}]`).join('\n');
    try {
        await tf.setBackend('cpu'); await tf.ready();
        const response = await fetch('model/weights.json');
        if (!response.ok) throw new Error('本章已训练权重未找到，请检查静态服务路径');
        const artifact = await response.json(); model = createTinyCrnn(tf, artifact.config); model.importWeights(artifact);
        $('status').textContent = `已加载本项目训练的 ${model.parameterCount} 参数完整小型 CRNN（TF.js ${tf.version.tfjs} / CPU）。`;
        recognize();
    } catch (error) { if (model) { model.dispose(); model = null; } $('status').textContent = error.message + '；可点击重新训练进行实验。'; }
    finally { busy(false); }
}
async function train() {
    busy(true); $('training').textContent = '从随机初始化重新训练；旧模型在训练完成后替换。\n';
    try {
        const steps = Number($('steps').value), learningRate = Number($('learning-rate').value), history = [];
        const result = await trainTinyCrnn(tf, { steps, learningRate, onProgress: item => {
            history.push(item); drawLoss(history);
            $('training').textContent += `${item.step}/${steps}：CTC=${item.loss.toFixed(6)}\n`;
            $('status').textContent = `正在更新 CNN、双向 LSTM 与输出层：${item.step}/${steps}`;
        } });
        if (model) model.dispose(); model = result.model;
        $('training').textContent += `合成验证：训练前 ${result.report.initialValidation.exactCorrect}/${result.report.initialValidation.count} → 训练后 ${result.report.validation.exactCorrect}/${result.report.validation.count}。\n训练集 ${result.report.train.exactCorrect}/${result.report.train.count}。不是手写照片评测。\n梯度核对误差 ${result.report.ctcGradientCheck.maxAbsoluteError.toExponential(2)}；卷积权重最大变化 ${result.report.maxConvolutionWeightChange.toFixed(5)}。`;
        recognize();
    } catch (error) { $('status').textContent = error.message; }
    finally { busy(false); }
}
$('generate').addEventListener('click', generate); $('recognize').addEventListener('click', recognize); $('train').addEventListener('click', train);
$('frame-index').addEventListener('input', showFrame);
$('clear').addEventListener('click', () => {
    image.pixels.fill(0); paint(); invalidatePrediction();
    $('status').textContent = '画布已清空；点击识别可观察空白图的模型输出。';
});
$('apply-pixels').addEventListener('click', () => {
    const rows = $('pixels').value.trim().split(/\s+/);
    if (rows.length !== 8 || rows.some(row => !/^[01]{20}$/.test(row))) { $('status').textContent = '请输入8行，每行20个0/1（1为笔画）'; return; }
    image = { height: 8, width: 20, pixels: Float32Array.from(rows.join(''), Number) }; paint(); recognize();
});
function edit(event) {
    if (!drawing || $('train').disabled) return;
    const rect = $('line').getBoundingClientRect(), x = Math.floor((event.clientX - rect.left) * 20 / rect.width), y = Math.floor((event.clientY - rect.top) * 8 / rect.height);
    if (x >= 0 && x < 20 && y >= 0 && y < 8) {
        image.pixels[y * 20 + x] = brush; paint(); invalidatePrediction();
        $('status').textContent = '像素已修改；请重新识别以计算当前图像的特征与输出。';
    }
}
$('line').addEventListener('pointerdown', event => { drawing = true; brush = event.shiftKey ? 0 : 1; $('line').setPointerCapture(event.pointerId); edit(event); });
$('line').addEventListener('pointermove', edit); $('line').addEventListener('pointerup', () => { drawing = false; });
$('line').addEventListener('pointercancel', () => { drawing = false; });
window.addEventListener('pagehide', () => { if (model) model.dispose(); });
initialize();
