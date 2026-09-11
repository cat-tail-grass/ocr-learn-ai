/**
 * 第 26 章：评估口径与实验记录的 Node.js 教学实验。
 * 运行：node 26-validation/index.js
 * 前六个实验为可手算的评分例子；第七个读取已经实测保存的图像报告。
 * 本脚本不会重新训练、把正确答案送进模型，或编造实拍识别结果。
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {
  alignSequences,
  evaluatePredictions,
} = require("../shared/24-post-processing");
const {
  appendRecord,
  annotateRecord,
  summarizeExperiments,
  readRecords,
  saveRecords,
} = require("../shared/26-validation");

function section(number, title) {
  console.log(
    `\n${"=".repeat(58)}\n实验 ${number}：${title}\n${"=".repeat(58)}`,
  );
}
function showReport(report) {
  console.table({
    已标注有效照片: report.evaluatedSamples,
    真实字符总数: report.totalTruthCharacters,
    替换: report.substitutions,
    删除: report.deletions,
    插入: report.insertions,
    CER: report.microCER,
    整串完全正确率: report.exactMatchAccuracy,
    待标注: report.pendingSamples,
    排除: report.excludedSamples,
    失败: report.failedSamples,
  });
}
function main() {
  console.log("第 26 章：从“看起来识别对了”到可复核的评估");
  section(1, "用一次漏字观察逐位比较的问题");
  const truth = "1203",
    prediction = "123";
  const comparison = alignSequences(truth, prediction);
  console.log(
    `正确答案 ${truth}，预测 ${prediction}；中间漏0，不应把后续3也算错。`,
  );
  console.table(comparison.alignment);
  assert.equal(comparison.distance, 1);
  assert.equal(comparison.deletions, 1);
  console.log("最小编辑距离=1；CER=1/4=25%；整串完全正确=否。");

  section(2, "不同长度样本应该按字符总数合并");
  const rows = [
    { id: "a", truth: "12", prediction: "12" },
    { id: "b", truth: "1203", prediction: "123" },
  ];
  const report = evaluatePredictions(rows);
  showReport(report);
  assert.equal(report.microCER, 1 / 6);
  assert.equal(report.exactMatchAccuracy, 1 / 2);
  console.log("总体 CER=1/(2+4)=16.67%，不是 (0%+25%)/2=12.5%。");
  console.log(
    "两张照片中一张完全正确，所以整串正确率=50%。两种指标回答不同问题。",
  );

  section(3, "前导零、重复字符与过量插入");
  for (const pair of [
    ["00110", "00110"],
    ["00110", "0110"],
    ["1", "1111"],
  ]) {
    const row = evaluatePredictions([
      { id: pair[0], truth: pair[0], prediction: pair[1] },
    ]);
    console.log(
      `${JSON.stringify(pair[0])} → ${JSON.stringify(pair[1])}：S=${row.substitutions} D=${row.deletions} I=${row.insertions} CER=${row.microCER}`,
    );
  }
  assert.equal(
    evaluatePredictions([{ truth: "1", prediction: "1111" }]).microCER,
    3,
  );
  console.log(
    "CER=300%是3次插入/1个真值字符；不能截断，也不能把1−CER称为准确率。",
  );

  section(4, "失败、待标注和排除是三种不同状态");
  const states = evaluatePredictions([
    { id: "failed", truth: "305", prediction: "", status: "failed" },
    { id: "pending", truth: null, prediction: "17" },
    {
      id: "outside-scope",
      truth: "888",
      prediction: "8",
      exclusionReason: "多行重叠，超出已约定单行输入范围",
    },
  ]);
  showReport(states);
  assert.equal(states.evaluatedSamples, 1);
  assert.equal(states.microCER, 1);
  console.log("有效照片没识别出来必须计为3次删除；不能因失败移出分母。");
  console.log(
    "空数据集的比例是 null：",
    evaluatePredictions([]).microCER,
    "，不是“零错误”。",
  );

  section(5, "标注和重试不能改写原始预测");
  const first = {
    id: "first",
    imageId: "same-image",
    experimentId: "round-1",
    modelId: "model-1",
    sampleKind: "photo",
    prediction: "0010",
    truth: null,
    status: "ok",
  };
  const raw = appendRecord([], first);
  const annotated = annotateRecord(raw, "first", "00110");
  assert.equal(annotated[0].prediction, "0010");
  assert.equal(raw[0].truth, null);
  console.log(
    "补标注后：",
    annotated[0].truth,
    "；原始预测仍为：",
    annotated[0].prediction,
  );
  try {
    appendRecord(raw, { ...first, id: "retry", prediction: "00110" });
  } catch (error) {
    console.log("同图同轮重试被拒绝：", error.message);
  }
  console.log(
    "看到错误后调整算法属于下一轮开发；该照片不能继续冒充新模型的未见测试。",
  );

  section(6, "模型、配置和来源应分组，记录应可保存恢复");
  const variants = [
    { ...annotated[0], id: "photo" },
    {
      ...annotated[0],
      id: "synthetic",
      imageId: "synthetic-image",
      sampleKind: "synthetic-mnist",
    },
    {
      ...annotated[0],
      id: "new-model",
      experimentId: "round-2",
      modelId: "model-2",
    },
  ];
  const groups = summarizeExperiments(variants);
  console.table(
    groups.map((group) => ({
      model: group.modelId,
      source: group.sampleKind,
      photos: group.report.evaluatedSamples,
      cer: group.report.microCER,
    })),
  );
  assert.equal(groups.length, 3);
  const unknownSource = summarizeExperiments([
    { id: "legacy", truth: "001", prediction: "001" },
    { id: "explicit-photo", truth: "001", prediction: "001", sampleKind: "photo" },
  ]);
  assert.deepEqual(unknownSource.map(group => group.sampleKind), ["unknown", "photo"]);
  console.log("缺少来源字段的旧记录单列为 unknown，不自动计入实拍组。");
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key),
    setItem: (key, value) => memory.set(key, value),
  };
  saveRecords(storage, variants);
  assert.deepEqual(readRecords(storage), variants);
  console.log(
    "JSON 保存/读取往返保持一致。浏览器演示把相同结构存储在本机，并支持文件导出。",
  );

  section(7, "读取本项目真实运行过的报告");
  const digitReportPath = path.join(
    __dirname,
    "../17-cnn-classifier/model/training-report.json",
  );
  if (fs.existsSync(digitReportPath)) {
    const digitReport = JSON.parse(fs.readFileSync(digitReportPath, "utf8"));
    console.log(
      "标准单数字测试：",
      digitReport.modelId,
      `${digitReport.test.correct}/${digitReport.test.count} = ${(digitReport.test.accuracy * 100).toFixed(2)}%`,
    );
  }
  const developmentReportPath = path.join(__dirname, "development-report.json");
  if (fs.existsSync(developmentReportPath)) {
    const imageReport = JSON.parse(
      fs.readFileSync(developmentReportPath, "utf8"),
    );
    console.log("合成数字行开发报告：", imageReport.description);
    showReport(imageReport.summary);
  } else
    console.log(
      "尚无合成行报告；运行 node 26-validation/prepare-fixtures.js，再运行 node 26-validation/evaluate-images.js。",
    );
  console.log(
    "实拍照片成绩：待采集并独立测量。以上标准数字和合成行都不能替代实拍成绩。",
  );

  section(8, "把真实照片接入下一次分享");
  console.log(
    "准备模型 → 冻结配置 → 同事写数字拍照 → 保存原图 → 导入识别 → 记录首次预测 → 录入答案 → 导出逐图记录。",
  );
  console.log(
    "有原图/书写者标识时先按来源分区，再裁剪增强；否则相似变体可能泄漏到测试中。",
  );
  console.log(
    "所有可手算实验断言通过。通过本章验证的是评分规则与流程，并非承诺现场准确率。",
  );
}
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
module.exports = { main };
