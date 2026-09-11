'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  captureModel
} = require('../shared/16-tensorflowjs-intro');
async function saveModel(tf, model, directory, metadata = {}) {
  const artifacts = await captureModel(tf, model);
  const weights = Buffer.from(artifacts.weightData);
  const sha256 = crypto.createHash('sha256').update(weights).digest('hex');
  const modelId = `ocr-mnist-cnn-v1-${sha256.slice(0, 12)}`;
  const json = {
    format: 'layers-model',
    generatedBy: `TensorFlow.js tfjs-layers v${tf.version.tfjs}`,
    convertedBy: null,
    modelTopology: artifacts.modelTopology,
    weightsManifest: [{
      paths: ['weights.bin'],
      weights: artifacts.weightSpecs
    }],
    userDefinedMetadata: {
      ...metadata,
      modelId,
      weightsSha256: sha256
    }
  };
  await fs.mkdir(directory, {
    recursive: true
  });
  await fs.writeFile(path.join(directory, 'weights.bin'), weights);
  await fs.writeFile(path.join(directory, 'model.json'), JSON.stringify(json, null, 2));
  return {
    modelId,
    weightsSha256: sha256,
    weightBytes: weights.length
  };
}
async function loadModel(tf, directory) {
  const json = JSON.parse(await fs.readFile(path.join(directory, 'model.json'), 'utf8'));
  const buffers = [];
  for (const group of json.weightsManifest) for (const file of group.paths) buffers.push(await fs.readFile(path.join(directory, file)));
  const weights = Buffer.concat(buffers);
  const actual = crypto.createHash('sha256').update(weights).digest('hex');
  if (json.userDefinedMetadata?.weightsSha256 && actual !== json.userDefinedMetadata.weightsSha256) throw new Error('模型权重 SHA256 不匹配');
  const model = await tf.loadLayersModel(tf.io.fromMemory({
    modelTopology: json.modelTopology,
    weightSpecs: json.weightsManifest.flatMap(group => group.weights),
    weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength)
  }));
  return {
    model,
    metadata: json.userDefinedMetadata
  };
}
module.exports = {
  saveModel,
  loadModel
};
