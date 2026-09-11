"use strict";
/** 第21章：7组可复现实验。运行：node 21-attention/index.js。
 * 算法在shared/21-attention中；本文件负责中间值、对照和独立自检。
 */
const assert = require("node:assert/strict");
const {
  createAttentionExample,
  trainQuery,
  additiveAttention,
  scaledDotProductAttention: attention,
  attentionBackward,
  causalMask,
  softmax,
} = require("../shared/21-attention");
const section = (title) => console.log(`\n【${title}】`);
function main() {
  console.log("21 Attention：真实数值运算；没有 OCR 训练数据或图像编码器");
  section("实验 1：从 Q/K/V 到匹配分数、softmax 与输出");
  const result = createAttentionExample();
  for (const key of ["Q", "K", "V", "scores", "weights", "output"]) {
    console.log(key);
    console.table(result[key]);
  }
  console.log(
    "第一行第一输出的三项贡献",
    result.weights[0].map((a, j) => a * result.V[j][0]),
  );
  result.weights.forEach((row) =>
    assert(Math.abs(row.reduce((a, b) => a + b) - 1) < 1e-12),
  );
  section("实验 2：同一组输入，改变温度；稳定 softmax 对照");
  console.table(
    [0.2, 1, 3].map((temperature) => ({
      temperature,
      ...createAttentionExample(temperature).weights[0],
    })),
  );
  console.log(
    "exp(1000) 的直接计算",
    Math.exp(1000),
    "；减最大值后",
    softmax([1000, 1001]),
  );
  section("实验 3：self/cross 维度、因果遮罩与未来信息扰动");
  console.log("单个 cross query 输出", attention([[1, 0]], result.K, result.V));
  const causal = createAttentionExample(1, true),
    changedV = [
      [10, 0],
      [0, 20],
      [999, -888],
    ];
  const changed = attention(result.Q, result.K, changedV, {
    mask: causalMask(3),
  });
  console.table(causal.weights);
  assert.deepEqual(changed.output.slice(0, 2), causal.output.slice(0, 2));
  console.log("自检通过：改变未来 V2，Q0/Q1 的输出完全不变");
  section("实验 4：加性注意力，soft 权重与 hard 选择的区别");
  const additive = additiveAttention(
    [[1, 2]],
    [[0], [1]],
    [[10], [30]],
    [[1], [0]],
    [[1]],
    [2],
  );
  console.log("隐藏分数 / 权重 / soft 输出", additive);
  console.log(
    "hard argmax 选择 V1 得 30；soft 混合约 21.9971；两者不是等价实现",
  );
  section("实验 5：用有限差分检查反向梯度");
  const Q = [[0.2, -0.3]],
    K = [
      [1, 0],
      [0, 1],
    ],
    V = [[0], [1]],
    target = 0.9;
  const loss = () => 0.5 * (attention(Q, K, V).output[0][0] - target) ** 2;
  const error = attention(Q, K, V).output[0][0] - target;
  const analytical = attentionBackward(Q, K, V, [[error]]).dQ[0][0],
    original = Q[0][0],
    epsilon = 1e-5;
  Q[0][0] = original + epsilon;
  const plus = loss();
  Q[0][0] = original - epsilon;
  const minus = loss();
  Q[0][0] = original;
  const numerical = (plus - minus) / (2 * epsilon);
  console.table([
    { analytical, numerical, absoluteError: Math.abs(analytical - numerical) },
  ]);
  assert(Math.abs(analytical - numerical) < 1e-8);
  section("实验 6：只学习一个 query 的真实梯度下降");
  const trained = trainQuery();
  console.table(trained.history.filter((row) => row.step % 20 === 0));
  console.log("最终 Q", trained.Q, "目标", trained.target);
  assert(trained.history.at(-1).loss < trained.history[0].loss / 10);
  section("实验 7：错误输入应清楚失败");
  assert.throws(
    () => attention([[1]], [[1]], [[1]], { mask: [[false]] }),
    /allowed/,
  );
  console.log(
    "自检通过：全遮罩行拒绝计算；所有实验自检通过。下一章研究图像中的文字区域定位。",
  );
}
if (require.main === module) main();
module.exports = { main };
