'use strict';

const PREPROCESSING = Object.freeze({
  id: 'dark-rgba-bbox20-centroid-v1',
  width: 28,
  height: 28,
  foreground: 1,
  background: 0,
  threshold: 0.08,
  contentSize: 20,
  centering: 'intensity-centroid-rounded',
  interpolation: 'bilinear'
});
function randomGenerator(seed = 1701) {
  if (!Number.isInteger(seed)) {
    throw new TypeError('seed 必须为整数');
  }
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffledIndices(count, seed = 1701) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('count 必须为非负整数');
  }
  const a = Array.from({
      length: count
    }, (_, i) => i),
    random = randomGenerator(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function validateImage(image) {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || !image.data || image.data.length !== image.width * image.height * 4) {
    throw new TypeError('需要有效的 RGBA imageData');
  }
  for (const v of image.data) {
    if (!Number.isFinite(v) || v < 0 || v > 255) {
      throw new RangeError('RGBA 必须在 0–255');
    }
  }
}
function sampleBilinear(pixels, width, height, x, y) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y),
    dx = x - x0,
    dy = y - y0;
  const at = (xx, yy) => xx < 0 || yy < 0 || xx >= width || yy >= height ? 0 : pixels[yy * width + xx];
  return at(x0, y0) * (1 - dx) * (1 - dy) + at(x0 + 1, y0) * dx * (1 - dy) + at(x0, y0 + 1) * (1 - dx) * dy + at(x0 + 1, y0 + 1) * dx * dy;
}
function pixelsToImage(pixels, width = 28, height = 28) {
  if (!pixels || pixels.length !== width * height) {
    throw new RangeError('像素长度与尺寸不匹配');
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    const g = Math.round(255 * (1 - pixels[i]));
    data.set([g, g, g, 255], i * 4);
  }
  return {
    width,
    height,
    data
  };
}

/** 输入浅背景深色 RGBA，输出 NHWC 单样本的 784 个前景强度。纯 JS，无 DOM/tf 依赖。 */
function prepareDigit(image, options = {}) {
  validateImage(image);
  const threshold = options.threshold ?? PREPROCESSING.threshold,
    contentSize = options.contentSize ?? PREPROCESSING.contentSize;
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
    throw new RangeError('threshold 必须在 (0,1)');
  }
  if (!Number.isInteger(contentSize) || contentSize < 1 || contentSize > 24) {
    throw new RangeError('contentSize 必须为 1–24 整数');
  }
  const {
      width,
      height,
      data
    } = image,
    ink = new Float32Array(width * height);
  let max = 0,
    x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let i = 0; i < ink.length; i++) {
    const o = i * 4,
      a = data[o + 3] / 255;
    ink[i] = (1 - (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255) * a;
    max = Math.max(max, ink[i]);
    if (ink[i] > threshold) {
      const x = i % width,
        y = Math.floor(i / width);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const pixels = new Float32Array(784);
  if (x1 < x0) {
    return {
      pixels,
      imageData: pixelsToImage(pixels),
      blank: true,
      blankReason: 'no-foreground',
      bounds: null,
      preprocessingId: PREPROCESSING.id
    };
  }
  // 除峰值保留灰度层次；固定 bbox 阈值不负责校正灰纸或阴影背景。
  for (let i = 0; i < ink.length; i++) {
    ink[i] /= max;
  }
  const cropW = x1 - x0 + 1,
    cropH = y1 - y0 + 1,
    scale = contentSize / Math.max(cropW, cropH);
  const w = Math.max(1, Math.round(cropW * scale)),
    h = Math.max(1, Math.round(cropH * scale));
  const left = Math.floor((28 - w) / 2),
    top = Math.floor((28 - h) / 2);
  let mass = 0,
    momentX = 0,
    momentY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 + Math.max(0, Math.min(cropW - 1, (x + 0.5) * cropW / w - 0.5));
      const sy = y0 + Math.max(0, Math.min(cropH - 1, (y + 0.5) * cropH / h - 0.5));
      const value = sampleBilinear(ink, width, height, sx, sy),
        xx = x + left,
        yy = y + top;
      pixels[yy * 28 + xx] = value;
      mass += value;
      momentX += xx * value;
      momentY += yy * value;
    }
  }
  // 原图存在墨迹，不保证点采样缩小后仍有墨迹。质量为零时不能求重心，
  // 也不能把全零输入交给 softmax 后解释为识别结果。
  if (mass === 0) {
    return {
      pixels,
      imageData: pixelsToImage(pixels),
      blank: true,
      blankReason: 'empty-after-resize',
      bounds: { x: x0, y: y0, width: cropW, height: cropH },
      preprocessingId: PREPROCESSING.id
    };
  }
  const dx = Math.max(-left, Math.min(28 - left - w, Math.round(13.5 - momentX / mass)));
  const dy = Math.max(-top, Math.min(28 - top - h, Math.round(13.5 - momentY / mass)));
  if (dx || dy) {
    const copy = pixels.slice();
    pixels.fill(0);
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 28; x++) {
        const xx = x + dx,
          yy = y + dy;
        if (xx >= 0 && xx < 28 && yy >= 0 && yy < 28) {
          pixels[yy * 28 + xx] = copy[y * 28 + x];
        }
      }
    }
  }
  return {
    pixels,
    imageData: pixelsToImage(pixels),
    blank: false,
    bounds: {
      x: x0,
      y: y0,
      width: cropW,
      height: cropH
    },
    preprocessingId: PREPROCESSING.id
  };
}
function mnistToImage(bytes) {
  if (!bytes || bytes.length !== 784) {
    throw new RangeError('MNIST 样本必须为 784 字节');
  }
  return pixelsToImage(Float32Array.from(bytes, v => v / 255));
}
/** 原图强度上旋转，再重新走 prepareDigit；验证与测试不得增强。 */
function augmentDigit(image, options = {}) {
  validateImage(image);
  const angle = options.angle ?? 0,
    stretchX = options.stretchX ?? 1;
  if (!Number.isFinite(angle) || Math.abs(angle) > 30 || !Number.isFinite(stretchX) || stretchX < 0.7 || stretchX > 1.3) {
    throw new RangeError('增强限制：角度 ±30°、横向比例 0.7–1.3');
  }
  const {
      width,
      height,
      data
    } = image,
    ink = new Float32Array(width * height);
  for (let i = 0; i < ink.length; i++) {
    ink[i] = (1 - data[4 * i] / 255) * data[4 * i + 3] / 255;
  }
  const out = new Float32Array(ink.length),
    rad = angle * Math.PI / 180,
    c = Math.cos(rad),
    s = Math.sin(rad),
    cx = (width - 1) / 2,
    cy = (height - 1) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx,
        dy = y - cy;
      out[y * width + x] = sampleBilinear(ink, width, height, (c * dx + s * dy) / stretchX + cx, -s * dx + c * dy + cy);
    }
  }
  return pixelsToImage(out, width, height);
}
function createDigitModel(tf, options = {}) {
  const seed = options.seed ?? 1701;
  if (!Number.isInteger(seed)) {
    throw new TypeError('seed 必须为整数');
  }
  const dropoutSeedPolicy = options.dropoutSeedPolicy ?? 'resample';
  if (!['resample', 'legacy-fixed'].includes(dropoutSeedPolicy)) {
    throw new RangeError('dropoutSeedPolicy 必须为 resample 或 legacy-fixed');
  }
  const model = tf.sequential({
    name: 'ocr_digit_cnn_v1'
  });
  model.add(tf.layers.conv2d({
    inputShape: [28, 28, 1],
    filters: 8,
    kernelSize: 5,
    strides: 2,
    padding: 'valid',
    activation: 'relu',
    kernelInitializer: tf.initializers.glorotUniform({
      seed
    })
  }));
  model.add(tf.layers.conv2d({
    filters: 16,
    kernelSize: 3,
    strides: 2,
    padding: 'valid',
    activation: 'relu',
    kernelInitializer: tf.initializers.glorotUniform({
      seed: seed + 1
    })
  }));
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu',
    kernelInitializer: tf.initializers.glorotUniform({
      seed: seed + 2
    })
  }));
  model.add(tf.layers.dropout({
    rate: 0.15,
    // TF.js 4.22 的固定 seed 会使同形状调用重复同一个掩码。
    // 默认省略 seed，每次训练调用重新采样；legacy 仅重放历史配置。
    ...(dropoutSeedPolicy === 'legacy-fixed' ? { seed: seed + 3 } : {})
  }));
  model.add(tf.layers.dense({
    units: 10,
    activation: 'softmax',
    kernelInitializer: tf.initializers.glorotUniform({
      seed: seed + 4
    })
  }));
  return model;
}
function predictDigit(tf, model, prepared) {
  if (!prepared || !prepared.pixels || prepared.pixels.length !== 784) {
    throw new TypeError('需要 prepareDigit 返回值');
  }
  if (prepared.blank) {
    return {
      blank: true,
      label: null,
      confidence: null,
      probabilities: []
    };
  }
  for (const v of prepared.pixels) {
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new RangeError('pixels 必须在 0–1');
    }
  }
  const probabilities = tf.tidy(() => Array.from(model.predict(tf.tensor4d(prepared.pixels, [1, 28, 28, 1])).dataSync()));
  const label = probabilities.indexOf(Math.max(...probabilities));
  return {
    blank: false,
    label: String(label),
    confidence: probabilities[label],
    probabilities
  };
}
function classificationReport(truth, predictions, classes = 10) {
  if (!Array.isArray(truth) || !Array.isArray(predictions) || truth.length !== predictions.length || !Number.isInteger(classes) || classes < 1) {
    throw new TypeError('真实标签、预测标签需为等长数组');
  }
  const confusionMatrix = Array.from({
    length: classes
  }, () => Array(classes).fill(0));
  let correct = 0;
  truth.forEach((label, i) => {
    const prediction = predictions[i];
    if (!Number.isInteger(label) || !Number.isInteger(prediction) || label < 0 || label >= classes || prediction < 0 || prediction >= classes) {
      throw new RangeError('标签超出类别范围');
    }
    confusionMatrix[label][prediction]++;
    if (label === prediction) {
      correct++;
    }
  });
  return {
    count: truth.length,
    correct,
    accuracy: truth.length ? correct / truth.length : null,
    confusionMatrix,
    perClass: confusionMatrix.map((row, label) => {
      const support = row.reduce((a, b) => a + b, 0),
        predicted = confusionMatrix.reduce((n, r) => n + r[label], 0);
      return {
        label,
        support,
        correct: row[label],
        recall: support ? row[label] / support : null,
        precision: predicted ? row[label] / predicted : null
      };
    })
  };
}
function inspectDigitFeatures(tf, model, prepared) {
  if (!prepared || prepared.blank || !prepared.pixels || prepared.pixels.length !== 784) {
    throw new TypeError('需要非空白的 prepareDigit 结果');
  }
  return tf.tidy(() => {
    const input = tf.tensor4d(prepared.pixels, [1, 28, 28, 1]);
    const first = model.layers[0].apply(input),
      second = model.layers[1].apply(first);
    return [first, second].map((value, index) => ({
      layer: index + 1,
      shape: value.shape,
      values: Array.from(value.dataSync())
    }));
  });
}
// 三类小实验可独立于已训练模型运行。Layers 概率损失与 Core logits
// 损失在极端置信度处不是同一个数值函数，不能共用无条件的 p-y 结论。
function crossEntropyComparison(tf, logits = [2, 1, 0], target = 0) {
  if (!Array.isArray(logits) || logits.length < 2 || logits.some(v => !Number.isFinite(v)) || !Number.isInteger(target) || target < 0 || target >= logits.length) {
    throw new RangeError('需要至少两类有限 logits 和合法目标索引');
  }
  return tf.tidy(() => {
    const z = tf.tensor2d([logits]);
    const y = tf.tensor2d([logits.map((_, i) => Number(i === target))]);
    // 从完全错开的 one-hot 概率探测实际裁剪值，避免把 CPU 的 1e-7
    // 硬编码成所有后端的行为。Layers 会缓存首次使用的后端 epsilon。
    const wrongProbability = tf.tensor2d([logits.map((_, i) => Number(i === (target + 1) % logits.length))]);
    const clippingEpsilon = Math.exp(-tf.metrics.categoricalCrossentropy(y, wrongProbability).dataSync()[0]);
    // tf.metrics.categoricalCrossentropy 复用 Layers 的同名损失实现。
    const layers = tf.valueAndGrad(values => tf.metrics.categoricalCrossentropy(y, tf.softmax(values)).mean())(z);
    const fused = tf.valueAndGrad(values => tf.losses.softmaxCrossEntropy(y, values))(z);
    return {
      backend: tf.getBackend(),
      logits: [...logits],
      target,
      probabilities: Array.from(tf.softmax(z).dataSync()),
      layers: { clippingEpsilon, loss: layers.value.dataSync()[0], gradient: Array.from(layers.grad.dataSync()) },
      fused: { loss: fused.value.dataSync()[0], gradient: Array.from(fused.grad.dataSync()) }
    };
  });
}
// 检查真实 Dropout 层，不训练也不改权重。重复掩码比较使用非零输入，
// 避免把隐藏激活本身的零误当成被 Dropout 丢弃。
function inspectDropout(tf, model) {
  const layer = model.layers.find(candidate => candidate.getClassName() === 'Dropout');
  if (!layer) throw new TypeError('模型缺少 Dropout 层');
  return tf.tidy(() => {
    const input = tf.ones([8, 32]);
    const first = Array.from(layer.apply(input, { training: true }).dataSync());
    const second = Array.from(layer.apply(input, { training: true }).dataSync());
    const inference = Array.from(layer.apply(input, { training: false }).dataSync());
    return {
      seed: layer.getConfig().seed ?? null,
      shape: [8, 32],
      sameTrainingMask: first.every((v, i) => v === second[i]),
      firstDropped: first.filter(v => v === 0).length,
      secondDropped: second.filter(v => v === 0).length,
      inferenceUnchanged: inference.every(v => v === 1)
    };
  });
}
module.exports = {
  PREPROCESSING,
  prepareDigit,
  createDigitModel,
  predictDigit,
  mnistToImage,
  pixelsToImage,
  augmentDigit,
  randomGenerator,
  shuffledIndices,
  classificationReport,
  inspectDigitFeatures,
  crossEntropyComparison,
  inspectDropout
};
