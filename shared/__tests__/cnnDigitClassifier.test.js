'use strict';

const tf = require('@tensorflow/tfjs');
const {
  prepareDigit,
  createDigitModel,
  mnistToImage,
  pixelsToImage,
  predictDigit,
  classificationReport,
  augmentDigit,
  shuffledIndices
} = require('../17-cnn-classifier');
const {
  parseImages,
  parseLabels,
  makeSplit,
  prepareSamples
} = require('../../17-cnn-classifier/data');
function rectangle(width, height, x, y, w, h) {
  const values = new Float32Array(width * height);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) values[yy * width + xx] = 1;
  return pixelsToImage(values, width, height);
}
beforeAll(async () => {
  await tf.setBackend('cpu');
  await tf.ready();
});
test('白图与完全透明的黑图必须为空白，不交给分类器胡猜', () => {
  const white = pixelsToImage(new Float32Array(784)),
    transparent = {
      width: 28,
      height: 28,
      data: new Uint8ClampedArray(3136)
    };
  for (const input of [white, transparent]) {
    const prepared = prepareDigit(input);
    expect(prepared.blank).toBe(true);
    expect(Array.from(prepared.pixels).every(x => x === 0)).toBe(true);
    expect(predictDigit(tf, {}, prepared).label).toBeNull();
  }
});
test('原图非空但强下采样丢光墨迹时拒识，保留bbox并跳过重心除零/模型', () => {
  const pixels = new Float32Array(100 * 100);
  pixels[0] = 1;
  pixels[pixels.length - 1] = 1;
  const prepared = prepareDigit(pixelsToImage(pixels, 100, 100));
  expect(prepared.bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  expect(prepared.pixels.every(v => v === 0)).toBe(true);
  expect(prepared.blank).toBe(true);
  expect(prepared.blankReason).toBe('empty-after-resize');
  const model = { predict: jest.fn(() => { throw new Error('空白不应调用模型'); }) };
  expect(predictDigit(tf, model, prepared).label).toBeNull();
  expect(model.predict).not.toHaveBeenCalled();
});
test('数据准备不能把空白图带数字标签继续送入训练', () => {
  expect(() => prepareSamples({ count: 1, pixels: new Uint8Array(784), labels: Uint8Array.of(3) }, [0])).toThrow(/样本 0.*空白/);
});
test('不同画布边距上的同一数字得到同一输入，瘦数字不拉成正方形', () => {
  const a = prepareDigit(rectangle(30, 40, 2, 4, 4, 20)),
    b = prepareDigit(rectangle(60, 80, 37, 52, 4, 20));
  expect(a.blank).toBe(false);
  expect(Array.from(a.pixels)).toEqual(Array.from(b.pixels));
  const xs = [],
    ys = [];
  a.pixels.forEach((v, i) => {
    if (v > 0.5) {
      xs.push(i % 28);
      ys.push(Math.floor(i / 28));
    }
  });
  expect(Math.max(...xs) - Math.min(...xs) + 1).toBe(4);
  expect(Math.max(...ys) - Math.min(...ys) + 1).toBe(20);
  expect(a.imageData.width).toBe(28);
});
test('训练数据走与照片推理完全一致的极性、灰度和裁剪函数', () => {
  const pixels = new Uint8Array(784);
  pixels.fill(128, 10 * 28 + 5, 10 * 28 + 20);
  const dataset = {
    count: 1,
    pixels,
    labels: Uint8Array.from([3])
  };
  const training = prepareSamples(dataset, [0]),
    inference = prepareDigit(mnistToImage(pixels));
  expect(Array.from(training.pixels)).toEqual(Array.from(inference.pixels));
  expect(training.labels[3]).toBe(1);
  expect(training.labels.reduce((a, b) => a + b)).toBe(1);
  expect(Math.max(...training.pixels)).toBe(1);
});
test('强度重心约在图心，透明度先与白背景合成', () => {
  const input = rectangle(28, 28, 8, 3, 5, 20);
  for (let i = 0; i < input.data.length; i += 4) input.data[i + 3] = 128;
  const result = prepareDigit(input);
  let mass = 0,
    cx = 0,
    cy = 0;
  result.pixels.forEach((v, i) => {
    mass += v;
    cx += i % 28 * v;
    cy += Math.floor(i / 28) * v;
  });
  expect(Math.abs(cx / mass - 13.5)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(cy / mass - 13.5)).toBeLessThanOrEqual(0.5);
});
test('零角度增强恒等；有限旋转保持有效输入；拒绝不合理增强', () => {
  const image = rectangle(28, 28, 8, 3, 5, 20);
  expect(augmentDigit(image).data).toEqual(image.data);
  expect(prepareDigit(augmentDigit(image, {
    angle: 8
  })).blank).toBe(false);
  expect(() => augmentDigit(image, {
    angle: 90
  })).toThrow();
});
test('模型维度和参数数正确，预测概率归一、重复推理张量不累积', () => {
  const baseline = tf.memory().numTensors,
    model = createDigitModel(tf);
  expect(model.countParams()).toBe(14538);
  expect(model.inputs[0].shape).toEqual([null, 28, 28, 1]);
  expect(model.outputs[0].shape).toEqual([null, 10]);
  const input = prepareDigit(rectangle(28, 28, 8, 3, 5, 20)),
    before = tf.memory().numTensors;
  for (let i = 0; i < 10; i++) {
    const p = predictDigit(tf, model, input);
    expect(p.probabilities.reduce((a, b) => a + b)).toBeCloseTo(1, 5);
  }
  expect(tf.memory().numTensors).toBe(before);
  model.dispose();
  expect(tf.memory().numTensors).toBe(baseline);
});
test('划分固定种子可复现、训练验证互斥、原始样本索引完整', () => {
  const a = makeSplit(30, {
      trainSize: 20,
      validationSize: 5,
      seed: 17
    }),
    b = makeSplit(30, {
      trainSize: 20,
      validationSize: 5,
      seed: 17
    });
  expect(a).toEqual(b);
  expect(new Set([...a.training, ...a.validation, ...a.unused]).size).toBe(30);
  expect(a.training.filter(i => a.validation.includes(i))).toHaveLength(0);
  expect(shuffledIndices(30, 18)).not.toEqual(shuffledIndices(30, 17));
  expect(() => makeSplit(5, {
    trainSize: 5,
    validationSize: 1
  })).toThrow();
});
test('IDX 严格读取大端魔数和长度，拒绝截断、错误标签', () => {
  const images = Buffer.alloc(16 + 784);
  images.writeUInt32BE(2051, 0);
  images.writeUInt32BE(1, 4);
  images.writeUInt32BE(28, 8);
  images.writeUInt32BE(28, 12);
  images[16] = 42;
  expect(parseImages(images).pixels[0]).toBe(42);
  expect(() => parseImages(images.subarray(0, -1))).toThrow();
  images.writeUInt32BE(2049, 0);
  expect(() => parseImages(images)).toThrow();
  const labels = Buffer.alloc(9);
  labels.writeUInt32BE(2049, 0);
  labels.writeUInt32BE(1, 4);
  labels[8] = 7;
  expect(parseLabels(labels).labels[0]).toBe(7);
  labels[8] = 10;
  expect(() => parseLabels(labels)).toThrow();
});
test('混淆矩阵行是真实类别，准确率和每类指标分母可手算', () => {
  const report = classificationReport([0, 0, 1, 1], [0, 1, 1, 1], 2);
  expect(report.confusionMatrix).toEqual([[1, 1], [0, 2]]);
  expect(report.accuracy).toBe(0.75);
  expect(report.perClass[1].precision).toBeCloseTo(2 / 3);
  expect(report.perClass[0].recall).toBe(0.5);
  expect(classificationReport([], []).accuracy).toBeNull();
  expect(() => classificationReport([10], [0])).toThrow();
});
test('拒绝尺寸、像素值和选项异常，而不是静默返回伪输入', () => {
  expect(() => prepareDigit({
    width: 2,
    height: 2,
    data: []
  })).toThrow();
  expect(() => prepareDigit({
    width: 1,
    height: 1,
    data: [NaN, 0, 0, 255]
  })).toThrow();
  expect(() => prepareDigit(rectangle(2, 2, 0, 0, 1, 1), {
    threshold: 0
  })).toThrow();
  expect(() => prepareDigit(rectangle(2, 2, 0, 0, 1, 1), {
    contentSize: 28
  })).toThrow();
});

test('真实卷积激活检查保持形状、有限值且不释放原模型或积累张量', () => {
  const { inspectDigitFeatures } = require('../17-cnn-classifier');
  const baseline = tf.memory().numTensors;
  const model = createDigitModel(tf);
  const prepared = prepareDigit(rectangle(28,28,8,3,5,20));
  const before = tf.memory().numTensors;
  for (let i=0;i<12;i++) {
    const features = inspectDigitFeatures(tf,model,prepared);
    expect(features.map(f=>f.shape)).toEqual([[1,12,12,8],[1,5,5,16]]);
    expect(features.map(f=>f.values.length)).toEqual([1152,400]);
    expect(features.every(f=>f.values.every(Number.isFinite))).toBe(true);
  }
  expect(predictDigit(tf,model,prepared).probabilities).toHaveLength(10);
  expect(tf.memory().numTensors).toBe(before);
  model.dispose();
  expect(tf.memory().numTensors).toBe(baseline);
});

test('新建模型的实际Dropout层每次训练重新采样，推理恒等且不积累张量', () => {
  const { inspectDropout } = require('../17-cnn-classifier');
  const baseline = tf.memory().numTensors;
  const model = createDigitModel(tf);
  try {
    const before = tf.memory().numTensors;
    const dropout = model.layers.find(layer => layer.getClassName() === 'Dropout');
    // 直接检验真正的层调用，不仅检查配置字符串或模拟随机数组。
    const result = tf.tidy(() => {
      const x = tf.ones([8, 32]);
      const first = Array.from(dropout.apply(x, { training: true }).dataSync());
      const second = Array.from(dropout.apply(x, { training: true }).dataSync());
      return { first, second, inference: Array.from(dropout.apply(x, { training: false }).dataSync()) };
    });
    expect(result.first).not.toEqual(result.second);
    expect(result.first.some(v => v === 0)).toBe(true);
    expect(result.first.some(v => Math.abs(v - 1 / 0.85) < 1e-6)).toBe(true);
    expect(result.inference).toEqual(Array(8 * 32).fill(1));
    expect(inspectDropout(tf, model).sameTrainingMask).toBe(false);
    const prepared = prepareDigit(rectangle(28, 28, 8, 3, 5, 20));
    expect(predictDigit(tf, model, prepared)).toEqual(predictDigit(tf, model, prepared));
    expect(tf.memory().numTensors).toBe(before);
  } finally {
    model.dispose();
  }
  expect(tf.memory().numTensors).toBe(baseline);
});

test('只有显式legacy配置重放历史固定掩码，非法策略在建模前拒绝', () => {
  const { inspectDropout } = require('../17-cnn-classifier');
  const baseline = tf.memory().numTensors;
  const model = createDigitModel(tf, { seed: 1701, dropoutSeedPolicy: 'legacy-fixed' });
  try {
    expect(inspectDropout(tf, model)).toMatchObject({ seed: 1704, sameTrainingMask: true, inferenceUnchanged: true });
  } finally {
    model.dispose();
  }
  expect(() => createDigitModel(tf, { dropoutSeedPolicy: 'typo' })).toThrow(/dropoutSeedPolicy/);
  expect(tf.memory().numTensors).toBe(baseline);
});

test('普通交叉熵对齐p-y，极端概率裁剪会失去该梯度，融合logits损失仍为2000', () => {
  const { crossEntropyComparison } = require('../17-cnn-classifier');
  const baseline = tf.memory().numTensors;
  const ordinary = crossEntropyComparison(tf, [2, 1, 0], 0);
  const expected = Math.log(1 + Math.exp(-1) + Math.exp(-2));
  expect(ordinary.layers.loss).toBeCloseTo(expected, 6);
  expect(ordinary.fused.loss).toBeCloseTo(expected, 6);
  ordinary.probabilities.forEach((p, i) => {
    expect(ordinary.layers.gradient[i]).toBeCloseTo(p - Number(i === 0), 6);
    expect(ordinary.fused.gradient[i]).toBeCloseTo(p - Number(i === 0), 6);
  });
  const extreme = crossEntropyComparison(tf, [1000, -1000, 0], 1);
  expect(extreme.layers.loss).toBeCloseTo(-Math.log(1e-7), 5);
  expect(extreme.layers.gradient).toEqual([0, 0, 0]);
  expect(extreme.fused.loss).toBe(2000);
  expect(extreme.fused.gradient).toEqual([1, -1, 0]);
  expect(tf.memory().numTensors).toBe(baseline);
});
