'use strict';

// 纯 JavaScript、双精度、一条样本一个向量。最后一层固定为二分类 logit。
function finite(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} 必须是有限数值`);
  }
}
function vector(value, length, name) {
  if (!(Array.isArray(value) || ArrayBuffer.isView(value)) || value.length !== length) {
    throw new RangeError(`${name} 长度应为 ${length}`);
  }
  for (const v of value) {
    finite(v, name);
  }
}
function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} 必须是正整数`);
  }
}
function createRandom(seed = 42) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed 应为 uint32');
  }
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223 >>> 0;
    return state / 4294967296;
  };
}
function sigmoid(z) {
  finite(z, 'z');
  // 避免 exp(-z) 在巨大负数处溢出。
  if (z >= 0) {
    return 1 / (1 + Math.exp(-z));
  }
  const e = Math.exp(z);
  return e / (1 + e);
}
function checkActivation(name) {
  if (!['tanh', 'sigmoid', 'relu'].includes(name)) {
    throw new RangeError('activation 应为 tanh、sigmoid 或 relu');
  }
}
function activate(z, name) {
  finite(z, 'z');
  checkActivation(name);
  if (name === 'relu') {
    return Math.max(0, z);
  }
  return name === 'tanh' ? Math.tanh(z) : sigmoid(z);
}
function activationDerivative(z, name) {
  const a = activate(z, name);
  if (name === 'relu') {
    return z > 0 ? 1 : 0;
  } // 在不可导的 0 处选择 0。
  return name === 'tanh' ? 1 - a * a : a * (1 - a);
}
function binaryCrossEntropyWithLogits(logit, target) {
  finite(logit, 'logit');
  finite(target, 'target');
  if (target < 0 || target > 1) {
    throw new RangeError('target 必须在 [0,1]');
  }
  return Math.max(logit, 0) - target * logit + Math.log1p(Math.exp(-Math.abs(logit)));
}
function validateModel(model) {
  if (!model || !Array.isArray(model.sizes) || model.sizes.length < 2 || model.sizes.at(-1) !== 1) {
    throw new RangeError('sizes 至少包含输入、输出两层，且输出维数必须为 1');
  }
  model.sizes.forEach(n => positiveInteger(n, '层宽'));
  checkActivation(model.activation);
  if (!Array.isArray(model.layers) || model.layers.length !== model.sizes.length - 1) {
    throw new RangeError('层数不匹配');
  }
  model.layers.forEach((layer, l) => {
    if (!layer || layer.inputSize !== model.sizes[l] || layer.outputSize !== model.sizes[l + 1]) {
      throw new RangeError('层维度不匹配');
    }
    vector(layer.weights, layer.inputSize * layer.outputSize, 'weights');
    vector(layer.biases, layer.outputSize, 'biases');
  });
}
function createMLP({
  sizes = [2, 4, 1],
  activation = 'tanh',
  seed = 42
} = {}) {
  if (!Array.isArray(sizes) || sizes.length < 2 || sizes.at(-1) !== 1) {
    throw new RangeError('sizes 的输出维数必须为 1');
  }
  sizes.forEach(n => positiveInteger(n, '层宽'));
  checkActivation(activation);
  const random = createRandom(seed);
  const layers = sizes.slice(1).map((outputSize, l) => {
    const inputSize = sizes[l];
    // 隐藏 ReLU 使用 He uniform，其他层使用 Xavier uniform。
    const limit = activation === 'relu' && l < sizes.length - 2 ? Math.sqrt(6 / inputSize) : Math.sqrt(6 / (inputSize + outputSize));
    return {
      inputSize,
      outputSize,
      weights: Float64Array.from({
        length: inputSize * outputSize
      }, () => (2 * random() - 1) * limit),
      biases: new Float64Array(outputSize)
    };
  });
  return {
    sizes: [...sizes],
    activation,
    seed,
    layers
  };
}
function cloneModel(model) {
  validateModel(model);
  return {
    ...model,
    sizes: [...model.sizes],
    layers: model.layers.map(layer => ({
      ...layer,
      weights: Float64Array.from(layer.weights),
      biases: Float64Array.from(layer.biases)
    }))
  };
}

// weights[o * inputSize + i] = W[o,i]；所有激活向量均按列向量解释。
function forwardUnchecked(model, input) {
  const activations = [Float64Array.from(input)];
  const preActivations = [];
  model.layers.forEach((layer, l) => {
    const previous = activations[l];
    const z = new Float64Array(layer.outputSize);
    for (let o = 0; o < layer.outputSize; o++) {
      let sum = layer.biases[o];
      for (let i = 0; i < layer.inputSize; i++) {
        sum += layer.weights[o * layer.inputSize + i] * previous[i];
      }
      finite(sum, '前向计算结果');
      z[o] = sum;
    }
    preActivations.push(z);
    activations.push(l === model.layers.length - 1 ? z.slice() : z.map(v => activate(v, model.activation)));
  });
  const logit = preActivations.at(-1)[0];
  return {
    logit,
    probability: sigmoid(logit),
    activations,
    preActivations
  };
}
function forward(model, input) {
  validateModel(model);
  vector(input, model.sizes[0], 'input');
  return forwardUnchecked(model, input);
}
function validateSamples(model, samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new RangeError('samples 不可为空');
  }
  samples.forEach(sample => {
    if (!sample) {
      throw new TypeError('sample 不可为空');
    }
    vector(sample.input, model.sizes[0], 'sample.input');
    if (sample.target !== 0 && sample.target !== 1) {
      throw new RangeError('训练标签必须为 0 或 1');
    }
  });
}
function evaluateUnchecked(model, samples) {
  let loss = 0;
  let correct = 0;
  const predictions = samples.map(sample => {
    const result = forwardUnchecked(model, sample.input);
    const predicted = result.probability >= 0.5 ? 1 : 0;
    loss += binaryCrossEntropyWithLogits(result.logit, sample.target) / samples.length;
    if (predicted === sample.target) {
      correct++;
    }
    return {
      input: Array.from(sample.input),
      target: sample.target,
      predicted,
      probability: result.probability
    };
  });
  finite(loss, '平均损失');
  return {
    loss,
    accuracy: correct / samples.length,
    count: samples.length,
    predictions
  };
}
function evaluate(model, samples) {
  validateModel(model);
  validateSamples(model, samples);
  return evaluateUnchecked(model, samples);
}

// 一次 backward 返回平均损失的梯度；不更新模型。
function backwardUnchecked(model, samples) {
  const gradients = model.layers.map(layer => ({
    weights: new Float64Array(layer.weights.length),
    biases: new Float64Array(layer.biases.length)
  }));
  let loss = 0;
  for (const sample of samples) {
    const cache = forwardUnchecked(model, sample.input);
    loss += binaryCrossEntropyWithLogits(cache.logit, sample.target) / samples.length;
    // sigmoid + BCE 对 logit 的导数为 p-y；此处已经除以 N。
    let delta = Float64Array.of((cache.probability - sample.target) / samples.length);
    for (let l = model.layers.length - 1; l >= 0; l--) {
      const layer = model.layers[l];
      const previous = cache.activations[l];
      for (let o = 0; o < layer.outputSize; o++) {
        gradients[l].biases[o] += delta[o];
        for (let i = 0; i < layer.inputSize; i++) {
          gradients[l].weights[o * layer.inputSize + i] += delta[o] * previous[i];
        }
      }
      if (l > 0) {
        const nextDelta = new Float64Array(layer.inputSize);
        for (let i = 0; i < layer.inputSize; i++) {
          let upstream = 0;
          for (let o = 0; o < layer.outputSize; o++) {
            upstream += layer.weights[o * layer.inputSize + i] * delta[o];
          }
          nextDelta[i] = upstream * activationDerivative(cache.preActivations[l - 1][i], model.activation);
        }
        delta = nextDelta;
      }
    }
  }
  finite(loss, '平均损失');
  gradients.forEach(g => {
    vector(g.weights, g.weights.length, '权重梯度');
    vector(g.biases, g.biases.length, '偏置梯度');
  });
  return {
    loss,
    gradients
  };
}
function backward(model, samples) {
  validateModel(model);
  validateSamples(model, samples);
  return backwardUnchecked(model, samples);
}
function applyGradients(model, gradients, learningRate = 0.1) {
  validateModel(model);
  finite(learningRate, 'learningRate');
  if (learningRate <= 0) {
    throw new RangeError('learningRate 必须大于 0');
  }
  if (!Array.isArray(gradients) || gradients.length !== model.layers.length) {
    throw new RangeError('梯度层数不匹配');
  }
  // 全部检查并计算完成后才写回，异常时不留下更新一半的模型。
  const updated = model.layers.map((layer, l) => {
    const next = {};
    for (const key of ['weights', 'biases']) {
      vector(gradients[l] && gradients[l][key], layer[key].length, key);
      next[key] = Float64Array.from(layer[key], (v, i) => v - learningRate * gradients[l][key][i]);
      vector(next[key], layer[key].length, '更新结果');
    }
    return next;
  });
  updated.forEach((layer, l) => {
    model.layers[l].weights = layer.weights;
    model.layers[l].biases = layer.biases;
  });
  return model;
}
function train(model, samples, {
  epochs = 5000,
  learningRate = 0.5,
  recordEvery = 100
} = {}) {
  validateModel(model);
  validateSamples(model, samples);
  if (!Number.isSafeInteger(epochs) || epochs < 0) {
    throw new RangeError('epochs 应为非负整数');
  }
  positiveInteger(recordEvery, 'recordEvery');
  finite(learningRate, 'learningRate');
  if (learningRate <= 0) {
    throw new RangeError('learningRate 必须大于 0');
  }
  const history = [{
    epoch: 0,
    ...evaluateUnchecked(model, samples)
  }];
  for (let epoch = 1; epoch <= epochs; epoch++) {
    applyGradients(model, backwardUnchecked(model, samples).gradients, learningRate);
    if (epoch % recordEvery === 0 || epoch === epochs) {
      history.push({
        epoch,
        ...evaluateUnchecked(model, samples)
      });
    }
  }
  return {
    model,
    history,
    ...evaluateUnchecked(model, samples)
  };
}
function gradientCheck(model, samples, {
  epsilon = 1e-5,
  atol = 1e-7,
  rtol = 1e-4
} = {}) {
  validateModel(model);
  validateSamples(model, samples);
  for (const [name, v] of Object.entries({
    epsilon,
    atol,
    rtol
  })) {
    finite(v, name);
    if (v < 0 || name === 'epsilon' && v === 0) {
      throw new RangeError(`${name} 超出范围`);
    }
  }
  const copy = cloneModel(model);
  const {
    gradients
  } = backwardUnchecked(copy, samples);
  const entries = [];
  copy.layers.forEach((layer, l) => {
    for (const key of ['weights', 'biases']) {
      for (let i = 0; i < layer[key].length; i++) {
        const original = layer[key][i];
        layer[key][i] = original + epsilon;
        const plus = evaluateUnchecked(copy, samples).loss;
        layer[key][i] = original - epsilon;
        const minus = evaluateUnchecked(copy, samples).loss;
        layer[key][i] = original;
        const numerical = (plus - minus) / (2 * epsilon);
        const analytical = gradients[l][key][i];
        const absError = Math.abs(numerical - analytical);
        const scale = Math.abs(numerical) + Math.abs(analytical);
        entries.push({
          parameter: `layers[${l}].${key}[${i}]`,
          analytical,
          numerical,
          absError,
          relativeError: absError / Math.max(1e-8, scale),
          passed: absError <= atol + rtol * scale
        });
      }
    }
  });
  return {
    passed: entries.every(e => e.passed),
    parameterCount: entries.length,
    maxAbsError: entries.reduce((v, e) => Math.max(v, e.absError), 0),
    maxRelativeError: entries.reduce((v, e) => Math.max(v, e.relativeError), 0),
    entries
  };
}
function xorSamples() {
  return [{
    input: [0, 0],
    target: 0
  }, {
    input: [0, 1],
    target: 1
  }, {
    input: [1, 0],
    target: 1
  }, {
    input: [1, 1],
    target: 0
  }];
}

// 固定的 2→2→1 小例子，方便逐项手算，而非另写一份算法。
function traceExample() {
  const model = createMLP({
    sizes: [2, 2, 1],
    activation: 'sigmoid',
    seed: 1
  });
  model.layers[0].weights.set([0.1, 0.2, -0.1, 0.1]);
  model.layers[0].biases.set([0, 0]);
  model.layers[1].weights.set([0.3, -0.2]);
  model.layers[1].biases.set([0.1]);
  const samples = [{
    input: [1, 2],
    target: 1
  }];
  const before = cloneModel(model);
  const cache = forward(model, samples[0].input);
  const result = backward(model, samples);
  applyGradients(model, result.gradients, 0.1);
  return {
    before,
    cache,
    ...result,
    after: model,
    afterLoss: evaluate(model, samples).loss,
    learningRate: 0.1
  };
}
module.exports = {
  createRandom,
  sigmoid,
  activate,
  activationDerivative,
  binaryCrossEntropyWithLogits,
  createMLP,
  cloneModel,
  forward,
  evaluate,
  backward,
  applyGradients,
  train,
  gradientCheck,
  xorSamples,
  traceExample
};
