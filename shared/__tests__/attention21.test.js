const {
  softmax,
  matmul,
  scaledDotProductAttention: attention,
  attentionBackward,
  causalMask,
  additiveAttention,
  createAttentionExample,
  trainQuery,
} = require("../21-attention");

describe("21 Attention: independently check arithmetic, masks and reverse derivatives", () => {
  test("known softmax and rectangular matrix product", () => {
    expect(softmax([1000, 1000])).toEqual([0.5, 0.5]);
    expect(softmax([Math.log(2), 0, -Infinity])).toEqual([2 / 3, 1 / 3, 0]);
    expect(matmul([[1, 2, 3]], [[2], [3], [4]])).toEqual([[20]]);
  });
  test("non-square cross attention: weights sum to one and weighted values match by hand", () => {
    const result = attention(
      [[1, 0]],
      [
        [1, 0],
        [0, 1],
      ],
      [[10], [20]],
    );
    const expected = 1 / (1 + Math.exp(-1 / Math.sqrt(2)));
    expect(result.weights[0][0]).toBeCloseTo(expected, 12);
    expect(result.output[0][0]).toBeCloseTo(
      10 * expected + 20 * (1 - expected),
      12,
    );
    expect(result.weights[0].reduce((a, b) => a + b)).toBeCloseTo(1, 14);
  });
  test("temperature changes distribution and causal mask zeros forbidden keys", () => {
    expect(createAttentionExample(0.2).weights[0][1]).toBeLessThan(
      createAttentionExample(2).weights[0][1],
    );
    const result = createAttentionExample(1, true);
    expect(result.weights[0]).toEqual([1, 0, 0]);
    expect(result.weights[1][2]).toBe(0);
    expect(result.output[0]).toEqual([10, 0]);
  });
  test("causal future K/V perturbation cannot alter preceding output", () => {
    const Q = [[1], [2], [3]],
      K = [[1], [2], [3]],
      V = [[2], [4], [6]],
      mask = causalMask(3);
    const original = attention(Q, K, V, { mask });
    K[2][0] = 800;
    V[2][0] = -999;
    expect(attention(Q, K, V, { mask }).output.slice(0, 2)).toEqual(
      original.output.slice(0, 2),
    );
  });
  test.each([false, true])(
    "Q/K/V gradients match central differences, masked=%s",
    (masked) => {
      const Q = [
          [0.2, -0.5],
          [0.7, 0.3],
        ],
        K = [
          [0.1, 0.9],
          [-0.2, 0.4],
        ],
        V = [
          [1, 2, -1],
          [3, 0, 1],
        ];
      const dOut = [
        [0.2, -0.4, 0.1],
        [-0.3, 0.6, 0.2],
      ];
      const options = {
        temperature: 0.7,
        mask: masked ? causalMask(2) : undefined,
      };
      const gradients = attentionBackward(Q, K, V, dOut, options);
      const loss = () =>
        attention(Q, K, V, options).output.reduce(
          (sum, row, i) => sum + row.reduce((s, x, j) => s + x * dOut[i][j], 0),
          0,
        );
      for (const [name, matrix] of Object.entries({ Q, K, V }))
        matrix.forEach((row, i) =>
          row.forEach((x, j) => {
            const epsilon = 1e-5;
            matrix[i][j] = x + epsilon;
            const plus = loss();
            matrix[i][j] = x - epsilon;
            const minus = loss();
            matrix[i][j] = x;
            expect(gradients[`d${name}`][i][j]).toBeCloseTo(
              (plus - minus) / (2 * epsilon),
              8,
            );
          }),
        );
    },
  );
  test("additive attention uses a tanh hidden score and supports different query/key widths", () => {
    const r = additiveAttention(
      [[1, 2]],
      [[0], [1]],
      [[10], [30]],
      [[1], [0]],
      [[1]],
      [2],
    );
    const a = Math.exp(2 * Math.tanh(1)),
      b = Math.exp(2 * Math.tanh(2));
    expect(r.output[0][0]).toBeCloseTo((10 * a + 30 * b) / (a + b), 12);
  });
  test("query-only optimization measurably reduces objective, deterministic", () => {
    const r = trainQuery();
    expect(r.history[0].loss).toBeCloseTo(0.08, 12);
    expect(r.history.at(-1).loss).toBeLessThan(0.005);
    expect(r).toEqual(trainQuery());
  });
  test("rejects malformed inputs, fully masked rows and numerical overflow", () => {
    expect(() => softmax([])).toThrow();
    expect(() => softmax([-Infinity])).toThrow(/allowed/);
    expect(() => softmax([NaN])).toThrow();
    expect(() => matmul([[1, 2]], [[1, 2]])).toThrow(/dimensions/);
    expect(() => attention([[1]], [[1]], [[1]], { mask: [[0]] })).toThrow(
      /boolean/,
    );
    expect(() => attention([[1]], [[1]], [[1]], { mask: [[false]] })).toThrow(
      /allowed/,
    );
    expect(() => attention([[1]], [[1]], [[1]], { temperature: 0 })).toThrow();
    expect(() => attention([[1e300]], [[1e300]], [[1]])).toThrow();
    expect(() => attention([[1, 2], [1]], [[1]], [[1]])).toThrow();
  });
  test("missing entries cannot become implicit masked positions or softmax probabilities", () => {
    expect(() => softmax([1, , 0])).toThrow();
    expect(() => attention([[1, , 0]], [[1, 1, 0]], [[1]])).toThrow();
    expect(() => attention([[0]], [[1], [2]], [[10], [20]], {
      mask: [[true, ,]],
    })).toThrow(/boolean/);
    expect(() => additiveAttention([[0]], [[0], [1]], [[10], [20]], [[1]], [[1]], new Array(1))).toThrow();
  });
  test("a finite negative score overflowing during scaling cannot masquerade as a mask", () => {
    expect(() => attention([[-Number.MAX_VALUE]], [[1], [0]], [[10], [20]], {
      temperature: 0.5,
    })).toThrow(/overflow/);
    // 显式遮罩仍允许同一位置：溢出检查仅检查实际可见的缩放分数。
    expect(attention([[-Number.MAX_VALUE]], [[1], [0]], [[10], [20]], {
      temperature: 0.5, mask: [[false, true]],
    }).weights).toEqual([[0, 1]]);
  });
  test("a dominant softmax weight rounded to one keeps the analytic tail gradient", () => {
    // O=exp(q)/(exp(q)+1)，独立闭式导数为exp(-q)/(1+exp(-q))²。
    const Q = [[50]], K = [[1], [0]], V = [[1], [0]];
    const expected = Math.exp(-50) / (1 + Math.exp(-50)) ** 2;
    const gradients = attentionBackward(Q, K, V, [[1]]);
    expect(attention(Q, K, V).weights[0][0]).toBe(1);
    expect(gradients.dQ[0][0] / expected).toBeCloseTo(1, 14);
    expect(gradients.dK[0][0] / (50 * expected)).toBeCloseTo(1, 14);
    expect(gradients.dK[1][0] / (-50 * expected)).toBeCloseTo(1, 14);
  });
});
