/** 对清单中的图片执行真实模型推理，再读取对应真值评分。 */
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const tf = require("@tensorflow/tfjs");
const { loadModel } = require("../17-cnn-classifier/model-io");
const { prepareDigit, PREPROCESSING } = require("../shared/17-cnn-classifier");
const { recognizePhoto, PIPELINE_VERSION } = require("../shared/25-ocr-engine");
const { evaluatePredictions } = require("../shared/24-post-processing");
const { validateManifest } = require("./manifest");

async function main() {
  const manifestPath = path.resolve(
    process.argv[2] || path.join(__dirname, "development-manifest.json"),
  );
  const manifest = validateManifest(
    JSON.parse(await fs.readFile(manifestPath, "utf8")),
    path.dirname(manifestPath),
  );
  await tf.setBackend("cpu");
  await tf.ready();
  const { model, metadata } = await loadModel(
    tf,
    path.resolve(__dirname, "../17-cnn-classifier/model"),
  );
  const config = {
    pipelineVersion: PIPELINE_VERSION,
    thresholdMethod: "otsu",
    autoDeskew: true,
    correctionAngle: 0,
    denoise: false,
    preprocessingId: PREPROCESSING.id,
  };
  // 在读取测试图之前记录处理配置及代码指纹，方便复查本轮采用的版本。
  const pipelineSource = await fs.readFile(
    path.resolve(__dirname, "../shared/25-ocr-engine/index.js"),
  );
  const pipelineId = crypto
    .createHash("sha256")
    .update(pipelineSource)
    .update(JSON.stringify(config))
    .digest("hex");
  const experimentId = `${manifest.mode || "photo"}-frozen-v1`;
  const startedAt = new Date().toISOString();
  await fs.writeFile(
    path.join(__dirname, `${manifest.mode || "photo"}-freeze.json`),
    JSON.stringify(
      { startedAt, modelId: metadata.modelId, pipelineId, config },
      null,
      2,
    ),
  );
  const records = [];
  try {
    for (const row of manifest.rows) {
      let prediction = "",
        status = "ok",
        error = null,
        result = null;
      try {
        const file = path.resolve(path.dirname(manifestPath), row.path);
        const { data, info } = await sharp(file)
          .rotate()
          .flatten({ background: "white" })
          .resize({
            width: 1200,
            height: 1200,
            fit: "inside",
            withoutEnlargement: true,
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        result = await recognizePhoto(
          { width: info.width, height: info.height, data },
          {
            ...config,
            prepareDigit,
            predict: (pixels) =>
              tf.tidy(() =>
                Array.from(
                  model.predict(tf.tensor4d(pixels, [1, 28, 28, 1])).dataSync(),
                ),
              ),
          },
        );
        prediction = result.text;
        status = prediction ? "ok" : "failed";
      } catch (failure) {
        error = failure.message;
        status = "failed";
      }
      records.push({
        id: row.id,
        imageId: row.imageId,
        filename: row.path,
        truth: row.truth,
        prediction,
        status,
        error,
        sampleKind: row.sampleKind,
        sourcePart: row.sourcePart,
        sourceIndices: row.sourceIndices,
        modelId: metadata.modelId,
        pipelineId,
        experimentId,
        config,
        exclusionReason: row.exclusionReason || "",
        elapsedMs: result?.elapsedMs ?? null,
        boxes: result?.boxes ?? [],
        correctionAngle: result?.correctionAngle ?? null,
        warnings: result?.warnings ?? [],
      });
      console.log(
        `${row.id}: ${prediction || "（空）"} / 真值 ${row.truth} ${prediction === row.truth ? "✓" : "×"}`,
      );
    }
  } finally {
    model.dispose();
  }
  const report = {
    createdAt: new Date().toISOString(),
    modelId: metadata.modelId,
    mode: manifest.mode,
    description: manifest.description,
    startedAt,
    experimentId,
    pipelineId,
    config,
    summary: evaluatePredictions(records),
    realPhotoCount: records.filter((row) => row.sampleKind === "photo").length,
  };
  const output = path.join(
    __dirname,
    `${manifest.mode || "photo"}-report.json`,
  );
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  console.log(
    `CER ${report.summary.microCER}；整串完全正确率 ${report.summary.exactMatchAccuracy}；${records.length} 张图片。`,
  );
  console.log(`报告：${output}`);
  if (records.some((row) => row.error)) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
