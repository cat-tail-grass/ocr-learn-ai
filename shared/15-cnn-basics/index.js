'use strict';

// 单样本 CHW，卷积核 OIHW。Number/Float64Array 保留负特征值与数值梯度精度。
function integer(value, minimum, name) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} 必须是 >= ${minimum} 的整数`);
  }
}
function pair(value, minimum, name) {
  const result = Array.isArray(value) ? value.slice() : [value, value];
  if (result.length !== 2) {
    throw new RangeError(`${name} 应为数值或 [高,宽]`);
  }
  result.forEach(v => integer(v, minimum, name));
  return result;
}
function tensor(shape, data) {
  if (!Array.isArray(shape) || shape.length === 0) {
    throw new RangeError('shape 不可为空');
  }
  shape.forEach(v => integer(v, 1, '维度'));
  const size = shape.reduce((a, b) => a * b, 1);
  integer(size, 1, '元素数量');
  if (data !== undefined && (!(Array.isArray(data) || ArrayBuffer.isView(data)) || data.length !== size)) {
    throw new RangeError(`data 长度应为 ${size}`);
  }
  if (data !== undefined) {
    for (const v of data) {
      if (!Number.isFinite(v)) {
        throw new TypeError('张量元素必须是有限数值');
      }
    }
  }
  const values = data === undefined ? new Float64Array(size) : Float64Array.from(data);
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new TypeError('张量元素必须是有限数值');
    }
  }
  return {
    shape: [...shape],
    data: values
  };
}
function validateTensor(value, rank, name) {
  if (!value || !Array.isArray(value.shape) || value.shape.length !== rank) {
    throw new RangeError(`${name} 应为 ${rank} 阶张量`);
  }
  value.shape.forEach(v => integer(v, 1, `${name}.shape`));
  const size = value.shape.reduce((a, b) => a * b, 1);
  integer(size, 1, '元素数量');
  if (!(Array.isArray(value.data) || ArrayBuffer.isView(value.data)) || value.data.length !== size) {
    throw new RangeError(`${name}.data 长度不匹配`);
  }
  for (const v of value.data) {
    if (!Number.isFinite(v)) {
      throw new TypeError(`${name} 包含非有限值`);
    }
  }
}
function outputShape(inputShape, kernelShape, {
  stride = 1,
  padding = 0
} = {}) {
  if (!Array.isArray(inputShape) || inputShape.length !== 3 || !Array.isArray(kernelShape) || kernelShape.length !== 4) {
    throw new RangeError('形状应为 CHW 与 OIHW');
  }
  [...inputShape, ...kernelShape].forEach(v => integer(v, 1, '维度'));
  const [c, h, w] = inputShape;
  const [o, kc, kh, kw] = kernelShape;
  if (c !== kc) {
    throw new RangeError('输入通道与卷积核输入通道不匹配');
  }
  const [sh, sw] = pair(stride, 1, 'stride');
  const [ph, pw] = pair(padding, 0, 'padding');
  const oh = Math.floor((h + 2 * ph - kh) / sh) + 1;
  const ow = Math.floor((w + 2 * pw - kw) / sw) + 1;
  if (oh <= 0 || ow <= 0) {
    throw new RangeError('卷积核超过填充后的输入，输出为空');
  }
  return [o, oh, ow];
}
function checkBias(bias, outputs) {
  if (!(Array.isArray(bias) || ArrayBuffer.isView(bias)) || bias.length !== outputs) {
    throw new RangeError('bias 长度应等于输出通道数');
  }
  for (const v of bias) {
    if (!Number.isFinite(v)) {
      throw new TypeError('bias 必须是有限数值');
    }
  }
}

// 深度学习里通常称为卷积，但本函数执行不翻核的互相关。
function conv2d(input, kernel, {
  stride = 1,
  padding = 0,
  bias
} = {}) {
  validateTensor(input, 3, 'input');
  validateTensor(kernel, 4, 'kernel');
  const shape = outputShape(input.shape, kernel.shape, {
    stride,
    padding
  });
  const [outputs, oh, ow] = shape;
  const [channels, h, w] = input.shape;
  const [,, kh, kw] = kernel.shape;
  const [sh, sw] = pair(stride, 1, 'stride');
  const [ph, pw] = pair(padding, 0, 'padding');
  const biases = bias === undefined ? new Float64Array(outputs) : bias;
  checkBias(biases, outputs);
  const output = tensor(shape);
  for (let o = 0; o < outputs; o++) {
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        let sum = biases[o];
        for (let c = 0; c < channels; c++) {
          for (let ky = 0; ky < kh; ky++) {
            for (let kx = 0; kx < kw; kx++) {
              const iy = y * sh + ky - ph;
              const ix = x * sw + kx - pw;
              if (iy < 0 || iy >= h || ix < 0 || ix >= w) {
                continue;
              } // 对称零填充
              const wi = ((o * channels + c) * kh + ky) * kw + kx;
              sum += input.data[(c * h + iy) * w + ix] * kernel.data[wi];
            }
          }
        }
        if (!Number.isFinite(sum)) {
          throw new RangeError('卷积计算溢出');
        }
        output.data[(o * oh + y) * ow + x] = sum;
      }
    }
  }
  return output;
}

// upstream 是标量损失对卷积输出的偏导，不是 Sobel 图像梯度。
function conv2dBackward(input, kernel, upstream, {
  stride = 1,
  padding = 0
} = {}) {
  validateTensor(input, 3, 'input');
  validateTensor(kernel, 4, 'kernel');
  validateTensor(upstream, 3, 'upstream');
  const shape = outputShape(input.shape, kernel.shape, {
    stride,
    padding
  });
  if (shape.some((v, i) => v !== upstream.shape[i])) {
    throw new RangeError('upstream 维度不匹配');
  }
  const [outputs, oh, ow] = shape;
  const [channels, h, w] = input.shape;
  const [,, kh, kw] = kernel.shape;
  const [sh, sw] = pair(stride, 1, 'stride');
  const [ph, pw] = pair(padding, 0, 'padding');
  const dInput = tensor(input.shape);
  const dKernel = tensor(kernel.shape);
  const dBias = new Float64Array(outputs);
  for (let o = 0; o < outputs; o++) {
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const g = upstream.data[(o * oh + y) * ow + x];
        dBias[o] += g;
        for (let c = 0; c < channels; c++) {
          for (let ky = 0; ky < kh; ky++) {
            for (let kx = 0; kx < kw; kx++) {
              const iy = y * sh + ky - ph;
              const ix = x * sw + kx - pw;
              if (iy < 0 || iy >= h || ix < 0 || ix >= w) {
                continue;
              }
              const ii = (c * h + iy) * w + ix;
              const wi = ((o * channels + c) * kh + ky) * kw + kx;
              // 共享参数被多次使用，每条计算路径的贡献必须相加。
              dKernel.data[wi] += g * input.data[ii];
              dInput.data[ii] += g * kernel.data[wi];
            }
          }
        }
      }
    }
  }
  validateTensor(dInput, 3, 'dInput');
  validateTensor(dKernel, 4, 'dKernel');
  checkBias(dBias, outputs);
  return {
    dInput,
    dKernel,
    dBias
  };
}
function relu(input) {
  validateTensor(input, 3, 'input');
  return tensor(input.shape, input.data.map(v => Math.max(0, v)));
}
function poolGeometry(input, {
  size = 2,
  stride = size,
  mode = 'max'
} = {}) {
  validateTensor(input, 3, 'input');
  if (!['max', 'average'].includes(mode)) {
    throw new RangeError('池化 mode 应为 max 或 average');
  }
  const [kh, kw] = pair(size, 1, 'size');
  const [sh, sw] = pair(stride, 1, 'stride');
  const [c, h, w] = input.shape;
  const oh = Math.floor((h - kh) / sh) + 1;
  const ow = Math.floor((w - kw) / sw) + 1;
  if (oh <= 0 || ow <= 0) {
    throw new RangeError('池化窗口超过输入');
  }
  return {
    shape: [c, oh, ow],
    kh,
    kw,
    sh,
    sw,
    mode
  };
}

// 无填充、floor 模式、逐通道；最大值并列时，反向选择行优先遇到的第一个。
function pool2d(input, options = {}) {
  const {
    shape,
    kh,
    kw,
    sh,
    sw,
    mode
  } = poolGeometry(input, options);
  const [channels, oh, ow] = shape;
  const [, h, w] = input.shape;
  const output = tensor(shape);
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        let value = mode === 'max' ? -Infinity : 0;
        for (let ky = 0; ky < kh; ky++) {
          for (let kx = 0; kx < kw; kx++) {
            const v = input.data[(c * h + y * sh + ky) * w + x * sw + kx];
            value = mode === 'max' ? Math.max(value, v) : value + v / (kh * kw);
          }
        }
        output.data[(c * oh + y) * ow + x] = value;
      }
    }
  }
  validateTensor(output, 3, '池化输出');
  return output;
}
function pool2dBackward(input, upstream, options = {}) {
  const {
    shape,
    kh,
    kw,
    sh,
    sw,
    mode
  } = poolGeometry(input, options);
  validateTensor(upstream, 3, 'upstream');
  if (shape.some((v, i) => v !== upstream.shape[i])) {
    throw new RangeError('upstream 维度不匹配');
  }
  const [channels, oh, ow] = shape;
  const [, h, w] = input.shape;
  const result = tensor(input.shape);
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const g = upstream.data[(c * oh + y) * ow + x];
        let best = -Infinity;
        let bestIndex = -1;
        for (let ky = 0; ky < kh; ky++) {
          for (let kx = 0; kx < kw; kx++) {
            const i = (c * h + y * sh + ky) * w + x * sw + kx;
            if (mode === 'average') {
              result.data[i] += g / (kh * kw);
            } else if (input.data[i] > best) {
              best = input.data[i];
              bestIndex = i;
            }
          }
        }
        if (mode === 'max') {
          result.data[bestIndex] += g;
        }
      }
    }
  }
  validateTensor(result, 3, '池化输入梯度');
  return result;
}
function flatten(input) {
  validateTensor(input, 3, 'input');
  return Float64Array.from(input.data); // 按 CHW 顺序，返回副本。
}
function dense(input, weights, bias) {
  validateTensor(weights, 2, 'weights');
  const [outputs, inputs] = weights.shape;
  if (!(Array.isArray(input) || ArrayBuffer.isView(input)) || input.length !== inputs) {
    throw new RangeError('dense 输入维度不匹配');
  }
  for (const v of input) {
    if (!Number.isFinite(v)) {
      throw new TypeError('dense 输入必须有限');
    }
  }
  const biases = bias === undefined ? new Float64Array(outputs) : bias;
  checkBias(biases, outputs);
  const result = new Float64Array(outputs);
  for (let o = 0; o < outputs; o++) {
    result[o] = biases[o];
    for (let i = 0; i < inputs; i++) {
      result[o] += weights.data[o * inputs + i] * input[i];
    }
    if (!Number.isFinite(result[o])) {
      throw new RangeError('dense 计算溢出');
    }
  }
  return result;
}
function softmax(logits) {
  if (!(Array.isArray(logits) || ArrayBuffer.isView(logits)) || logits.length === 0) {
    throw new RangeError('logits 不可为空');
  }
  let maximum = -Infinity;
  for (const v of logits) {
    if (!Number.isFinite(v)) {
      throw new TypeError('logits 必须有限');
    }
    maximum = Math.max(maximum, v);
  }
  const values = Float64Array.from(logits, v => Math.exp(v - maximum));
  const sum = values.reduce((a, b) => a + b, 0);
  return values.map(v => v / sum);
}
function parameterCount(kernelShape, inputShape, options = {}) {
  const shape = outputShape(inputShape, kernelShape, options);
  const [outputs, channels, kh, kw] = kernelShape;
  const positions = shape[1] * shape[2];
  return {
    outputShape: shape,
    convolution: outputs * (channels * kh * kw + 1),
    locallyConnected: positions * outputs * (channels * kh * kw + 1),
    fullyConnected: positions * outputs * (inputShape.reduce((a, b) => a * b, 1) + 1),
    multiplyAccumulates: positions * outputs * channels * kh * kw
  };
}
function makeLineImage({
  orientation = 'vertical',
  position = 2,
  size = 6
} = {}) {
  integer(size, 3, 'size');
  integer(position, 0, 'position');
  if (position >= size) {
    throw new RangeError('position 超过图像边界');
  }
  if (!['vertical', 'horizontal'].includes(orientation)) {
    throw new RangeError('orientation 应为 vertical 或 horizontal');
  }
  const result = tensor([1, size, size]);
  for (let i = 0; i < size; i++) {
    result.data[orientation === 'vertical' ? i * size + position : position * size + i] = 1;
  }
  return result;
}

// 手工设置的竖线/横线探测器和分类头，只示范前向，不声称训练过。
function createTinyCNN() {
  return {
    kernel: tensor([2, 1, 3, 3], [-1, 2, -1, -1, 2, -1, -1, 2, -1, -1, -1, -1, 2, 2, 2, -1, -1, -1].map(v => v / 6)),
    convBias: Float64Array.of(0, 0),
    weights: tensor([2, 8], [0.25, 0.25, 0.25, 0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0.25, 0.25, 0.25]),
    denseBias: Float64Array.of(0, 0),
    labels: ['竖线', '横线']
  };
}
function tinyCNNForward(input, model = createTinyCNN(), {
  poolMode = 'max'
} = {}) {
  validateTensor(input, 3, 'input');
  if (input.shape.some((v, i) => v !== [1, 6, 6][i])) {
    throw new RangeError('教学 CNN 输入固定为 [1,6,6]');
  }
  const convolution = conv2d(input, model.kernel, {
    bias: model.convBias
  });
  const activation = relu(convolution);
  const pooled = pool2d(activation, {
    size: 2,
    stride: 2,
    mode: poolMode
  });
  const features = flatten(pooled);
  const logits = dense(features, model.weights, model.denseBias);
  const probabilities = softmax(logits);
  const predictedIndex = probabilities.reduce((best, v, i) => v > probabilities[best] ? i : best, 0);
  return {
    convolution,
    activation,
    pooled,
    features,
    logits,
    probabilities,
    predictedIndex,
    label: model.labels[predictedIndex],
    parameterCount: model.kernel.data.length + model.convBias.length + model.weights.data.length + model.denseBias.length
  };
}
module.exports = {
  tensor,
  outputShape,
  conv2d,
  conv2dBackward,
  relu,
  pool2d,
  pool2dBackward,
  flatten,
  dense,
  softmax,
  parameterCount,
  makeLineImage,
  createTinyCNN,
  tinyCNNForward
};
