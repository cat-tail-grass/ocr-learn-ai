"use strict";

// Matrix rows are tokens; columns are channels. No DOM or framework dependency.
function matrixShape(value, name = "matrix") {
  if (
    !Array.isArray(value) ||
    !value.length ||
    !Array.isArray(value[0]) ||
    !value[0].length
  ) {
    throw new TypeError(`${name} must be a nonempty number[][]`);
  }
  const cols = value[0].length;
  for (const row of value) {
    if (
      !Array.isArray(row) ||
      row.length !== cols ||
      Array.from(row).some((x) => !Number.isFinite(x))
    ) {
      throw new TypeError(`${name} must be rectangular and finite`);
    }
  }
  return [value.length, cols];
}

function transpose(a) {
  const [rows, cols] = matrixShape(a);
  return Array.from({ length: cols }, (_, j) =>
    Array.from({ length: rows }, (_, i) => a[i][j]),
  );
}

function matmul(a, b) {
  const [m, k] = matrixShape(a, "left");
  const [n, d] = matrixShape(b, "right");
  if (k !== n)
    throw new RangeError(`matmul inner dimensions differ: ${k} and ${n}`);
  const result = Array.from({ length: m }, (_, i) =>
    Array.from({ length: d }, (_, j) => {
      let sum = 0;
      // 对输出(i,j)，沿两个矩阵共同的内轴累加乘积。
      for (let t = 0; t < k; t++) {
        const contribution = a[i][t] * b[t][j];
        sum += contribution;
      }
      return sum;
    }),
  );
  matrixShape(result, "matmul result (overflow)");
  return result;
}

// -Infinity denotes a forbidden key. Reject all-masked rows: no valid distribution exists.
function softmax(logits) {
  if (
    !Array.isArray(logits) ||
    !logits.length ||
    Array.from(logits).some((x) => !Number.isFinite(x) && x !== -Infinity)
  ) {
    throw new TypeError("logits must be finite numbers or -Infinity");
  }
  // Step 1：减去同一行的最大分数，不改变softmax比值。
  const max = logits.reduce((a, b) => Math.max(a, b), -Infinity);
  if (max === -Infinity)
    throw new RangeError("each attention row needs at least one allowed key");
  // Step 2：先指数化，再沿key轴求和归一化。
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

function causalMask(length) {
  if (!Number.isSafeInteger(length) || length < 1)
    throw new RangeError("length must be a positive integer");
  return Array.from({ length }, (_, i) =>
    Array.from({ length }, (_, j) => j <= i),
  );
}

function scaledDotProductAttention(Q, K, V, { mask, temperature = 1 } = {}) {
  const [queries, dk] = matrixShape(Q, "Q");
  const [keys, kk] = matrixShape(K, "K");
  const [values] = matrixShape(V, "V");
  if (dk !== kk || keys !== values)
    throw new RangeError("Q/K channel or K/V token dimensions differ");
  if (!Number.isFinite(temperature) || temperature <= 0)
    throw new RangeError("temperature must be finite and positive");
  if (
    mask !== undefined &&
    (!Array.isArray(mask) ||
      mask.length !== queries ||
      Array.from(mask).some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== keys ||
          Array.from(row).some((x) => typeof x !== "boolean"),
      ))
  ) {
    throw new TypeError(
      "mask must be boolean[queries][keys]; true means allowed",
    );
  }
  const scale = 1 / Math.sqrt(dk) / temperature;
  if (!Number.isFinite(scale)) throw new RangeError("temperature is too small");
  // Step 1：匹配分数；遮罩在softmax之前施加。
  const scores = matmul(Q, transpose(K)).map((row, i) =>
    row.map((x, j) => {
      if (mask && !mask[i][j]) {
        return -Infinity;
      }
      const score = x * scale;
      // 只有显式mask能生成−Infinity；负向溢出不能冒充禁止位置。
      if (!Number.isFinite(score))
        throw new RangeError("attention score overflow after scaling");
      return score;
    }),
  );
  // Step 2：每个query独立形成位置分布。Step 3：用该分布读取V。
  const weights = scores.map(softmax);
  return { scores, weights, output: matmul(weights, V) };
}

// Exact reverse-mode derivatives of scaled dot-product attention for an upstream dOutput.
// Recompute the forward pass to avoid mutable/stale cache semantics in this small example.
function attentionBackward(Q, K, V, dOutput, options = {}) {
  const forward = scaledDotProductAttention(Q, K, V, options);
  const [n, d] = matrixShape(dOutput, "dOutput");
  if (n !== Q.length || d !== V[0].length)
    throw new RangeError("dOutput shape differs from output");
  // O=AV：上游梯度先传到A；V的梯度在返回时计算。
  const dWeights = matmul(dOutput, transpose(V));
  const scale = 1 / Math.sqrt(Q[0].length) / (options.temperature ?? 1);
  const dScores = forward.weights.map((row, i) => {
    // softmax雅可比乘向量：a_j * (g_j - sum_l a_l*g_l)。
    // 先减去最大权重位置的上游梯度。softmax对常量平移不敏感，
    // 此等价写法避免主权重已舍入为1时，用两个接近的大数相减丢失尾部。
    let anchor = 0;
    for (let j = 1; j < row.length; j++) {
      if (row[j] > row[anchor]) anchor = j;
    }
    const reference = dWeights[i][anchor];
    const shifted = dWeights[i].map((g) => g - reference);
    const dot = row.reduce((sum, a, j) => sum + a * shifted[j], 0);
    return row.map((a, j) => a * (shifted[j] - dot));
  });
  const scaled = dScores.map((row) => row.map((x) => x * scale));
  return {
    dQ: matmul(scaled, K),
    dK: matmul(transpose(scaled), Q),
    dV: matmul(transpose(forward.weights), dOutput),
  };
}

// Bahdanau-style scoring core. Project query/key to the same hidden width first.
function additiveAttention(Q, K, V, Wq, Wk, v) {
  const q = matmul(Q, Wq);
  const k = matmul(K, Wk);
  matrixShape(V, "V");
  if (
    q[0].length !== k[0].length ||
    K.length !== V.length ||
    !Array.isArray(v) ||
    v.length !== q[0].length ||
    Array.from(v).some((x) => !Number.isFinite(x))
  )
    throw new RangeError("additive attention dimensions differ");
  const scores = q.map((qRow) =>
    k.map((kRow) =>
      v.reduce((sum, x, i) => sum + x * Math.tanh(qRow[i] + kRow[i]), 0),
    ),
  );
  const weights = scores.map(softmax);
  return { scores, weights, output: matmul(weights, V) };
}

function createAttentionExample(temperature = 1, causal = false) {
  if (typeof causal !== "boolean") {
    throw new TypeError("causal must be boolean");
  }
  const Q = [
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  const K = [
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  const V = [
    [10, 0],
    [0, 20],
    [10, 20],
  ];
  return {
    Q,
    K,
    V,
    ...scaledDotProductAttention(Q, K, V, {
      temperature,
      mask: causal ? causalMask(3) : undefined,
    }),
  };
}

// Optimize one query toward a scalar value. This is an optimization experiment, not OCR training.
function trainQuery({ steps = 120, learningRate = 0.4 } = {}) {
  if (
    !Number.isSafeInteger(steps) ||
    steps < 0 ||
    !Number.isFinite(learningRate) ||
    learningRate <= 0
  )
    throw new RangeError("invalid optimization options");
  const K = [
      [1, 0],
      [0, 1],
    ],
    V = [[0], [1]],
    target = 0.9;
  let Q = [[0, 0]];
  const history = [];
  for (let step = 0; step <= steps; step++) {
    const result = scaledDotProductAttention(Q, K, V);
    const error = result.output[0][0] - target;
    history.push({
      step,
      loss: 0.5 * error * error,
      prediction: result.output[0][0],
    });
    if (step < steps) {
      const { dQ } = attentionBackward(Q, K, V, [[error]]);
      Q = Q.map((row, i) => row.map((x, j) => x - learningRate * dQ[i][j]));
    }
  }
  return { Q, K, V, target, history, ...scaledDotProductAttention(Q, K, V) };
}

module.exports = {
  matrixShape,
  transpose,
  matmul,
  softmax,
  causalMask,
  scaledDotProductAttention,
  attentionBackward,
  additiveAttention,
  createAttentionExample,
  trainQuery,
};
