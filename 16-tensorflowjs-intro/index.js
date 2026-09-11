'use strict';

const tf = require('@tensorflow/tfjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {
  tensorArithmetic,
  runLinearExperiment,
  captureModel,
  reloadModel,
  predictValues,
  firstGradientStep
} = require('../shared/16-tensorflowjs-intro');
function heading(title) {
  console.log(`\n${'='.repeat(62)}\n${title}\n${'='.repeat(62)}`);
}
async function main({ outputDirectory = path.join(__dirname, 'artifacts') } = {}) {
  await tf.setBackend('cpu');
  await tf.ready();
  const baseline = tf.memory().numTensors;
  heading('实验 1：环境、张量形状与运算含义');
  console.log('版本 / 后端', tf.version.tfjs, tf.getBackend());
  const arithmetic = tensorArithmetic(tf);
  console.log('A=[[1,2],[3,4]]，B=[[2,0],[1,2]]；AB[0,0]=1×2+2×1=4');
  for (const key of ['product', 'elementwise', 'broadcast', 'gradient']) {
    console.log(key);
    console.table(arithmetic[key]);
  }
  assert.deepEqual(arithmetic.product, [[4, 4], [10, 8]]);
  heading('实验 2：将手算的一步 SGD 与自动微分对齐');
  console.log('x=[-1,-0.5,0,0.5,1]，y=2x+1；w=b=0 时 MSE=3，dw=db=-2');
  console.table([firstGradientStep(tf, 0.01), firstGradientStep(tf, 0.1)]);
  assert.equal(firstGradientStep(tf).dw, -2);
  heading('实验 3：学习率与训练轮数的真实对照');
  const comparisons = [];
  for (const config of [{
    epochs: 20,
    learningRate: 0.01
  }, {
    epochs: 20,
    learningRate: 0.1
  }, {
    epochs: 120,
    learningRate: 0.1
  }]) {
    const trial = await runLinearExperiment(tf, config);
    comparisons.push({
      ...config,
      ...trial.learned,
      lastBatchLossBeforeUpdate: trial.history.at(-1).loss,
      finalModelLoss: trial.finalLoss,
      predictionAt2: trial.prediction
    });
    trial.model.dispose();
    trial.model.optimizer.dispose();
  }
  console.table(comparisons);
  assert.ok(comparisons[2].finalModelLoss < comparisons[1].finalModelLoss);
  console.log('fit 的 loss 是更新前的批次损失；finalModelLoss 用完成训练后的参数重新评估。');
  heading('实验 4：观察训练曲线和批次外输入');
  const result = await runLinearExperiment(tf);
  console.table(result.history.filter(row => [1, 2, 10, 20, 60, 120].includes(row.epoch)));
  console.log('学习 y=2x+1', JSON.stringify({
    firstLoss: result.history[0].loss,
    lastBatchLossBeforeUpdate: result.history.at(-1).loss,
    finalModelLoss: result.finalLoss,
    x: 2,
    prediction: result.prediction,
    expected: 5
  }));
  const artifacts = await captureModel(tf, result.model),
    directory = outputDirectory;
  heading('实验 5：模型结构与权重分开保存，再重新加载');
  console.table(artifacts.weightSpecs);
  await fs.mkdir(directory, {
    recursive: true
  });
  await fs.writeFile(path.join(directory, 'weights.bin'), Buffer.from(artifacts.weightData));
  await fs.writeFile(path.join(directory, 'model.json'), JSON.stringify({
    format: 'layers-model',
    generatedBy: `TensorFlow.js ${tf.version.tfjs}`,
    modelTopology: artifacts.modelTopology,
    weightsManifest: [{
      paths: ['weights.bin'],
      weights: artifacts.weightSpecs
    }]
  }, null, 2));
  result.model.dispose();
  result.model.optimizer.dispose();
  const loaded = await reloadModel(tf, artifacts);
  console.log(`磁盘产物：${path.resolve(directory)}/model.json + weights.bin`);
  console.log('重新加载后 [-2,0,2] →', predictValues(tf, loaded, [-2, 0, 2]), '解析答案 [-3,1,5]');
  heading('实验 6：100 次推理与资源生命周期自检');
  const before = tf.memory().numTensors;
  const prediction = predictValues(tf, loaded, [2]);
  for (let i = 0; i < 100; i++) predictValues(tf, loaded, [0, 1, 2]);
  const after = tf.memory().numTensors;
  console.log('保存后加载', {
    prediction,
    repeats: 100,
    tensorsBefore: before,
    tensorsAfter: after
  });
  loaded.dispose();
  console.log('释放模型后', {
    baseline,
    final: tf.memory().numTensors
  });
  if (Math.abs(prediction[0] - 5) > 0.01 || before !== after || baseline !== tf.memory().numTensors) throw new Error('训练/加载/资源验证失败');
  console.log('全部自检通过。下一章把 Dense(1) 换成 CNN，将合成回归点换成独立划分的 MNIST。');
}
if (require.main === module) main({ outputDirectory: process.argv[2] ? path.resolve(process.argv[2]) : undefined }).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
module.exports = {
  main
};
