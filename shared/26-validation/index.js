/** 第 26 章：评估记录管理。只存字符串与配置，不把照片发送到服务器。 */
const { evaluatePredictions } = require("../24-post-processing");
const STORAGE_KEY = "ocr-photo-evaluation-v1";

function validateRecords(records) {
  if (!Array.isArray(records) || records.length > 2000)
    throw new Error("记录须为数组，单次最多 2000 条");
  const ids = new Set();
  const samples = new Set();
  for (const row of records) {
    if (!row || typeof row.id !== "string" || !row.id.trim() || ids.has(row.id))
      throw new Error("每条记录须有唯一的非空 id");
    ids.add(row.id);
    for (const field of ["imageId", "experimentId", "modelId", "pipelineId", "sampleKind"]) {
      if (row[field] != null && typeof row[field] !== "string")
        throw new Error(`${field} 须为字符串，缺失时请留空`);
    }
    if (row.imageId && row.experimentId) {
      const sampleKey = JSON.stringify([row.imageId, row.experimentId]);
      if (samples.has(sampleKey))
        throw new Error("同一实验轮次包含重复的照片，请保留首次预测记录");
      samples.add(sampleKey);
    }
    if (
      (row.truth && row.truth.length > 1000) ||
      (row.prediction && row.prediction.length > 1000)
    )
      throw new Error("每条数字串最多 1000 个字符");
  }
  evaluatePredictions(records);
  return records;
}

/** 恢复原始记录，损坏内容报错而不是悄悄丢弃现场结果。 */
function readRecords(storage) {
  const data = storage.getItem(STORAGE_KEY);
  if (!data) return [];
  return validateRecords(JSON.parse(data));
}
function saveRecords(storage, records) {
  validateRecords(records);
  storage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * 同一照片的重试不覆写原始预测。模型或配置不同的运行保留为不同实验，
 * 界面按 experimentId 分组评分，避免把一次重试当作新增测试样本。
 */
function appendRecord(records, record) {
  validateRecords(records);
  if (
    records.some(
      (row) =>
        row.imageId &&
        row.imageId === record.imageId &&
        row.experimentId === record.experimentId,
    )
  ) {
    throw new Error(
      "本轮已记录这张照片。保留首次结果；重试请建立新的实验轮次。",
    );
  }
  return validateRecords([...records, record]);
}

function annotateRecord(records, id, truth, exclusionReason = "") {
  if (truth !== "" && (typeof truth !== "string" || !/^[0-9]+$/.test(truth)))
    throw new Error("正确答案只能包含数字 0–9；留空表示待标注");
  let found = false;
  const next = records.map((row) => {
    if (row.id !== id) return row;
    found = true;
    return {
      ...row,
      truth: truth || null,
      exclusionReason,
      annotatedAt: new Date().toISOString(),
    };
  });
  if (!found) throw new Error("记录不存在");
  return validateRecords(next);
}

function summarizeExperiments(records) {
  validateRecords(records);
  const groups = new Map();
  for (const row of records) {
    const key = JSON.stringify([
      row.experimentId || "unversioned",
      row.modelId || "unknown",
      row.sampleKind || "unknown",
      row.pipelineId || "unknown",
    ]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Array.from(groups.values()).map((rows) => ({
    experimentId: rows[0].experimentId || "unversioned",
    modelId: rows[0].modelId || "unknown",
    sampleKind: rows[0].sampleKind || "unknown",
    pipelineId: rows[0].pipelineId || "unknown",
    report: evaluatePredictions(rows),
  }));
}

/** 缺少来源不能推断成实拍；其他来源也须与手机照片分开呈现。 */
function sampleKindLabel(kind) {
  if (kind === "photo") return "实拍照片";
  if (kind === "synthetic-mnist") return "合成样例";
  if (!kind || kind === "unknown") return "来源未标注";
  return `其他来源：${kind}`;
}

module.exports = {
  STORAGE_KEY,
  validateRecords,
  readRecords,
  saveRecords,
  appendRecord,
  annotateRecord,
  summarizeExperiments,
  sampleKindLabel,
};
