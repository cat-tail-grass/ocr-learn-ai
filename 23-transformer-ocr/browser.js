"use strict";
const { createTransformerExample } = require("../shared/23-transformer-ocr");
const $ = (id) => document.getElementById(id);
let current;
function options(id, count, prefix) {
  const selected = Math.min(Number($(id).value || 0), count - 1);
  $(id).replaceChildren(
    ...Array.from({ length: count }, (_, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${prefix}${i}`;
      return o;
    }),
  );
  $(id).value = String(selected);
}
function drawImage(id, weights) {
  const canvas = $(id),
    ctx = canvas.getContext("2d"),
    sx = canvas.width / current.image.width,
    sy = canvas.height / current.image.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  current.image.data.forEach((value, i) => {
    const x = i % 8,
      y = Math.floor(i / 8);
    // Preserve user-supplied continuous grayscale, not just zero/nonzero polarity.
    ctx.fillStyle = `rgb(${Math.round(247 - 212 * value)},${Math.round(248 - 188 * value)},${Math.round(245 - 187 * value)})`;
    ctx.fillRect(x * sx, y * sy, sx, sy);
  });
  current.positions.forEach((box, i) => {
    if (weights) {
      ctx.fillStyle = `rgba(215,124,45,${0.15 + 0.75 * weights[i]})`;
      ctx.fillRect(box.x * sx, box.y * sy, box.width * sx, box.height * sy);
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#d4772e";
    ctx.strokeRect(box.x * sx, box.y * sy, box.width * sx, box.height * sy);
    ctx.fillStyle = "#fff";
    ctx.fillRect(box.x * sx + 4, box.y * sy + 4, weights ? 106 : 38, 28);
    ctx.fillStyle = "#182b39";
    ctx.font = "16px sans-serif";
    ctx.fillText(
      weights ? `p${i}: ${weights[i].toFixed(3)}` : `p${i}`,
      box.x * sx + 8,
      box.y * sy + 24,
    );
  });
}
function selectedAttention() {
  return $("layer").value === "encoder"
    ? current.encoder.attention
    : $("layer").value === "self"
      ? current.decoder.selfAttention
      : current.decoder.crossAttention;
}
function show() {
  if (!current) return;
  const a = selectedAttention(),
    head = a.heads[Number($("head").value)],
    i = Number($("query").value),
    weights = head.weights;
  const type = $("layer").value;
  $("layer-note").textContent =
    type === "encoder"
      ? "Q/K/V 同来自带上下文的图像 token；每头沿 key 逐行归一化。"
      : type === "self"
        ? "Q/K/V 来自教师强制输入前缀 [BOS,0,0] 的示意向量；开启因果遮罩后只能读到当前位置。"
        : "Q 来自文本解码状态，K/V 来自图像编码器；query 行数与 patch 列数不需要相同。";
  $("selected").textContent = JSON.stringify(
    {
      头: Number($("head").value),
      查询: i,
      权重和: weights[i].reduce((a, b) => a + b, 0),
      加权V: head.output[i],
    },
    null,
    2,
  );
  const canvas = $("attention"),
    ctx = canvas.getContext("2d"),
    w = 800 / weights[0].length,
    h = 380 / weights.length;
  ctx.clearRect(0, 0, 880, 440);
  ctx.font = "16px sans-serif";
  weights.forEach((row, y) =>
    row.forEach((value, x) => {
      ctx.fillStyle = `rgb(${Math.round(246 - 230 * value)},${Math.round(248 - 148 * value)},${Math.round(244 - 156 * value)})`;
      ctx.fillRect(65 + x * w, 30 + y * h, w - 1, h - 1);
      ctx.fillStyle = value > 0.6 ? "#fff" : "#182b39";
      ctx.fillText(value.toFixed(3), 72 + x * w, 32 + y * h + h / 2);
    }),
  );
  ctx.fillStyle = "#182b39";
  weights.forEach((_, y) => ctx.fillText(`Q${y}`, 8, 35 + y * h + h / 2));
  weights[0].forEach((_, x) => ctx.fillText(`K${x}`, 70 + x * w, 20));
  const table = document.createElement("table"),
    tr = document.createElement("tr");
  ["Q / K", ...weights[0].map((_, j) => `K${j}`)].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    tr.append(th);
  });
  table.append(tr);
  weights.forEach((row, y) => {
    const tr = document.createElement("tr"),
      th = document.createElement("th");
    th.textContent = `Q${y}`;
    tr.append(th);
    row.forEach((x) => {
      const td = document.createElement("td");
      td.textContent = x.toFixed(4);
      tr.append(td);
    });
    table.append(tr);
  });
  $("weights").replaceChildren(table);
  $("visual-attention").hidden = type === "self";
  if (type !== "self") drawImage("visual-attention", weights[i]);
  $("visual-note").textContent =
    type === "self"
      ? "此处的 key 是文本前缀位置，不能映射成视觉 patch。"
      : "橙色越浓权重越高；随机参数的权重并不构成可信的字符定位解释。";
  $("projection-data").textContent = JSON.stringify(
    {
      Q: head.Q,
      K: head.K,
      V: head.V,
      加权V: head.output,
      拼接并投影后: a.output,
      编码器注意力残差: current.encoder.residual,
      编码器最终输出: current.encoder.output,
      解码器最终输出: current.decoder.output,
    },
    null,
    2,
  );
}
function selectLayer() {
  if (!current) return;
  const a = selectedAttention();
  options("head", a.heads.length, "头 ");
  options("query", a.heads[0].weights.length, "Q");
  show();
}
function run() {
  try {
    const rows = JSON.parse($("pixels").value);
    if (
      !Array.isArray(rows) ||
      rows.length !== 4 ||
      rows.some((row) => !Array.isArray(row) || row.length !== 8)
    )
      throw new Error("请输入4行8列的像素矩阵");
    const patchSize = Number($("patch").value),
      numHeads = Number($("heads").value);
    current = createTransformerExample({
      patchSize,
      numHeads,
      positions: $("positions").checked,
      causal: $("causal").checked,
      pixels: rows.flat(),
    });
    $("status").className = "status";
    $("status").textContent =
      `图像 4×8×1 → ${current.patches.length}×${patchSize ** 2} patches → ${current.input.length}×4 tokens；${numHeads} 头，每头 ${4 / numHeads} 维；cross attention = 3×${current.input.length}`;
    $("patch-data").textContent = JSON.stringify(
      {
        patches: current.patches,
        embeddingMatrix: current.embeddingMatrix,
        embeddings: current.embeddings,
        位置编码: current.positional,
        编码器输入: current.input,
      },
      null,
      2,
    );
    drawImage("image");
    selectLayer();
  } catch (error) {
    current = null;
    $("status").textContent = `输入有误：${error.message}`;
    $("status").className = "status error";
    for (const id of [
      "patch-data",
      "projection-data",
      "weights",
      "selected",
      "layer-note",
      "visual-note",
    ])
      $(id).textContent = "";
    for (const id of ["image", "attention", "visual-attention"]) {
      const canvas = $(id);
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}
function reset() {
  const initial = createTransformerExample().image.data;
  $("pixels").value = JSON.stringify(
    Array.from({ length: 4 }, (_, y) => initial.slice(y * 8, y * 8 + 8)),
  );
  $("patch").value = "2";
  $("heads").value = "2";
  $("positions").checked = true;
  $("causal").checked = true;
  $("layer").value = "encoder";
  run();
}
for (const id of ["patch", "heads", "positions", "causal"])
  $(id).addEventListener("change", run);
$("layer").addEventListener("change", selectLayer);
$("head").addEventListener("change", show);
$("query").addEventListener("change", show);
$("apply").addEventListener("click", run);
$("reset").addEventListener("click", reset);
reset();
