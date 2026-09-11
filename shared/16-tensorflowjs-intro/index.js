'use strict';

function tensorArithmetic(tf) {
  return tf.tidy(() => {
    const a = tf.tensor2d([[1, 2], [3, 4]]),
      b = tf.tensor2d([[2, 0], [1, 2]]);
    const product = a.matMul(b),
      elementwise = a.mul(b),
      broadcast = a.add(tf.tensor1d([10, 20]));
    const gradient = tf.grad(x => x.square().sum())(a);
    return {
      shape: product.shape,
      product: product.arraySync(),
      elementwise: elementwise.arraySync(),
      broadcast: broadcast.arraySync(),
      gradient: gradient.arraySync()
    };
  });
}
async function runLinearExperiment(tf, options = {}) {
  const epochs = options.epochs ?? 120;
  const learningRate = options.learningRate ?? 0.1;
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > 5000) {
    throw new RangeError('epochs 必须为 1–5000 整数');
  }
  if (!Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 1) {
    throw new RangeError('learningRate 必须在 (0,1]');
  }
  const model = tf.sequential();
  model.add(tf.layers.dense({
    units: 1,
    inputShape: [1],
    kernelInitializer: 'zeros',
    biasInitializer: 'zeros'
  }));
  const optimizer = tf.train.sgd(learningRate);
  model.compile({
    optimizer,
    loss: 'meanSquaredError'
  });
  const xs = tf.tensor2d([-1, -0.5, 0, 0.5, 1], [5, 1]),
    ys = tf.tensor2d([-1, 0, 1, 2, 3], [5, 1]);
  const history = [];
  try {
    await model.fit(xs, ys, {
      epochs,
      batchSize: 5,
      shuffle: false,
      verbose: 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          history.push({
            epoch: epoch + 1,
            loss: logs.loss
          });
          if (options.onEpochEnd) {
            await options.onEpochEnd(epoch, logs);
          }
        }
      }
    });
    const prediction = tf.tidy(() => model.predict(tf.tensor2d([2], [1, 1])).dataSync()[0]);
    const learned = tf.tidy(() => model.getWeights().map(t => t.dataSync()[0]));
    // fit 日志来自各批次更新前的损失；这里用最终参数重新评估同一批数据。
    const finalLoss = tf.tidy(() => model.evaluate(xs, ys).dataSync()[0]);
    return {
      model,
      history,
      finalLoss,
      prediction,
      learned: {
        weight: learned[0],
        bias: learned[1]
      },
      backend: tf.getBackend(),
      version: tf.version.tfjs
    };
  } catch (error) {
    model.dispose();
    optimizer.dispose();
    throw error;
  } finally {
    xs.dispose();
    ys.dispose();
  }
}
async function captureModel(tf, model) {
  let artifacts;
  await model.save(tf.io.withSaveHandler(async value => {
    artifacts = value;
    return {
      modelArtifactsInfo: tf.io.getModelArtifactsInfoForJSON(value)
    };
  }), {
    includeOptimizer: false
  });
  return artifacts;
}
async function reloadModel(tf, artifacts) {
  return tf.loadLayersModel(tf.io.fromMemory(artifacts));
}
function predictValues(tf, model, values) {
  if (!Array.isArray(values) || !values.length || values.some(x => !Number.isFinite(x))) {
    throw new TypeError('values 必须为非空有限数数组');
  }
  return tf.tidy(() => Array.from(model.predict(tf.tensor2d(values, [values.length, 1])).dataSync()));
}
function firstGradientStep(tf, learningRate = 0.1) {
  if (!Number.isFinite(learningRate) || learningRate <= 0) {
    throw new RangeError('learningRate 必须为正数');
  }
  return tf.tidy(() => {
    const xs = tf.tensor1d([-1, -0.5, 0, 0.5, 1]),
      ys = xs.mul(2).add(1),
      weight = tf.scalar(0),
      bias = tf.scalar(0);
    const result = tf.valueAndGrads((w, b) => xs.mul(w).add(b).sub(ys).square().mean())([weight, bias]);
    const [dw, db] = result.grads.map(t => t.dataSync()[0]);
    return {
      loss: result.value.dataSync()[0],
      dw,
      db,
      learningRate,
      nextWeight: -learningRate * dw,
      nextBias: -learningRate * db
    };
  });
}
module.exports = {
  tensorArithmetic,
  runLinearExperiment,
  captureModel,
  reloadModel,
  predictValues,
  firstGradientStep
};
