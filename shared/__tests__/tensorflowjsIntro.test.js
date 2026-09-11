'use strict';

const tf = require('@tensorflow/tfjs');
const {
  tensorArithmetic,
  runLinearExperiment,
  captureModel,
  reloadModel,
  predictValues
} = require('../16-tensorflowjs-intro');
beforeAll(async () => {
  await tf.setBackend('cpu');
  await tf.ready();
});
test('区分矩阵乘法/逐元素乘法，广播和真实自动微分', () => {
  const baseline = tf.memory().numTensors;
  expect(tensorArithmetic(tf)).toEqual({
    shape: [2, 2],
    product: [[4, 4], [10, 8]],
    elementwise: [[2, 0], [3, 8]],
    broadcast: [[11, 22], [13, 24]],
    gradient: [[2, 4], [6, 8]]
  });
  expect(tf.memory().numTensors).toBe(baseline);
});
test('框架真实训练收敛、序列化保留权重、反复推理不泄露张量', async () => {
  const baseline = tf.memory().numTensors;
  const trained = await runLinearExperiment(tf);
  expect(trained.history.at(-1).loss).toBeLessThan(1e-8);
  expect(trained.prediction).toBeCloseTo(5, 3);
  const artifacts = await captureModel(tf, trained.model);
  trained.model.dispose();
  trained.model.optimizer.dispose();
  const loaded = await reloadModel(tf, artifacts),
    before = tf.memory().numTensors;
  for (let i = 0; i < 30; i++) expect(predictValues(tf, loaded, [-2, 0, 2])[2]).toBeCloseTo(trained.prediction, 6);
  expect(tf.memory().numTensors).toBe(before);
  loaded.dispose();
  expect(tf.memory().numTensors).toBe(baseline);
});
test('拒绝无效训练参数与非有限推理值', async () => {
  await expect(runLinearExperiment(tf, {
    epochs: 0
  })).rejects.toThrow();
  expect(() => predictValues(tf, {}, [NaN])).toThrow();
});

test('1轮fit日志保留更新前MSE=3，最终参数的重新评估为2.26', async () => {
  const baseline = tf.memory().numTensors;
  const trained = await runLinearExperiment(tf, { epochs: 1, learningRate: 0.1 });
  try {
    expect(trained.history[0].loss).toBeCloseTo(3, 6);
    expect(trained.learned.weight).toBeCloseTo(0.2, 6);
    expect(trained.learned.bias).toBeCloseTo(0.2, 6);
    // 独立手算：残差 [1,0.1,-0.8,-1.7,-2.6] 的平方均值。
    expect(trained.finalLoss).toBeCloseTo((1 + 0.01 + 0.64 + 2.89 + 6.76) / 5, 6);
    expect(trained.finalLoss).not.toBeCloseTo(trained.history[0].loss, 1);
  } finally {
    trained.model.dispose();
    trained.model.optimizer.dispose();
  }
  expect(tf.memory().numTensors).toBe(baseline);
});

test('异步训练回调失败后，模型、外部优化器和训练数据都释放', async () => {
  const baseline = tf.memory().numTensors;
  await expect(runLinearExperiment(tf, {
    epochs: 2,
    onEpochEnd() { throw new Error('可重复的回调失败'); }
  })).rejects.toThrow('可重复的回调失败');
  expect(tf.memory().numTensors).toBe(baseline);
});

test('自动微分第一步与手算梯度、不同学习率严格对应', () => {
  const { firstGradientStep } = require('../16-tensorflowjs-intro');
  const before = tf.memory().numTensors;
  expect(firstGradientStep(tf, 0.1)).toEqual({loss:3,dw:-2,db:-2,learningRate:0.1,nextWeight:0.2,nextBias:0.2});
  expect(firstGradientStep(tf, 0.01).nextWeight).toBeCloseTo(0.02);
  expect(tf.memory().numTensors).toBe(before);
});
