// 修复后流程的开发样本回归；保留原冻结报告，不用于重新选择参数或宣称独立测试成绩。
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const tf = require('@tensorflow/tfjs');
const { loadModel } = require('../../17-cnn-classifier/model-io');
const { prepareDigit, PREPROCESSING } = require('../../shared/17-cnn-classifier');
const { recognizePhoto, PIPELINE_VERSION } = require('../../shared/25-ocr-engine');
const { evaluatePredictions } = require('../../shared/24-post-processing');
const { validateManifest } = require('../../26-validation/manifest');
const root = path.resolve(__dirname, '../..');
async function main() {
  const directory = path.join(root, '26-validation');
  const manifest = validateManifest(JSON.parse(await fs.readFile(path.join(directory, 'development-manifest.json'), 'utf8')), directory);
  const historical = JSON.parse(await fs.readFile(path.join(directory, 'development-report.json'), 'utf8'));
  const config = { pipelineVersion: PIPELINE_VERSION, thresholdMethod: 'otsu', autoDeskew: true, correctionAngle: 0, denoise: false, preprocessingId: PREPROCESSING.id };
  await tf.setBackend('cpu');
  await tf.ready();
  const tensorsBefore = tf.memory().numTensors;
  const { model, metadata } = await loadModel(tf, path.join(root, '17-cnn-classifier/model'));
  const records = [];
  try {
    for (const row of manifest.rows) {
      const file = path.resolve(directory, row.path);
      const actualHash = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
      assert.equal(actualHash, row.imageId, `原图校验 ${row.id}`);
      const { data, info } = await sharp(file).rotate().flatten({ background: 'white' }).resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let result, error;
      try {
        result = await recognizePhoto({ width: info.width, height: info.height, data }, {
          ...config, prepareDigit,
          predict: pixels => tf.tidy(() => Array.from(model.predict(tf.tensor4d(pixels, [1, 28, 28, 1])).dataSync()))
        });
      } catch (failure) { error = failure.message; }
      records.push({ id: row.id, imageId: row.imageId, truth: row.truth, prediction: result?.text || '', status: result?.text ? 'ok' : 'failed', sampleKind: row.sampleKind, modelId: metadata.modelId, config, error: error || null, correctionAngle: result?.correctionAngle ?? null, boxes: result?.boxes || [], elapsedMs: result?.elapsedMs ?? null });
      console.log(`${row.id}: ${result?.text || '(空)'} / ${row.truth}`);
    }
  } finally { model.dispose(); }
  const report = { createdAt: new Date().toISOString(), purpose: '修复后开发集回归；非独立测试、非实拍，未训练或选参', config, modelId: metadata.modelId, weightsSha256: metadata.weightsSha256, historicalSummary: { microCER: historical.summary.microCER, exactMatchAccuracy: historical.summary.exactMatchAccuracy }, summary: evaluatePredictions(records), realPhotoCount: records.filter(row => row.sampleKind === 'photo').length, tensorsBefore, tensorsAfter: tf.memory().numTensors, records };
  await fs.writeFile(path.join(__dirname, 'development-regression.json'), JSON.stringify(report, null, 2));
  assert.equal(report.tensorsAfter, tensorsBefore);
  assert.equal(report.realPhotoCount, 0);
  assert.equal(records.length, 12);
  assert.equal(records.filter(row => row.error).length, 0);
  console.log(JSON.stringify({ microCER: report.summary.microCER, exactMatchAccuracy: report.summary.exactMatchAccuracy, tensorsBefore, tensorsAfter: report.tensorsAfter }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
