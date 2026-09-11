'use strict';

const tf = require('@tensorflow/tfjs');
const path = require('node:path');
const fs = require('node:fs/promises');
const {
  loadModel
} = require('./model-io');
const {
  loadMNIST
} = require('./data');
const {
  prepareDigit,
  mnistToImage,
  predictDigit,
  PREPROCESSING
} = require('../shared/17-cnn-classifier');
async function main() {
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'model');
  await tf.setBackend('cpu');
  await tf.ready();
  const baseline = tf.memory().numTensors,
    start = performance.now();
  const {
    model,
    metadata
  } = await loadModel(tf, directory);
  const records = [];
  let before, after;
  try {
    if (metadata?.preprocessing?.id !== PREPROCESSING.id) throw new Error('输入处理版本不匹配');
    const data = await loadMNIST('t10k');
    const prepared = prepareDigit(mnistToImage(data.pixels.subarray(0, 784)));
    predictDigit(tf, model, prepared); // warmup
    before = tf.memory().numTensors;
    for (let i = 0; i < 200; i++) {
      const input = prepareDigit(mnistToImage(data.pixels.subarray(i * 784, (i + 1) * 784)));
      const prediction = predictDigit(tf, model, input);
      records.push({
        originalTestIndex: i,
        truth: String(data.labels[i]),
        prediction: prediction.label,
        score: prediction.confidence
      });
    }
    after = tf.memory().numTensors;
  } finally {
    model.dispose();
  }
  const report = {
    modelId: metadata.modelId,
    node: process.version,
    backend: tf.getBackend(),
    session: 'fresh Node process; no fit()',
    repeatedInference: 200,
    tensorsBefore: before,
    tensorsAfter: after,
    baseline,
    tensorsAfterDispose: tf.memory().numTensors,
    elapsedSeconds: (performance.now() - start) / 1000,
    correct: records.filter(r => r.truth === r.prediction).length,
    records
  };
  if (before !== after || baseline !== report.tensorsAfterDispose) throw new Error('张量释放验证失败');
  // 默认只打印本次检查，不覆写模型目录里冻结的历史报告。
  // 若需要留档，第三个位置参数指定一个尚不存在的新文件。
  if (process.argv[3]) {
    await fs.writeFile(path.resolve(process.argv[3]), JSON.stringify(report, null, 2), { flag: 'wx' });
  }
  console.log(JSON.stringify({
    ...report,
    records: records.slice(0, 10)
  }, null, 2));
}
if (require.main === module) main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
