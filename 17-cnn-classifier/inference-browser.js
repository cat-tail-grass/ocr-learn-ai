'use strict';

const tf = require('@tensorflow/tfjs');
const {
  prepareDigit,
  predictDigit,
  mnistToImage,
  augmentDigit,
  inspectDigitFeatures,
  createDigitModel,
  crossEntropyComparison,
  inspectDropout
} = require('../shared/17-cnn-classifier');
function bindInference() {
  const canvas = document.getElementById('input');
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true
  });
  const output = document.getElementById('output');
  const classify = document.getElementById('classify');
  let model,
    modelId,
    exactSample = null;
  let drawing = false,
    samples = [],
    sampleIndex = 0;
  const show = value => {
    output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  };
  function clear() {
    exactSample = null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    document.getElementById('features').replaceChildren();
    document.getElementById('probabilities').replaceChildren();
    document.getElementById('prepared').getContext('2d').clearRect(0, 0, 28, 28);
    document.getElementById('preprocessing').textContent = '等待输入。';
    show('画一个数字或使用独立验证样本。');
  }
  function position(event) {
    const box = canvas.getBoundingClientRect();
    return [(event.clientX - box.left) * canvas.width / box.width, (event.clientY - box.top) * canvas.height / box.height];
  }
  canvas.addEventListener('pointerdown', event => {
    exactSample = null;
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const [x, y] = position(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    ctx.lineTo(x + 0.1, y);
    ctx.stroke();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drawing) return;
    const [x, y] = position(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  });
  canvas.addEventListener('pointerup', () => {
    drawing = false;
  });
  canvas.addEventListener('pointercancel', () => {
    drawing = false;
  });
  document.getElementById('clear').addEventListener('click', clear);
  function renderProbabilities(probabilities) {
    const container = document.getElementById('probabilities');
    container.replaceChildren();
    const table = document.createElement('table');
    const caption = document.createElement('caption');
    caption.textContent = '模型的十类 softmax 分数（不是照片正确率）';
    table.append(caption);
    probabilities.forEach((score, digit) => {
      const tr = document.createElement('tr');
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = digit;
      const visual = document.createElement('td');
      const meter = document.createElement('meter');
      meter.min = 0;
      meter.max = 1;
      meter.value = score;
      meter.setAttribute('aria-label', `数字 ${digit} 分数`);
      meter.style.width = '100%';
      visual.append(meter);
      const number = document.createElement('td');
      number.textContent = `${(100 * score).toFixed(3)}%`;
      tr.append(label, visual, number);
      table.append(tr);
    });
    container.append(table);
  }
  function renderFeatures(features) {
    const container = document.getElementById('features');
    container.replaceChildren();
    for (const feature of features) {
      const [, height, width, channels] = feature.shape;
      const group = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = `卷积 ${feature.layer}：${height}×${width}×${channels}`;
      const gallery = document.createElement('div');
      gallery.className = 'feature-gallery';
      for (let channel = 0; channel < 4; channel++) {
        const values = Array.from({
          length: height * width
        }, (_, i) => feature.values[i * channels + channel]);
        const max = Math.max(...values),
          min = Math.min(...values);
        const tile = document.createElement('figure'),
          preview = document.createElement('canvas');
        preview.width = width;
        preview.height = height;
        preview.style.width = '96px';
        preview.style.height = '96px';
        const data = new Uint8ClampedArray(width * height * 4);
        values.forEach((value, i) => {
          const light = Math.round(max > 0 ? 255 * value / max : 0);
          data.set([light, light, light, 255], i * 4);
        });
        preview.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
        const caption = document.createElement('figcaption');
        caption.textContent = `通道 ${channel}，${min.toFixed(2)}–${max.toFixed(2)}`;
        tile.append(preview, caption);
        gallery.append(tile);
      }
      group.append(heading, gallery);
      container.append(group);
    }
  }
  classify.addEventListener('click', async () => {
    classify.disabled = true;
    try {
      show('加载模型并推理……');
      await tf.ready();
      if (!model) {
        model = await tf.loadLayersModel('./model/model.json');
        modelId = model.getUserDefinedMetadata()?.modelId;
      }
      const source = exactSample || ctx.getImageData(0, 0, canvas.width, canvas.height);
      const angle = Number(document.getElementById('angle').value);
      const prepared = prepareDigit(angle ? augmentDigit(source, {
        angle
      }) : source);
      document.getElementById('prepared').getContext('2d').putImageData(new ImageData(prepared.imageData.data, 28, 28), 0, 0);
      document.getElementById('preprocessing').textContent = prepared.blank ? (prepared.blankReason === 'empty-after-resize' ? '缩放后为空白：原图有前景，但缩小采样后墨迹质量为 0，停止分类；请检查孤立噪点、裁剪或笔画分辨率。' : '空白：没有超过前景阈值 0.08 的像素，停止分类。') : `bbox=${JSON.stringify(prepared.bounds)}；28×28×1；背景 0 / 笔画 1；增强 ${angle}°；墨迹质量 ${prepared.pixels.reduce((a, b) => a + b, 0).toFixed(2)}`;
      const result = predictDigit(tf, model, prepared);
      renderProbabilities(result.probabilities);
      if (prepared.blank) document.getElementById('features').replaceChildren();else renderFeatures(inspectDigitFeatures(tf, model, prepared));
      const baseline = tf.memory().numTensors;
      for (let i = 0; i < 25; i++) predictDigit(tf, model, prepared);
      show({
        modelId,
        backend: tf.getBackend(),
        preprocessingId: prepared.preprocessingId,
        blank: result.blank,
        blankReason: prepared.blankReason ?? null,
        prediction: result.label,
        confidence: result.confidence,
        tensorsBefore25Predictions: baseline,
        tensorsAfter25Predictions: tf.memory().numTensors,
        note: '非数字或错误分割也可能高分；本页只接受单字符。'
      });
    } catch (error) {
      show(`识别失败：${error.message}`);
    } finally {
      classify.disabled = false;
    }
  });
  document.getElementById('sample').addEventListener('click', async () => {
    try {
      if (!samples.length) {
        const response = await fetch('./validation-samples.json');
        if (!response.ok) throw new Error('缺少验证样本，请运行 export-samples.js');
        samples = (await response.json()).samples;
      }
      const sample = samples[sampleIndex++ % samples.length];
      const image = mnistToImage(sample.pixels);
      const small = document.createElement('canvas');
      small.width = small.height = 28;
      small.getContext('2d').putImageData(new ImageData(image.data, 28, 28), 0, 0);
      clear();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
      // 展示放大不改变模型输入，避免画布缩放引入第二次采样。
      exactSample = image;
      show(`验证样本：原训练 IDX 索引 ${sample.originalIndex}；真值 ${sample.label}。点击识别查看结果。`);
    } catch (error) {
      show(error.message);
    }
  });
  document.getElementById('file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      clear();
      const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bitmap, (canvas.width - bitmap.width * scale) / 2, (canvas.height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
      bitmap.close();
      show('单字符图片已导入。整串照片请使用第 25 章。');
    } catch (error) {
      show(`图片无法解码：${error.message}`);
    }
  });
  document.getElementById('compare-numerics').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const result = document.getElementById('numeric-result');
    let fresh, legacy;
    try {
      await tf.ready();
      const extreme = document.getElementById('loss-case').value === 'extreme';
      const comparison = crossEntropyComparison(tf, extreme ? [1000, -1000, 0] : [2, 1, 0], extreme ? 1 : 0);
      fresh = createDigitModel(tf);
      legacy = createDigitModel(tf, { dropoutSeedPolicy: 'legacy-fixed' });
      const current = inspectDropout(tf, fresh);
      const historical = inspectDropout(tf, legacy);
      result.textContent = [
        `运行后端=${comparison.backend}；Layers 裁剪 ε≈${comparison.layers.clippingEpsilon.toExponential(2)}（通过零真类概率实测）`,
        `三类 logits=[${comparison.logits}]，真值索引=${comparison.target}`,
        `softmax=[${comparison.probabilities.map(v => v.toFixed(6)).join(', ')}]`,
        `Layers 概率损失=${comparison.layers.loss.toFixed(6)}，logits梯度=[${comparison.layers.gradient.map(v => v.toFixed(6)).join(', ')}]`,
        `Core logits损失=${comparison.fused.loss.toFixed(6)}，logits梯度=[${comparison.fused.gradient.map(v => v.toFixed(6)).join(', ')}]`,
        `新建默认：两次训练掩码${current.sameTrainingMask ? '相同' : '不同'}；推理保持输入：${current.inferenceUnchanged}`,
        `历史固定seed模式：两次训练掩码${historical.sameTrainingMask ? '相同' : '不同'}；推理保持输入：${historical.inferenceUnchanged}`,
        '掩码检查使用 8×32 个全1激活，仅调用层；没有训练或保存任何模型。'
      ].join('\n');
    } catch (error) {
      result.textContent = `对照失败：${error.message}`;
    } finally {
      if (fresh) fresh.dispose();
      if (legacy) legacy.dispose();
      button.disabled = false;
    }
  });
  async function renderReport() {
    try {
      const response = await fetch('./model/training-report.json');
      if (!response.ok) throw new Error('报告加载失败');
      const report = await response.json();
      document.getElementById('report-summary').textContent = `${report.modelId}；冻结测试 ${report.test.correct}/${report.test.count} = ${(100 * report.test.accuracy).toFixed(2)}%；照片未测量。`;
      const chart = document.getElementById('training-curve'),
        context = chart.getContext('2d');
      context.clearRect(0, 0, chart.width, chart.height);
      context.font = '14px sans-serif';
      const max = Math.max(...report.trainingCurve.map(row => row.loss));
      for (const [key, color, label, labelX] of [['loss', '#126451', '训练 loss（带增强/Dropout）', 20], ['validationLoss', '#b86b20', '验证 loss（无增强）', 350]]) {
        context.fillStyle = color;
        context.fillText(label, labelX, 24);
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.beginPath();
        report.trainingCurve.forEach((row, i) => {
          const x = 50 + i * 140,
            y = 220 - row[key] / max * 170;
          if (i === 0) context.moveTo(x, y);else context.lineTo(x, y);
        });
        context.stroke();
      }
      context.fillStyle = '#455c51';
      context.fillText(`纵轴：交叉熵 0–${max.toFixed(2)}；横轴 epoch 1 → 5，完整真实曲线`, 50, 250);
      const matrix = document.getElementById('confusion');
      matrix.replaceChildren();
      const header = document.createElement('tr');
      for (const text of ['真值↓ / 预测→', ...Array.from({
        length: 10
      }, (_, i) => i)]) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = text;
        header.append(th);
      }
      matrix.append(header);
      report.test.confusionMatrix.forEach((row, label) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = label;
        tr.append(th);
        row.forEach((count, prediction) => {
          const td = document.createElement('td');
          td.textContent = count;
          if (label === prediction) td.style.background = '#e8f2ed';else if (count) td.style.background = `rgba(190,100,40,${Math.min(0.7, 0.1 + count / 30)})`;
          tr.append(td);
        });
        matrix.append(tr);
      });
    } catch (error) {
      document.getElementById('report-summary').textContent = `${error.message}；可检查 model/training-report.json 是否存在。`;
    }
  }
  window.addEventListener('pagehide', () => {
    if (model) {
      model.dispose();
      model = null;
    }
  });
  clear();
  renderReport();
}
module.exports = {
  bindInference
};
