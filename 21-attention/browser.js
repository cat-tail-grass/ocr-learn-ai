"use strict";
const {
  scaledDotProductAttention,
  causalMask,
  trainQuery,
} = require("../shared/21-attention");
const $ = (id) => document.getElementById(id);
let current;
function table(id, matrix, name) {
  const node = document.createElement("table"),
    caption = document.createElement("caption");
  caption.textContent = name;
  node.append(caption);
  const header = document.createElement("tr");
  ["行 / 列", ...matrix[0].map((_, i) => String(i))].forEach((x) => {
    const th = document.createElement("th");
    th.textContent = x;
    header.append(th);
  });
  node.append(header);
  matrix.forEach((row, i) => {
    const tr = document.createElement("tr"),
      th = document.createElement("th");
    th.textContent = String(i);
    tr.append(th);
    row.forEach((x) => {
      const td = document.createElement("td");
      td.textContent = x === -Infinity ? "−∞（遮罩）" : x.toFixed(4);
      tr.append(td);
    });
    node.append(tr);
  });
  $(id).replaceChildren(node);
}
function showQuery() {
  if (!current) return;
  const i = Number($("query").value),
    weights = current.weights[i],
    canvas = $("heatmap"),
    ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cell = canvas.width / weights.length;
  weights.forEach((weight, j) => {
    ctx.fillStyle = `rgb(${Math.round(245 - 200 * weight)},${Math.round(248 - 120 * weight)},${Math.round(246 - 160 * weight)})`;
    ctx.fillRect(j * cell, 0, cell - 2, 90);
    ctx.fillStyle = weight > 0.55 ? "#fff" : "#182b39";
    ctx.font = "18px sans-serif";
    ctx.fillText(weight.toFixed(4), j * cell + 10, 45);
    ctx.fillStyle = "#182b39";
    ctx.fillText(`K${j}`, j * cell + 10, 125);
  });
  $("explanation").textContent =
    `查询 ${i} 的权重和 = ${weights.reduce((a, b) => a + b, 0).toFixed(8)}；输出 = ${JSON.stringify(current.output[i].map((x) => Number(x.toFixed(5))))}。输出维度由 V 决定。`;
}
function run() {
  try {
    const Q = JSON.parse($("q").value),
      K = JSON.parse($("k").value),
      V = JSON.parse($("v").value);
    // Bound the interactive table; the algorithm module itself supports larger matrices.
    for (const matrix of [Q, K, V])
      if (
        !Array.isArray(matrix) ||
        matrix.length > 16 ||
        matrix.some((row) => !Array.isArray(row) || row.length > 16)
      )
        throw new Error("页面最多展示 16×16 矩阵");
    if ($("causal").checked && Q.length !== K.length)
      throw new Error(
        "此页面的因果示例要求 Q/K 等长；cross attention 请关闭因果遮罩",
      );
    const temperature = Number($("temperature").value);
    $("temperature-value").textContent = temperature.toFixed(1);
    current = scaledDotProductAttention(Q, K, V, {
      temperature,
      mask: $("causal").checked ? causalMask(Q.length) : undefined,
    });
    table("scores", current.scores, "匹配分数");
    table("weights", current.weights, "每一行沿 key 归一化");
    table("result", current.output, "O = AV");
    const selected = Math.min(Number($("query").value || 0), Q.length - 1);
    $("query").replaceChildren(
      ...Q.map((_, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = `Q${i}`;
        return o;
      }),
    );
    $("query").value = String(selected);
    showQuery();
    $("status").textContent =
      `计算完成：Q ${Q.length}×${Q[0].length}，K ${K.length}×${K[0].length}，V ${V.length}×${V[0].length}，输出 ${current.output.length}×${current.output[0].length}`;
    $("status").className = "status";
  } catch (error) {
    current = null;
    for (const id of ["scores", "weights", "result", "query"])
      $(id).replaceChildren();
    $("heatmap").getContext("2d").clearRect(0, 0, 880, 150);
    $("explanation").textContent = "";
    $("status").textContent = `输入有误：${error.message}`;
    $("status").className = "status error";
  }
}
$("run").addEventListener("click", run);
$("reset").addEventListener("click", () => {
  $("preset").value = "self";
  $("q").value = "[[1,0],[0,1],[1,1]]";
  $("k").value = "[[1,0],[0,1],[1,1]]";
  $("v").value = "[[10,0],[0,20],[10,20]]";
  $("temperature").value = "1";
  $("causal").checked = false;
  $("training").textContent = "运行后查看初始/最终损失与 query。";
  run();
});
$("temperature").addEventListener("input", run);
$("causal").addEventListener("change", run);
$("query").addEventListener("change", showQuery);
$("preset").addEventListener("change", () => {
  $("q").value =
    $("preset").value === "cross" ? "[[1,0]]" : "[[1,0],[0,1],[1,1]]";
  $("k").value = "[[1,0],[0,1],[1,1]]";
  $("v").value = "[[10,0],[0,20],[10,20]]";
  $("causal").checked = false;
  run();
});
$("train").addEventListener("click", () => {
  const r = trainQuery();
  $("training").textContent = JSON.stringify(
    { 初始: r.history[0], 最终: r.history.at(-1), Q: r.Q, 目标: r.target },
    null,
    2,
  );
});
run();
