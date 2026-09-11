"use strict";
/** 第22章：6组预测图/几何实验。运行：node 22-text-detection-networks/index.js。
 * 可额外传入预测图JSON路径，仅执行后处理；没有隐式模型下载或网络训练。
 */
const assert = require("node:assert/strict");
const {
  createDetectionExample,
  differentiableBinarize,
  dbBinaryCrossEntropy,
  decodeEastRBox,
  extractBoxes,
  nms,
  boxIoU,
  mapBoxToOriginal,
} = require("../shared/22-text-detection-networks");
const section = (title) => console.log(`\n【${title}】`);
function main() {
  if (process.argv[2]) {
    // Optional adapter for already-computed probability maps. This does not load a detector model.
    const payload = JSON.parse(
      require("node:fs").readFileSync(process.argv[2], "utf8"),
    );
    console.log(
      JSON.stringify(nms(extractBoxes(payload.P, payload.options)), null, 2),
    );
    return;
  }
  const r = createDetectionExample();
  console.log("22 合成预测图实验：没有 CNN 主干，没有训练模型");
  section("实验 1：P、T、软二值图的可手算切片与 k 对照");
  const P = [[0.3, 0.5, 0.7]],
    T = [[0.5, 0.5, 0.5]];
  console.log("输入 P", P, "T", T);
  console.table(
    [1, 10, 50].map((k) => {
      const d = differentiableBinarize(P, T, k);
      return {
        k,
        low: d.binary[0][0],
        equal: d.binary[0][1],
        high: d.binary[0][2],
        peakGradient: d.dProbability[0][1],
      };
    }),
  );
  assert.equal(differentiableBinarize(P, T).dProbability[0][1], 12.5);
  section("实验 2：DB 的 BCE 梯度与有限差分");
  const p = 0.51,
    t = 0.48,
    epsilon = 1e-6,
    bce = dbBinaryCrossEntropy(p, t, 1, 12);
  const finiteDifference =
    (dbBinaryCrossEntropy(p + epsilon, t, 1, 12).loss -
      dbBinaryCrossEntropy(p - epsilon, t, 1, 12).loss) /
    (2 * epsilon);
  console.table([
    {
      ...bce,
      finiteDifference,
      absoluteError: Math.abs(bce.dProbability - finiteDifference),
    },
  ]);
  assert(Math.abs(bce.dProbability - finiteDifference) < 1e-7);
  section("实验 3：同一张合成 P/T 图，两条后处理支路");
  console.table(
    [0, 3, 6, 9, 12, 15].map((x) => ({
      x,
      y: 8,
      P: r.P[8][x],
      T: r.T[8][x],
      binary: r.binary[8][x],
    })),
  );
  console.log("P > 0.3：连通域 → 按组件平均 P 过滤 → 矩形扩张 → NMS");
  console.table(r.boxes);
  console.log("B̂ > 0.5：教学对照，以 P 计算组件分数");
  console.table(r.dbBoxes);
  assert.equal(r.boxes.length, 2);
  assert.equal(r.dbBoxes.length, 2);
  console.table(
    [0.1, 0.3, 0.6, 0.9].map((threshold) => ({
      threshold,
      retained: createDetectionExample({ threshold }).boxes.length,
    })),
  );
  section("实验 4：EAST 距离与角度恢复顶点");
  const geometry = { x: 2, y: 3, top: 1, right: 3, bottom: 2, left: 2 };
  for (const angle of [0, Math.PI / 6, Math.PI / 2]) {
    const box = decodeEastRBox({ ...geometry, angle });
    console.log(
      "角度（度）",
      (angle * 180) / Math.PI,
      "锚点(8,12)，四条距离(1,3,2,2)",
    );
    console.table(box.polygon);
  }
  assert.deepEqual(decodeEastRBox(geometry).polygon, [
    [6, 11],
    [11, 11],
    [11, 14],
    [6, 14],
  ]);
  section("实验 5：独立手算 IoU 与 NMS 对照");
  const a = { x0: 0, y0: 0, x1: 4, y1: 4, score: 0.9 },
    b = { x0: 2, y0: 0, x1: 6, y1: 4, score: 0.8 };
  console.log("交集=8，并集=24，IoU=", boxIoU(a, b));
  console.table(
    [0.3, 0.4].map((threshold) => ({
      threshold,
      kept: nms([a, b], threshold).length,
    })),
  );
  assert.equal(nms([a, b], 0.3).length, 1);
  assert.equal(nms([a, b], 0.4).length, 2);
  section("实验 6：撤销 padding/缩放，以及空图和坏输入");
  const mapped = mapBoxToOriginal(
    { x0: 8, y0: 10, x1: 20, y1: 18 },
    { scaleX: 2, scaleY: 2, padX: 4, padY: 6, width: 20, height: 10 },
  );
  console.log("输入框 [8,10,20,18)，撤销 padding=(4,6)、scale=2 后", mapped);
  assert.deepEqual(mapped, { x0: 2, y0: 2, x1: 8, y1: 6 });
  assert.deepEqual(
    extractBoxes([
      [0, 0],
      [0, 0],
    ]),
    [],
  );
  assert.throws(() => differentiableBinarize([[1]], [[0, 0]]), /shapes/);
  console.log(
    "所有实验自检通过。框只回答在哪里；下一章研究图像序列怎样转换为文本。",
  );
}
if (require.main === module) main();
module.exports = { main };
