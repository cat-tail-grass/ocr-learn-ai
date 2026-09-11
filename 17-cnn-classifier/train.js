'use strict';

const tf = require('@tensorflow/tfjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  PREPROCESSING,
  createDigitModel,
  shuffledIndices,
  classificationReport
} = require('../shared/17-cnn-classifier');
const {
  downloadMNIST,
  loadMNIST,
  makeSplit,
  prepareSamples
} = require('./data');
const {
  saveModel,
  loadModel
} = require('./model-io');
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const n = Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} 需要正整数`);
  return n;
}
async function evaluate(tf, model, dataset, ids, batchSize = 128) {
  const truth = [],
    predictions = [];
  let nll = 0;
  for (let start = 0; start < ids.length; start += batchSize) {
    const batchIds = ids.slice(start, start + batchSize),
      prepared = prepareSamples(dataset, batchIds);
    const scores = tf.tidy(() => Array.from(model.predict(tf.tensor4d(prepared.pixels, [batchIds.length, 28, 28, 1])).dataSync()));
    batchIds.forEach((id, i) => {
      const row = scores.slice(i * 10, (i + 1) * 10),
        label = dataset.labels[id];
      truth.push(label);
      predictions.push(row.indexOf(Math.max(...row)));
      nll -= Math.log(Math.max(1e-7, row[label]));
    });
  }
  return {
    ...classificationReport(truth, predictions),
    crossEntropy: ids.length ? nll / ids.length : null,
    predictions
  };
}
async function main() {
  const config = {
    seed: arg('seed', 1701),
    trainSize: arg('train-size', 55000),
    validationSize: arg('validation-size', 5000),
    epochs: arg('epochs', 5),
    batchSize: arg('batch-size', 128),
    learningRate: 0.001,
    dropoutSeedPolicy: 'resample',
    augmentation: {
      probability: 0.5,
      rotationDegrees: [-8, 8],
      stretchX: [0.9, 1.1],
      regeneratedEachEpoch: true
    }
  };
  const outputArg = process.argv.indexOf('--output'),
    modelDir = outputArg < 0 ? path.join(__dirname, 'model') : path.resolve(process.argv[outputArg + 1]);
  // 不覆盖已有模型。复现实验显式指定新输出目录。
  try {
    await fs.access(path.join(modelDir, 'model.json'));
    throw new Error('输出已有模型，请用 --output 指定新目录');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await tf.setBackend('cpu');
  await tf.ready();
  const start = Date.now(),
    environment = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0].model,
      tfjs: tf.version.tfjs,
      backend: tf.getBackend()
    };
  console.log(JSON.stringify({
    event: 'start',
    environment,
    config,
    time: new Date().toISOString()
  }));
  const sources = await downloadMNIST(),
    dataset = await loadMNIST('train'),
    split = makeSplit(dataset.count, config);
  await fs.mkdir(modelDir, {
    recursive: true
  });
  await fs.writeFile(path.join(modelDir, 'split.json'), JSON.stringify(split));
  await fs.writeFile(path.join(modelDir, 'config.json'), JSON.stringify({
    config,
    environment,
    preprocessing: PREPROCESSING,
    sources,
    selection: 'lowest validation cross entropy; held-out t10k only after all epochs'
  }, null, 2));
  const model = createDigitModel(tf, config),
    optimizer = tf.train.adam(config.learningRate);
  model.compile({
    optimizer,
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });
  console.log(JSON.stringify({
    event: 'model',
    parameters: model.countParams(),
    shapes: model.layers.map(l => l.outputShape)
  }));
  const validation = prepareSamples(dataset, split.validation),
    vx = tf.tensor4d(validation.pixels, [validation.count, 28, 28, 1]),
    vy = tf.tensor2d(validation.labels, [validation.count, 10]);
  const curve = [];
  let bestLoss = Infinity,
    bestEpoch = null,
    saved;
  for (let epoch = 0; epoch < config.epochs; epoch++) {
    const epochStart = Date.now(),
      order = shuffledIndices(split.training.length, config.seed + epoch).map(i => split.training[i]);
    const prepared = prepareSamples(dataset, order, {
      augment: true,
      seed: config.seed + 1000 + epoch
    });
    const x = tf.tensor4d(prepared.pixels, [prepared.count, 28, 28, 1]),
      y = tf.tensor2d(prepared.labels, [prepared.count, 10]);
    console.log(JSON.stringify({
      event: 'epoch-start',
      epoch: epoch + 1,
      preprocessingSeconds: (Date.now() - epochStart) / 1000
    }));
    let lastProgress = Date.now();
    try {
      const history = await model.fit(x, y, {
        epochs: 1,
        batchSize: config.batchSize,
        validationData: [vx, vy],
        shuffle: false,
        verbose: 0,
        callbacks: {
          onBatchEnd: async (batch, logs) => {
            if (Date.now() - lastProgress > 30000) {
              console.log(JSON.stringify({
                event: 'batch',
                epoch: epoch + 1,
                batch,
                loss: logs.loss,
                accuracy: logs.acc
              }));
              lastProgress = Date.now();
            }
          }
        }
      });
      const row = {
        epoch: epoch + 1,
        loss: history.history.loss[0],
        accuracy: history.history.acc[0],
        validationLoss: history.history.val_loss[0],
        validationAccuracy: history.history.val_acc[0],
        seconds: (Date.now() - epochStart) / 1000
      };
      curve.push(row);
      console.log(JSON.stringify({
        event: 'epoch-end',
        ...row
      }));
      if (row.validationLoss < bestLoss) {
        bestLoss = row.validationLoss;
        bestEpoch = epoch + 1;
        saved = await saveModel(tf, model, modelDir, {
          preprocessing: PREPROCESSING,
          labels: Array.from({
            length: 10
          }, (_, i) => String(i)),
          seed: config.seed,
          selectedEpoch: bestEpoch,
          dataset: 'MNIST',
          inputShape: [null, 28, 28, 1],
          trainedBy: '17-cnn-classifier/train.js',
          dropoutSeedPolicy: config.dropoutSeedPolicy
        });
      }
      await fs.writeFile(path.join(modelDir, 'training-curve.json'), JSON.stringify(curve, null, 2));
    } finally {
      x.dispose();
      y.dispose();
    }
  }
  vx.dispose();
  vy.dispose();
  model.dispose();
  optimizer.dispose();
  console.log(JSON.stringify({
    event: 'selection-frozen',
    bestEpoch,
    ...saved,
    elapsedSeconds: (Date.now() - start) / 1000
  }));
  const {
    model: selected
  } = await loadModel(tf, modelDir);
  const validationReport = await evaluate(tf, selected, dataset, split.validation);
  // 此时才解码测试集：不使用测试表现选择模型、阈值或增强。
  const test = await loadMNIST('t10k'),
    testReport = await evaluate(tf, selected, test, Array.from({
      length: test.count
    }, (_, i) => i));
  const predictions = testReport.predictions;
  delete testReport.predictions;
  delete validationReport.predictions;
  await fs.writeFile(path.join(modelDir, 'test-predictions.json'), JSON.stringify({
    dataset: 'MNIST t10k',
    indexConvention: 'zero-based original test index',
    truth: Array.from(test.labels),
    predictions
  }));
  const report = {
    modelId: saved.modelId,
    weightsSha256: saved.weightsSha256,
    createdAt: new Date().toISOString(),
    environment,
    config,
    preprocessing: PREPROCESSING,
    sources,
    parameters: selected.countParams(),
    weightBytes: saved.weightBytes,
    bestEpoch,
    selection: 'minimum validation crossEntropy',
    trainingCurve: curve,
    validation: validationReport,
    test: testReport,
    elapsedSeconds: (Date.now() - start) / 1000,
    photoEvaluation: {
      count: 0,
      accuracy: null,
      reason: '未提供独立真实照片；MNIST 成绩不能代表照片数字串准确率'
    }
  };
  await fs.writeFile(path.join(modelDir, 'training-report.json'), JSON.stringify(report, null, 2));
  selected.dispose();
  console.log(JSON.stringify({
    event: 'complete',
    modelId: saved.modelId,
    testAccuracy: testReport.accuracy,
    correct: testReport.correct,
    count: testReport.count,
    elapsedSeconds: report.elapsedSeconds,
    tensorsAfterDispose: tf.memory().numTensors
  }));
}
module.exports = {
  evaluate
};
if (require.main === module) main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
