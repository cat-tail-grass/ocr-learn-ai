"use strict";

const {
  matrixShape,
  matmul,
  causalMask,
  scaledDotProductAttention,
} = require("../21-attention");

function positiveInteger(n, name) {
  if (!Number.isSafeInteger(n) || n < 1)
    throw new RangeError(`${name} must be a positive integer`);
}
function add(a, b) {
  const [n, d] = matrixShape(a),
    [m, e] = matrixShape(b);
  if (n !== m || d !== e) throw new RangeError("addition shapes differ");
  const output = a.map((row, i) => row.map((x, j) => x + b[i][j]));
  matrixShape(output, "addition result");
  return output;
}

function sinusoidalPositionEncoding(length, dimension, offset = 0) {
  positiveInteger(length, "length");
  positiveInteger(dimension, "dimension");
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(offset + length - 1)
  )
    throw new RangeError("invalid position offset");
  return Array.from({ length }, (_, p) =>
    Array.from({ length: dimension }, (_, j) => {
      const angle =
        (p + offset) / Math.pow(10000, (2 * Math.floor(j / 2)) / dimension);
      return j % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
    }),
  );
}

// Flat interleaved HWC input; patch order row-major; inside patch order y,x,channel.
function patchify({ data, width, height, channels = 1 }, patchSize = 2) {
  [width, height, channels, patchSize].forEach((n) =>
    positiveInteger(n, "image/patch dimension"),
  );
  if (width % patchSize || height % patchSize)
    throw new RangeError(
      "image dimensions must be divisible by patchSize; pad explicitly",
    );
  if (
    (!Array.isArray(data) && !ArrayBuffer.isView(data)) ||
    data.length !== width * height * channels ||
    Array.from(data).some((x) => !Number.isFinite(x))
  )
    throw new TypeError("data must contain finite HWC pixels");
  const patches = [],
    positions = [];
  // 先遍历patch起点；再在单个patch内按y/x/channel收集像素。
  for (let y = 0; y < height; y += patchSize) {
    for (let x = 0; x < width; x += patchSize) {
      const patch = [];
      for (let py = 0; py < patchSize; py++) {
        for (let px = 0; px < patchSize; px++) {
          for (let c = 0; c < channels; c++) {
            const imageY = y + py;
            const imageX = x + px;
            const index = (imageY * width + imageX) * channels + c;
            patch.push(data[index]);
          }
        }
      }
      patches.push(patch);
      positions.push({ x, y, width: patchSize, height: patchSize });
    }
  }
  return {
    patches,
    positions,
    gridWidth: width / patchSize,
    gridHeight: height / patchSize,
  };
}

function multiHeadAttention(
  query,
  memory,
  { Wq, Wk, Wv, Wo, numHeads },
  { mask } = {},
) {
  positiveInteger(numHeads, "numHeads");
  const [n, d] = matrixShape(query, "query"),
    [m, md] = matrixShape(memory, "memory");
  if (d !== md || d % numHeads)
    throw new RangeError("equal dModel divisible by numHeads required");
  for (const [name, matrix] of Object.entries({ Wq, Wk, Wv, Wo })) {
    const [r, c] = matrixShape(matrix, name);
    if (r !== d || c !== d)
      throw new RangeError(`${name} must be dModel × dModel`);
  }
  // Step 1：三个独立的D×D投影；列分块后等价于各头独立投影。
  const Q = matmul(query, Wq),
    K = matmul(memory, Wk),
    V = matmul(memory, Wv),
    headSize = d / numHeads;
  const split = (matrix, head) =>
    matrix.map((row) => row.slice(head * headSize, (head + 1) * headSize));
  // Step 2：每个头在自己的通道子空间计算一张权重表。
  const heads = Array.from({ length: numHeads }, (_, head) => {
    const q = split(Q, head),
      k = split(K, head),
      v = split(V, head);
    return {
      Q: q,
      K: k,
      V: v,
      ...scaledDotProductAttention(q, k, v, { mask }),
    };
  });
  // Step 3：拼接的是各头加权后的内容，不是把权重表相加。
  const concatenated = Array.from({ length: n }, (_, i) =>
    heads.flatMap((head) => head.output[i]),
  );
  return {
    Q,
    K,
    V,
    heads,
    concatenated,
    output: matmul(concatenated, Wo),
    shape: { queries: n, keys: m, headSize },
  };
}

function layerNorm(X, { epsilon = 1e-5, gamma, beta } = {}) {
  const [, d] = matrixShape(X, "X");
  if (!Number.isFinite(epsilon) || epsilon <= 0)
    throw new RangeError("epsilon must be positive");
  gamma = gamma ?? Array(d).fill(1);
  beta = beta ?? Array(d).fill(0);
  for (const v of [gamma, beta])
    if (
      !Array.isArray(v) ||
      v.length !== d ||
      Array.from(v).some((x) => !Number.isFinite(x))
    )
      throw new RangeError("invalid layer norm parameters");
  return X.map((row) => {
    const mean = row.reduce((a, b) => a + b, 0) / d;
    const variance = row.reduce((sum, x) => sum + (x - mean) ** 2, 0) / d;
    const out = row.map(
      (x, j) =>
        ((x - mean) / Math.sqrt(variance + epsilon)) * gamma[j] + beta[j],
    );
    if (out.some((x) => !Number.isFinite(x)) || !Number.isFinite(variance))
      throw new RangeError("layerNorm overflow");
    return out;
  });
}

function feedForward(X, { W1, b1, W2, b2 }) {
  const [, d] = matrixShape(X),
    [r, hidden] = matrixShape(W1),
    [s, e] = matrixShape(W2);
  if (
    r !== d ||
    hidden !== s ||
    e !== d ||
    !Array.isArray(b1) ||
    b1.length !== hidden ||
    !Array.isArray(b2) ||
    b2.length !== d ||
    [...b1, ...b2].some((x) => !Number.isFinite(x))
  )
    throw new RangeError("invalid feed-forward dimensions");
  const h = matmul(X, W1).map((row) =>
    row.map((x, j) => Math.max(0, x + b1[j])),
  );
  const output = matmul(h, W2).map((row) => row.map((x, j) => x + b2[j]));
  matrixShape(output, "feed-forward output");
  return output;
}

// A pre-norm block with ReLU FFN; no dropout, batching, training, or KV cache.
function encoderBlock(X, parameters) {
  const normalized = layerNorm(X);
  const attention = multiHeadAttention(
    normalized,
    normalized,
    parameters.attention,
  );
  const residual = add(X, attention.output);
  return {
    attention,
    residual,
    output: add(residual, feedForward(layerNorm(residual), parameters.ffn)),
  };
}

function decoderBlock(tokens, memory, parameters, { causal = true } = {}) {
  if (typeof causal !== "boolean")
    throw new TypeError("causal must be boolean");
  const normalized = layerNorm(tokens);
  const selfAttention = multiHeadAttention(
    normalized,
    normalized,
    parameters.selfAttention,
    { mask: causal ? causalMask(tokens.length) : undefined },
  );
  const selfResidual = add(tokens, selfAttention.output);
  const crossAttention = multiHeadAttention(
    layerNorm(selfResidual),
    memory,
    parameters.crossAttention,
  );
  const crossResidual = add(selfResidual, crossAttention.output);
  return {
    selfAttention,
    crossAttention,
    output: add(
      crossResidual,
      feedForward(layerNorm(crossResidual), parameters.ffn),
    ),
  };
}

function seededMatrixFactory(seed = 23) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError("seed must be uint32");
  let state = seed >>> 0;
  return (rows, cols) => {
    positiveInteger(rows, "rows");
    positiveInteger(cols, "cols");
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return ((state / 4294967296) * 2 - 1) * Math.sqrt(3 / rows);
      }),
    );
  };
}

function createTinyParameters({ dimension = 4, numHeads = 2, seed = 23 } = {}) {
  positiveInteger(dimension, "dimension");
  positiveInteger(numHeads, "numHeads");
  if (dimension % numHeads)
    throw new RangeError("dimension must divide into heads");
  const matrix = seededMatrixFactory(seed),
    d = dimension;
  const attention = () => ({
    Wq: matrix(d, d),
    Wk: matrix(d, d),
    Wv: matrix(d, d),
    Wo: matrix(d, d),
    numHeads,
  });
  const ffn = () => ({
    W1: matrix(d, 2 * d),
    b1: Array(2 * d).fill(0),
    W2: matrix(2 * d, d),
    b2: Array(d).fill(0),
  });
  return {
    encoder: { attention: attention(), ffn: ffn() },
    decoder: {
      selfAttention: attention(),
      crossAttention: attention(),
      ffn: ffn(),
    },
  };
}

// Generic greedy loop. step returns finite vocabulary logits; this function contains no model.
function greedyDecode(
  step,
  { bosId, eosId, maxNewTokens = 16, vocabularySize },
) {
  if (typeof step !== "function")
    throw new TypeError("step must be a function");
  positiveInteger(maxNewTokens, "maxNewTokens");
  positiveInteger(vocabularySize, "vocabularySize");
  if (
    ![bosId, eosId].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n < vocabularySize,
    ) ||
    bosId === eosId
  )
    throw new RangeError("invalid special token ids");
  const prefix = [bosId],
    tokens = [];
  for (let i = 0; i < maxNewTokens; i++) {
    const logits = step(prefix.slice());
    if (
      !Array.isArray(logits) ||
      logits.length !== vocabularySize ||
      Array.from(logits).some((x) => !Number.isFinite(x))
    )
      throw new RangeError("step must return finite vocabulary logits");
    let next = 0;
    for (let j = 1; j < logits.length; j++)
      if (logits[j] > logits[next]) next = j;
    if (next === eosId) return { tokens, stoppedBy: "eos", steps: i + 1 };
    tokens.push(next);
    prefix.push(next);
  }
  return { tokens, stoppedBy: "maxNewTokens", steps: maxNewTokens };
}

function createTransformerExample({
  patchSize = 2,
  numHeads = 2,
  positions = true,
  causal = true,
  pixels,
} = {}) {
  if (typeof positions !== "boolean")
    throw new TypeError("positions must be boolean");
  const width = 8,
    height = 4,
    dimension = 4;
  let data = Array.from({ length: width * height }, (_, i) => {
    const x = i % width,
      y = Math.floor(i / width);
    return (x === 1 && y > 0) ||
      (x >= 4 && x <= 6 && (y === 0 || y === 3 || x === 6))
      ? 1
      : 0;
  });
  if (pixels !== undefined) {
    if (
      !Array.isArray(pixels) ||
      pixels.length !== width * height ||
      Array.from(pixels).some((x) => !Number.isFinite(x) || x < 0 || x > 1)
    ) {
      throw new TypeError(
        "pixels must contain 32 finite grayscale values in [0,1]",
      );
    }
    data = pixels.slice();
  }
  const image = { data, width, height, channels: 1 };
  const patches = patchify(image, patchSize);
  const embeddingMatrix = seededMatrixFactory(101)(
    patchSize * patchSize,
    dimension,
  );
  const embeddings = matmul(patches.patches, embeddingMatrix);
  const positional = sinusoidalPositionEncoding(embeddings.length, dimension);
  const input = positions ? add(embeddings, positional) : embeddings;
  const parameters = createTinyParameters({ dimension, numHeads });
  const encoder = encoderBlock(input, parameters.encoder);
  // Hand-assigned token vectors representing a teacher-forced prefix; no recognition claim.
  const tokenEmbeddings = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
  ];
  const tokens = positions
    ? add(tokenEmbeddings, sinusoidalPositionEncoding(3, dimension))
    : tokenEmbeddings;
  const decoder = decoderBlock(tokens, encoder.output, parameters.decoder, {
    causal,
  });
  return {
    image,
    ...patches,
    embeddings,
    embeddingMatrix,
    positional,
    input,
    encoder,
    decoder,
    parameters,
    tokens,
  };
}

module.exports = {
  add,
  sinusoidalPositionEncoding,
  patchify,
  multiHeadAttention,
  layerNorm,
  feedForward,
  encoderBlock,
  decoderBlock,
  seededMatrixFactory,
  createTinyParameters,
  greedyDecode,
  createTransformerExample,
};
