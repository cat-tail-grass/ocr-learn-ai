"use strict";
/** 第23章：7组随机参数前向实验。运行：node 23-transformer-ocr/index.js。
 * 展示维度、位置、多头、残差、因果与生成逻辑；输出不构成OCR识别。
 */
const assert = require("node:assert/strict");
const {
  createTransformerExample,
  encoderBlock,
  decoderBlock,
  layerNorm,
  add,
  sinusoidalPositionEncoding,
  greedyDecode,
  patchify,
} = require("../shared/23-transformer-ocr");
const section = (title) => console.log(`\n【${title}】`);
function main() {
  const r = createTransformerExample();
  console.log("23 固定种子 Transformer 前向实验：随机权重，无 OCR 识别能力");
  section("实验 1：图像 → patch → 线性映射；逐个维度追踪");
  console.table(
    Array.from({ length: 4 }, (_, y) => r.image.data.slice(y * 8, y * 8 + 8)),
  );
  console.log("维度", {
    image: [4, 8, 1],
    patches: [r.patches.length, r.patches[0].length],
    tokens: [r.input.length, 4],
    heads: 2,
    headSize: 2,
    decoderCross: [3, r.input.length],
  });
  console.log("patch");
  console.table(r.patches);
  console.log("第一个 patch 的输入、投影矩阵与输出", r.patches[0]);
  console.table(r.embeddingMatrix);
  console.table([r.embeddings[0]]);
  section("实验 2：位置编码的频率与排列等变性");
  console.log("位置编码");
  console.table(r.positional);
  const reverse = (m) => m.slice().reverse();
  const p = r.parameters.encoder;
  const maxError = (a, b) =>
    Math.max(
      ...a.flatMap((row, i) => row.map((x, j) => Math.abs(x - b[i][j]))),
    );
  const noPositionError = maxError(
    encoderBlock(reverse(r.embeddings), p).output,
    reverse(encoderBlock(r.embeddings, p).output),
  );
  const withPositionError = maxError(
    encoderBlock(
      add(
        reverse(r.embeddings),
        sinusoidalPositionEncoding(r.embeddings.length, 4),
      ),
      p,
    ).output,
    reverse(r.encoder.output),
  );
  console.table([{ noPositionError, withPositionError }]);
  assert(noPositionError < 1e-12);
  assert(withPositionError > 0.1);
  section("实验 3：两个头独立产生权重；拼接再投影");
  console.log("第一查询投影后的 Q", r.encoder.attention.Q[0]);
  console.log("head 0 weights");
  console.table(r.encoder.attention.heads[0].weights);
  console.log("head 1 weights");
  console.table(r.encoder.attention.heads[1].weights);
  console.log(
    "拼接前 head0 / head1",
    r.encoder.attention.heads.map((head) => head.output[0]),
  );
  console.log(
    "拼接后",
    r.encoder.attention.concatenated[0],
    "Wo 投影后",
    r.encoder.attention.output[0],
  );
  section("实验 4：LayerNorm、残差与逐位置 FFN");
  console.log("LN([1,3]) =", layerNorm([[1, 3]]));
  console.log(
    "输入第一行",
    r.input[0],
    "第一残差",
    r.encoder.residual[0],
    "经过 FFN 后",
    r.encoder.output[0],
  );
  section("实验 5：因果遮罩与视觉 cross attention");
  console.table(r.decoder.selfAttention.heads[0].weights);
  console.log("decoder cross attention");
  console.table(r.decoder.crossAttention.heads[0].weights);
  const changedTokens = r.tokens.map((row) => row.slice());
  changedTokens[2] = [90, -30, 20, 80];
  const changed = decoderBlock(
    changedTokens,
    r.encoder.output,
    r.parameters.decoder,
  );
  const causalError = maxError(
    changed.output.slice(0, 2),
    r.decoder.output.slice(0, 2),
  );
  assert(causalError < 1e-12);
  console.log("改变未来 token 后前两行误差", causalError);
  section("实验 6：生成循环保留重复零、遇到 EOS 停止");
  const scripted = [0, 0, 1, 3];
  const decoded = greedyDecode(
    (prefix) => {
      console.log("已知前缀", prefix);
      return Array.from({ length: 4 }, (_, i) =>
        i === scripted[prefix.length - 1] ? 1 : 0,
      );
    },
    { bosId: 2, eosId: 3, vocabularySize: 4 },
  );
  console.log("受控 logits 测试生成循环，非图像预测", decoded);
  assert.deepEqual(decoded.tokens, [0, 0, 1]);
  section("实验 7：patch 大小改变 token 数与注意力存储；非法裁剪应失败");
  console.table(
    [2, 4].map((patchSize) => {
      const count = patchify(r.image, patchSize).patches.length;
      return {
        patchSize,
        tokens: count,
        weightsPerLayerTwoHeads: 2 * count * count,
      };
    }),
  );
  assert.throws(
    () => patchify({ width: 3, height: 2, data: [0, 0, 0, 0, 0, 0] }, 2),
    /divisible/,
  );
  console.log(
    "所有实验自检通过。下一章将区分模型分数、字符错误率与整串正确率。",
  );
}
if (require.main === module) main();
module.exports = { main };
