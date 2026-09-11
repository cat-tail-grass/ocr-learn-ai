const {
  add,
  patchify,
  sinusoidalPositionEncoding: pe,
  multiHeadAttention: mha,
  layerNorm,
  encoderBlock,
  decoderBlock,
  createTinyParameters,
  greedyDecode,
  createTransformerExample,
  feedForward,
} = require("../23-transformer-ocr");
const { causalMask } = require("../21-attention");

function nearMatrix(actual, expected, digits = 10) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((row, i) => {
    expect(row.length).toBe(expected[i].length);
    row.forEach((x, j) => expect(x).toBeCloseTo(expected[i][j], digits));
  });
}
describe("23 Transformer math and model boundaries", () => {
  test("patch layout follows HWC and row-major patch ordering", () => {
    const image = {
      width: 4,
      height: 2,
      channels: 2,
      data: Array.from({ length: 16 }, (_, i) => i),
    };
    expect(patchify(image, 2).patches).toEqual([
      [0, 1, 2, 3, 8, 9, 10, 11],
      [4, 5, 6, 7, 12, 13, 14, 15],
    ]);
  });
  test("sin/cos pairs use same frequency; offset and odd dimension are defined", () => {
    expect(pe(2, 4)[0]).toEqual([0, 1, 0, 1]);
    nearMatrix(
      [pe(2, 4)[1]],
      [[Math.sin(1), Math.cos(1), Math.sin(0.01), Math.cos(0.01)]],
    );
    expect(pe(1, 3, 1)[0]).toEqual(pe(2, 3)[1]);
  });
  test("separate heads really use separate channels, concatenation and Wo", () => {
    const I = [
        [1, 0],
        [0, 1],
      ],
      config = {
        Wq: I,
        Wk: I,
        Wv: I,
        Wo: [
          [2, 0],
          [0, 3],
        ],
        numHeads: 2,
      };
    const r = mha(
      [[1, 2]],
      [
        [1, 0],
        [0, 1],
      ],
      config,
    );
    const a = Math.exp(1) / (1 + Math.exp(1)),
      b = Math.exp(2) / (1 + Math.exp(2));
    nearMatrix(r.output, [[2 * a, 3 * b]]);
    expect(r.heads[0].weights[0][0]).not.toBe(r.heads[1].weights[0][0]);
    expect(r.shape).toEqual({ queries: 1, keys: 2, headSize: 1 });
  });
  test("layerNorm normalizes channels per token including constant rows", () => {
    nearMatrix(
      layerNorm(
        [
          [1, 3],
          [100, 102],
        ],
        { epsilon: 1e-5 },
      ),
      [
        [-1 / Math.sqrt(1.00001), 1 / Math.sqrt(1.00001)],
        [-1 / Math.sqrt(1.00001), 1 / Math.sqrt(1.00001)],
      ],
    );
    expect(layerNorm([[4, 4]])).toEqual([[0, 0]]);
  });
  test("README FFN hand calculation includes ReLU and both linear layers", () => {
    expect(
      feedForward([[1, -2]], {
        W1: [
          [1, 0, 1],
          [0, 1, 1],
        ],
        b1: [0, 0, 0],
        W2: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
        b2: [0, 0],
      }),
    ).toEqual([[1, 2]]);
  });
  test("user pixels change embeddings, invalid grayscale rejected, blank is finite", () => {
    const blank = createTransformerExample({
      pixels: Array(32).fill(0),
      positions: false,
    });
    expect(blank.embeddings.flat().every((x) => x === 0)).toBe(true);
    expect(blank.encoder.output.flat().every(Number.isFinite)).toBe(true);
    expect(() =>
      createTransformerExample({ pixels: Array(32).fill(2) }),
    ).toThrow(/grayscale/);
    expect(() => createTransformerExample({ pixels: [] })).toThrow();
  });
  test("encoder is permutation equivariant without positions; fixed-position addition breaks that identity", () => {
    const X = [
        [1, 0, 2, 3],
        [0, 2, 1, -1],
        [2, 1, 0, 1],
      ],
      order = [2, 0, 1];
    const permute = (m) => order.map((i) => m[i]);
    const p = createTinyParameters().encoder;
    nearMatrix(
      encoderBlock(permute(X), p).output,
      permute(encoderBlock(X, p).output),
    );
    const encoded = encoderBlock(add(X, pe(3, 4)), p).output;
    const shuffled = encoderBlock(add(permute(X), pe(3, 4)), p).output;
    expect(
      Math.max(
        ...shuffled.flatMap((row, i) =>
          row.map((x, j) => Math.abs(x - permute(encoded)[i][j])),
        ),
      ),
    ).toBeGreaterThan(0.01);
  });
  test("full decoder block does not leak future teacher tokens, cross length differs", () => {
    const p = createTinyParameters().decoder;
    const X = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
      ],
      memory = [
        [0.2, 1, -1, 2],
        [1, -2, 1, 3],
      ];
    const before = decoderBlock(X, memory, p);
    X[2] = [99, -60, 30, 17];
    nearMatrix(
      decoderBlock(X, memory, p).output.slice(0, 2),
      before.output.slice(0, 2),
    );
    expect(before.crossAttention.heads[0].weights).toHaveLength(3);
    expect(before.crossAttention.heads[0].weights[0]).toHaveLength(2);
    expect(before.selfAttention.heads[0].weights[0]).toEqual([1, 0, 0]);
  });
  test("greedy decoder preserves zero/repeated token ids and stops at EOS", () => {
    const ids = [0, 0, 1, 3],
      prefixes = [];
    const r = greedyDecode(
      (prefix) => {
        prefixes.push(prefix);
        return Array.from({ length: 4 }, (_, i) =>
          i === ids[prefix.length - 1] ? 1 : 0,
        );
      },
      { bosId: 2, eosId: 3, vocabularySize: 4 },
    );
    expect(r).toEqual({ tokens: [0, 0, 1], stoppedBy: "eos", steps: 4 });
    expect(prefixes[2]).toEqual([2, 0, 0]);
    expect(
      greedyDecode(() => [2, 0, 0], {
        bosId: 1,
        eosId: 2,
        vocabularySize: 3,
        maxNewTokens: 2,
      }).stoppedBy,
    ).toBe("maxNewTokens");
  });
  test("both demo patch sizes and head counts have finite outputs", () => {
    for (const patchSize of [2, 4])
      for (const numHeads of [1, 2, 4]) {
        const r = createTransformerExample({ patchSize, numHeads });
        expect(r.patches).toHaveLength(32 / patchSize ** 2);
        expect(r.encoder.output.flat().every(Number.isFinite)).toBe(true);
        expect(r.decoder.output).toHaveLength(3);
      }
  });
  test("rejects shape mismatch, implicit crop, invalid normalization and generation", () => {
    expect(() =>
      patchify({ width: 3, height: 2, data: [1, 2, 3, 4, 5, 6] }, 2),
    ).toThrow(/divisible/);
    expect(() => pe(2, 0)).toThrow();
    expect(() => createTinyParameters({ numHeads: 3 })).toThrow();
    expect(() =>
      mha([[1, 2]], [[1, 2]], createTinyParameters().encoder.attention),
    ).toThrow();
    expect(() => layerNorm([[1, 2]], { epsilon: 0 })).toThrow();
    expect(() =>
      greedyDecode(() => [NaN], { bosId: 0, eosId: 1, vocabularySize: 2 }),
    ).toThrow();
    expect(() =>
      mha(
        [[1, 2, 3, 4]],
        [[1, 2, 3, 4]],
        createTinyParameters().encoder.attention,
        { mask: causalMask(2) },
      ),
    ).toThrow();
  });
  test("a missing first logit cannot force ID zero instead of the actual EOS maximum", () => {
    expect(() => greedyDecode(() => [, 0, 10], {
      bosId: 1, eosId: 2, vocabularySize: 3, maxNewTokens: 1,
    })).toThrow(/finite/);
    expect(greedyDecode(() => [-10, 0, 10], {
      bosId: 1, eosId: 2, vocabularySize: 3, maxNewTokens: 1,
    })).toEqual({ tokens: [], stoppedBy: "eos", steps: 1 });
  });
});
