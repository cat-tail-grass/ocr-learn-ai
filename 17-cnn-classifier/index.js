'use strict';

const tf = require('@tensorflow/tfjs');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const {
  prepareDigit,
  mnistToImage,
  predictDigit,
  augmentDigit,
  classificationReport,
  inspectDigitFeatures,
  createDigitModel,
  crossEntropyComparison,
  inspectDropout
} = require('../shared/17-cnn-classifier');
const {
  loadModel
} = require('./model-io');
async function main() {
  await tf.setBackend('cpu');
  await tf.ready();
  const {
    model,
    metadata
  } = await loadModel(tf, path.join(__dirname, 'model'));
  try {
    const bundled = JSON.parse(await fs.readFile(path.join(__dirname, 'validation-samples.json'), 'utf8'));
    const dataset = {
      pixels: Uint8Array.from(bundled.samples.flatMap(sample => sample.pixels)),
      labels: bundled.samples.map(sample => Number(sample.label)),
      originalIndices: bundled.samples.map(sample => sample.originalIndex)
    };
    const report = JSON.parse(await fs.readFile(path.join(__dirname, 'model', 'training-report.json'), 'utf8'));
    const heading = title => console.log(`\n${'='.repeat(62)}\n${title}\n${'='.repeat(62)}`);
    heading('实验 1：真实模型来源、数据边界与维度');
    console.log('自主模型', metadata.modelId, '后端', tf.getBackend());
    console.log('55,000 训练 / 5,000 验证 / 10,000 原始测试；快速实验使用内置的10个验证样本，不需要下载全部原始数据。');
    console.table(model.layers.map(layer => ({
      layer: layer.getClassName(),
      output: JSON.stringify(layer.outputShape),
      parameters: layer.countParams()
    })));
    assert.equal(model.countParams(), 14538);
    heading('实验 2：原始字节 → 浅底 RGBA → 统一 28×28 前景强度');
    const firstImage = mnistToImage(dataset.pixels.subarray(0, 784)),
      first = prepareDigit(firstImage);
    console.log('验证样本原始索引', dataset.originalIndices[0], '真实标签', dataset.labels[0], '裁剪框', first.bounds, '输入版本', first.preprocessingId);
    for (let y = 0; y < 28; y++) console.log(Array.from(first.pixels.subarray(y * 28, (y + 1) * 28), v => v > 0.7 ? '██' : v > 0.2 ? '░░' : '  ').join(''));
    console.log('灰度值区间', Math.min(...first.pixels), Math.max(...first.pixels), '；字节总数', first.pixels.byteLength);
    heading('实验 3：真实卷积特征图的维度与激活统计');
    console.table(inspectDigitFeatures(tf, model, first).map(f => ({
      layer: f.layer,
      shape: f.shape.join('×'),
      min: Math.min(...f.values),
      max: Math.max(...f.values),
      positiveFraction: f.values.filter(v => v > 0).length / f.values.length
    })));
    heading('实验 4：增强改变输入形状，但仍调用同一归一化');
    console.table([-8, 0, 8].map(angle => {
      const prepared = prepareDigit(augmentDigit(firstImage, {
        angle
      }));
      return {
        angle,
        bounds: JSON.stringify(prepared.bounds),
        inkMass: prepared.pixels.reduce((a, b) => a + b),
        blank: prepared.blank
      };
    }));
    console.log('这里仅观察变换，不用测试预测来选旋转范围。训练 ±8° 在查看测试集前已固定。');
    heading('实验 5：逐样本推理与十类候选分数');
    for (let i = 0; i < 10; i++) {
      const prepared = prepareDigit(mnistToImage(dataset.pixels.subarray(i * 784, (i + 1) * 784)));
      const result = predictDigit(tf, model, prepared);
      console.log(JSON.stringify({
        originalTrainingIndex: dataset.originalIndices[i],
        split: 'validation',
        truth: String(dataset.labels[i]),
        prediction: result.label,
        score: result.confidence
      }));
    }
    console.table(predictDigit(tf, model, first).probabilities.map((score, digit) => ({
      digit,
      score
    })).sort((a, b) => b.score - a.score));
    heading('实验 6：手算混淆矩阵与完整独立测试报告对照');
    const toy = classificationReport([0, 0, 1, 1], [0, 1, 1, 1], 2);
    console.log('手算样例（非模型成绩）：truth=[0,0,1,1]，pred=[0,1,1,1]');
    console.table(toy.confusionMatrix);
    console.log('正确 3/4=', toy.accuracy);
    assert.equal(toy.accuracy, 0.75);
    console.table(report.trainingCurve);
    console.log('完整测试成绩从冻结报告读取：', report.test.correct, '/', report.test.count, '=', report.test.accuracy);
    console.table(report.test.perClass.map(({
      label,
      support,
      recall,
      precision
    }) => ({
      label,
      support,
      recall,
      precision
    })));
    console.log('照片评估', report.photoEvaluation);
    heading('实验 7：重复推理的张量生命周期');
    const before = tf.memory().numTensors;
    for (let i = 0; i < 50; i++) predictDigit(tf, model, first);
    console.log({
      tensorsBefore: before,
      tensorsAfter: tf.memory().numTensors
    });
    assert.equal(before, tf.memory().numTensors);
    heading('实验 8：理想交叉熵与实际概率裁剪；历史与新建模型的 Dropout');
    for (const [logits, target] of [[[2, 1, 0], 0], [[1000, -1000, 0], 1]]) {
      console.log(JSON.stringify(crossEntropyComparison(tf, logits, target), null, 2));
    }
    console.log('本次CPU极端例：Layers裁剪ε约1e-7、损失约16.1181、梯度0；部分WebGL环境ε约1e-4、损失约9.2103。Core logits损失2000、梯度[1,-1,0]。历史模型未换损失。');
    console.log('已保存历史模型的 Dropout：', inspectDropout(tf, model));
    const fresh = createDigitModel(tf);
    try {
      console.log('新建模型默认 Dropout（只检查掩码，无 fit/保存）：', inspectDropout(tf, fresh));
    } finally {
      fresh.dispose();
    }
    console.log('新训练省略 Dropout 的固定 seed，每次重新采样；初始化/划分/增强种子仍固定，不承诺跨跑逐位重现。');
    console.log('自检通过；独立进程验证：node 17-cnn-classifier/verify.js。单数字到整串还需要第 25 章的检测与分割。');
  } finally {
    model.dispose();
  }
}
if (require.main === module) main().catch(error => {
  console.error(error.message, '\n请确认本章 model/ 和 validation-samples.json 已随课程提供。');
  process.exitCode = 1;
});
module.exports = {
  main
};
