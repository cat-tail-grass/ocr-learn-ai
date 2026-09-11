"use strict";
const {
  readRecords,
  saveRecords,
  validateRecords,
  annotateRecord,
  summarizeExperiments,
  sampleKindLabel,
} = require("../shared/26-validation");
const $ = (id) => document.getElementById(id);
const percent = (n) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
let records = [],
  groups = [];
function status(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}
function cell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}
function render() {
  const selected = Number($("group").value) || 0;
  groups = summarizeExperiments(records);
  $("group").replaceChildren();
  groups.forEach((group, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${group.experimentId} · ${sampleKindLabel(group.sampleKind)} · ${group.modelId} · 参数 ${group.pipelineId}`;
    $("group").append(option);
  });
  $("group").value = String(Math.min(selected, Math.max(0, groups.length - 1)));
  renderGroup();
}
function renderGroup() {
  const group = groups[Number($("group").value)];
  $("empty").hidden = Boolean(group);
  $("summary").hidden = !group;
  $("rows").replaceChildren();
  $("alignment").replaceChildren();
  if (!group) {
    $("groupInfo").textContent = "本机还没有记录。";
    return;
  }
  const report = group.report;
  $("groupInfo").textContent =
    `模型 ${group.modelId}；处理配置 ${group.pipelineId}。同源重试分轮记录。`;
  $("cer").textContent = percent(report.microCER);
  $("cerFraction").textContent =
    `${report.totalErrors} 次编辑 / ${report.totalTruthCharacters} 个真实字符`;
  $("exact").textContent = percent(report.exactMatchAccuracy);
  $("exactFraction").textContent =
    `${report.exactMatches} 条完全正确 / ${report.evaluatedSamples} 条有效样本`;
  $("count").textContent = String(report.evaluatedSamples);
  $("failures").textContent = `其中 ${report.failedSamples} 张未完成识别或为空`;
  $("errors").textContent =
    `${report.substitutions} / ${report.deletions} / ${report.insertions}`;
  $("pending").textContent =
    `待标注 ${report.pendingSamples} · 排除 ${report.excludedSamples}`;
  for (const row of report.records) {
    const tr = document.createElement("tr");
    tr.append(
      cell(row.filename || row.id),
      cell(row.prediction || "（空结果）", "digits-text"),
    );
    const truthCell = document.createElement("td"),
      truth = document.createElement("input");
    truth.type = "text";
    truth.inputMode = "numeric";
    truth.maxLength = 1000;
    truth.value = row.truth || "";
    truth.setAttribute("aria-label", `${row.filename || row.id} 的正确答案`);
    truthCell.append(truth);
    tr.append(truthCell);
    const exclusionCell = document.createElement("td"),
      exclusion = document.createElement("input");
    exclusion.value = row.exclusionReason || "";
    exclusion.maxLength = 300;
    exclusion.setAttribute(
      "aria-label",
      `${row.filename || row.id} 的排除理由`,
    );
    exclusionCell.append(exclusion);
    tr.append(exclusionCell);
    tr.append(
      cell(
        row.disposition === "pending"
          ? "待标注"
          : row.disposition === "excluded"
            ? "已排除"
            : `${row.exactMatch ? "整串正确" : "整串有误"} · CER ${percent(row.cer)}`,
      ),
    );
    const actions = document.createElement("td"),
      save = document.createElement("button");
    save.className = "secondary";
    save.textContent = "保存标注";
    save.addEventListener("click", () => {
      try {
        const next = annotateRecord(
          records,
          row.id,
          truth.value,
          exclusion.value,
        );
        saveRecords(localStorage, next);
        records = next;
        render();
        status("已保存标注，原始预测保持不变。");
      } catch (error) {
        status(error.message, true);
      }
    });
    const inspect = document.createElement("button");
    inspect.className = "secondary";
    inspect.textContent = "查看对齐";
    inspect.disabled = !row.alignment;
    inspect.addEventListener("click", () => {
      $("alignment").replaceChildren();
      const title = document.createElement("p");
      title.textContent = `${row.filename || row.id}：${row.truth} → ${row.prediction || "空结果"}`;
      $("alignment").append(title);
      for (const step of row.alignment) {
        const span = document.createElement("span");
        span.className = `op ${step.operation}`;
        for (const value of [step.truth ?? "∅", step.prediction ?? "∅"]) {
          const line = document.createElement("span");
          line.textContent = value;
          span.append(line);
        }
        const small = document.createElement("small");
        small.textContent = step.operation;
        span.append(small);
        $("alignment").append(span);
      }
    });
    actions.append(save, document.createTextNode(" "), inspect);
    tr.append(actions);
    $("rows").append(tr);
  }
}
$("group").addEventListener("change", renderGroup);
$("export").addEventListener("click", () => {
  const blob = new Blob(
    [
      JSON.stringify(
        { schemaVersion: 1, exportedAt: new Date().toISOString(), records },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ocr-evaluation-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
$("import").addEventListener("change", async () => {
  try {
    const file = $("import").files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw new Error("记录文件超过 10 MB");
    const data = JSON.parse(await file.text());
    const imported = validateRecords(Array.isArray(data) ? data : data.records);
    // 相同 id 必须完全相同，否则拒绝覆盖本机的原始实验结果。
    const merged = new Map(records.map((row) => [row.id, row]));
    for (const row of imported) {
      if (
        merged.has(row.id) &&
        JSON.stringify(merged.get(row.id)) !== JSON.stringify(row)
      )
        throw new Error(`记录 ${row.id} 与本机已有内容冲突，未覆盖`);
      merged.set(row.id, row);
    }
    const next = validateRecords(Array.from(merged.values()));
    saveRecords(localStorage, next);
    records = next;
    render();
    status(`已合并 ${imported.length} 条记录。重复 id 没有重复计数。`);
  } catch (error) {
    status(`导入失败：${error.message}`, true);
  } finally {
    $("import").value = "";
  }
});
try {
  records = readRecords(localStorage);
  render();
  status(`已读取 ${records.length} 条本机记录。`);
} catch (error) {
  status(
    `无法读取本机记录：${error.message}。请保留原始数据并检查浏览器存储。`,
    true,
  );
}
