"use strict";
const {
  createDetectionExample,
  decodeEastRBox,
} = require("../shared/22-text-detection-networks");
const $ = (id) => document.getElementById(id);
let current;
function mapCanvas(id, matrix, max = 1, boxes = []) {
  const canvas = $(id),
    ctx = canvas.getContext("2d"),
    sy = canvas.height / matrix.length,
    sx = canvas.width / matrix[0].length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  matrix.forEach((row, y) =>
    row.forEach((x, i) => {
      const v = Math.max(0, Math.min(1, x / max));
      ctx.fillStyle = `rgb(${Math.round(248 - 225 * v)},${Math.round(248 - 144 * v)},${Math.round(244 - 161 * v)})`;
      ctx.fillRect(i * sx, y * sy, sx, sy);
    }),
  );
  boxes.forEach((box, i) => {
    ctx.strokeStyle = "#d56a21";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      box.x0 * sx,
      box.y0 * sy,
      (box.x1 - box.x0) * sx,
      (box.y1 - box.y0) * sy,
    );
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#542100";
    ctx.fillText(`#${i + 1}`, box.x0 * sx + 5, box.y0 * sy + 20);
  });
}
function sample() {
  const x = Number($("sample-x").value),
    y = Number($("sample-y").value);
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= 48 ||
    y < 0 ||
    y >= 24
  ) {
    $("sample").textContent = "请输入 x=0…47、y=0…23 范围内的整数。";
    return;
  }
  $("sample").textContent = JSON.stringify(
    {
      x,
      y,
      P: current.P[y][x],
      T: current.T[y][x],
      binary: current.binary[y][x],
      dProbability: current.dProbability[y][x],
      dThreshold: current.dThreshold[y][x],
    },
    null,
    2,
  );
}
function east() {
  const degree = Number($("angle").value);
  $("angle-value").textContent = String(degree);
  const geometry = {
    x: 2,
    y: 3,
    top: 1,
    right: 3,
    bottom: 2,
    left: 2,
    angle: (degree * Math.PI) / 180,
  };
  const box = decodeEastRBox(geometry),
    ctx = $("east").getContext("2d");
  const xy = ([x, y]) => [210 + (x - 8) * 34, 150 + (y - 12) * 34];
  ctx.clearRect(0, 0, 420, 300);
  ctx.strokeStyle = "#dbe2df";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 420; i += 34) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 300);
    ctx.stroke();
  }
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#d56a21";
  const [x0, y0] = xy([box.x0, box.y0]);
  ctx.strokeRect(x0, y0, (box.x1 - box.x0) * 34, (box.y1 - box.y0) * 34);
  ctx.setLineDash([]);
  ctx.beginPath();
  box.polygon
    .map(xy)
    .forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.strokeStyle = "#126451";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#182b39";
  ctx.font = "16px sans-serif";
  box.polygon
    .map(xy)
    .forEach(([x, y], i) => ctx.fillText(String(i), x + 5, y - 5));
  ctx.beginPath();
  ctx.arc(210, 150, 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillText("锚点 (8,12)", 220, 150);
  $("east-data").textContent = JSON.stringify(
    { stride: 4, distances: [1, 3, 2, 2], degree, polygon: box.polygon },
    null,
    2,
  );
}
function run() {
  const k = Number($("k").value),
    threshold = Number($("threshold").value),
    expandRatio = Number($("expand").value);
  $("k-value").textContent = String(k);
  $("threshold-value").textContent = threshold.toFixed(2);
  $("expand-value").textContent = expandRatio.toFixed(1);
  current = createDetectionExample({
    k,
    threshold,
    expandRatio,
    blank: $("preset").value === "blank",
  });
  mapCanvas("probability", current.P);
  mapCanvas("threshold-map", current.T);
  mapCanvas("binary", current.binary);
  mapCanvas("gradient", current.dProbability, k / 4);
  mapCanvas("boxes", current.P, 1, current.boxes);
  mapCanvas("db-boxes", current.P, 1, current.dbBoxes);
  $("status").textContent =
    `48×24 合成预测图；P 支路 ${current.boxes.length} 个框，DB 对照 ${current.dbBoxes.length} 个框；理论梯度峰值 k/4 = ${(k / 4).toFixed(2)}`;
  if (!current.boxes.length)
    $("status").textContent +=
      "。P 支路没有满足筛选条件的区域，请对照原始概率图与阈值。";
  $("box-data").textContent = JSON.stringify(
    { probabilityBranch: current.boxes, dbTeachingBranch: current.dbBoxes },
    null,
    2,
  );
  sample();
}
for (const id of ["k", "threshold", "expand"])
  $(id).addEventListener("input", run);
for (const id of ["sample-x", "sample-y"])
  $(id).addEventListener("input", sample);
$("preset").addEventListener("change", run);
$("reset").addEventListener("click", () => {
  $("preset").value = "regions";
  $("k").value = "50";
  $("threshold").value = "0.3";
  $("expand").value = "1";
  $("sample-x").value = "3";
  $("sample-y").value = "8";
  $("angle").value = "30";
  run();
  east();
});
$("angle").addEventListener("input", east);
run();
east();
