'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const {
  prepareDigit,
  mnistToImage,
  augmentDigit,
  randomGenerator,
  shuffledIndices
} = require('../shared/17-cnn-classifier');
const DATA_DIR = path.join(__dirname, 'data');
const SOURCES = [['train-images-idx3-ubyte.gz', 'f68b3c2dcbeaaa9fbdd348bbdeb94873'], ['train-labels-idx1-ubyte.gz', 'd53e105ee54ea40749a09fcbcd1e9432'], ['t10k-images-idx3-ubyte.gz', '9fb629c4189551a2d022fa330f9573f3'], ['t10k-labels-idx1-ubyte.gz', 'ec29112dd5afa0611ce80d1b7f02629c']].map(([file, md5]) => ({
  file,
  md5,
  url: `https://storage.googleapis.com/cvdf-datasets/mnist/${file}`
}));
function parseImages(buffer) {
  if (buffer.length < 16 || buffer.readUInt32BE(0) !== 2051) throw new Error('MNIST 图像 IDX 魔数错误');
  const count = buffer.readUInt32BE(4),
    rows = buffer.readUInt32BE(8),
    cols = buffer.readUInt32BE(12);
  if (rows !== 28 || cols !== 28 || count < 1 || buffer.length !== 16 + count * rows * cols) throw new Error('MNIST 图像 IDX 尺寸或长度错误');
  return {
    count,
    pixels: buffer.subarray(16)
  };
}
function parseLabels(buffer) {
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 2049) throw new Error('MNIST 标签 IDX 魔数错误');
  const count = buffer.readUInt32BE(4);
  if (count < 1 || buffer.length !== count + 8) throw new Error('MNIST 标签 IDX 长度错误');
  const labels = buffer.subarray(8);
  if (labels.some(n => n > 9)) throw new Error('MNIST 标签超出 0–9');
  return {
    count,
    labels
  };
}
async function downloadMNIST() {
  await fs.mkdir(DATA_DIR, {
    recursive: true
  });
  const manifest = [];
  for (const source of SOURCES) {
    const target = path.join(DATA_DIR, source.file);
    let bytes;
    try {
      bytes = await fs.readFile(target);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!bytes) {
      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(120000)
      });
      if (!response.ok) throw new Error(`下载 ${source.file}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    const md5 = crypto.createHash('md5').update(bytes).digest('hex');
    if (md5 !== source.md5) throw new Error(`${source.file} MD5 不匹配，请删除损坏缓存后重试`);
    await fs.writeFile(target, bytes);
    manifest.push({
      ...source,
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    });
  }
  await fs.writeFile(path.join(DATA_DIR, 'sources.json'), JSON.stringify({
    downloadedAt: new Date().toISOString(),
    original: 'http://yann.lecun.com/exdb/mnist/',
    mirror: 'https://github.com/cvdfoundation/mnist',
    files: manifest
  }, null, 2));
  return manifest;
}
async function loadMNIST(part) {
  if (!['train', 't10k'].includes(part)) throw new Error('part 必须为 train 或 t10k');
  const images = parseImages(zlib.gunzipSync(await fs.readFile(path.join(DATA_DIR, `${part}-images-idx3-ubyte.gz`))));
  const labels = parseLabels(zlib.gunzipSync(await fs.readFile(path.join(DATA_DIR, `${part}-labels-idx1-ubyte.gz`))));
  if (images.count !== labels.count) throw new Error('图像标签数量不一致');
  return {
    ...images,
    labels: labels.labels
  };
}
function makeSplit(count, {
  seed = 1701,
  validationSize = 5000,
  trainSize = 55000
} = {}) {
  if (![count, validationSize, trainSize].every(Number.isInteger) || validationSize < 1 || trainSize < 1 || validationSize + trainSize > count) throw new RangeError('划分尺寸无效');
  const ids = shuffledIndices(count, seed);
  return {
    seed,
    indexConvention: 'zero-based index in original train IDX',
    training: ids.slice(validationSize, validationSize + trainSize),
    validation: ids.slice(0, validationSize),
    unused: ids.slice(validationSize + trainSize)
  };
}
function prepareSamples(dataset, ids, {
  augment = false,
  seed = 1701
} = {}) {
  const random = randomGenerator(seed),
    pixels = new Float32Array(ids.length * 784),
    labels = new Float32Array(ids.length * 10);
  for (let j = 0; j < ids.length; j++) {
    const id = ids[j];
    if (!Number.isInteger(id) || id < 0 || id >= dataset.count) throw new RangeError('样本索引越界');
    let image = mnistToImage(dataset.pixels.subarray(id * 784, (id + 1) * 784));
    if (augment && random() < 0.5) image = augmentDigit(image, {
      angle: (random() * 2 - 1) * 8,
      stretchX: 0.9 + random() * 0.2
    });
    const prepared = prepareDigit(image);
    if (prepared.blank) {
      throw new Error(`样本 ${id} 预处理后为空白（${prepared.blankReason}），不能带数字标签参与训练或评估`);
    }
    pixels.set(prepared.pixels, j * 784);
    labels[j * 10 + dataset.labels[id]] = 1;
  }
  return {
    pixels,
    labels,
    count: ids.length
  };
}
module.exports = {
  DATA_DIR,
  SOURCES,
  downloadMNIST,
  loadMNIST,
  parseImages,
  parseLabels,
  makeSplit,
  prepareSamples
};
if (require.main === module) downloadMNIST().then(files => console.log(JSON.stringify(files, null, 2))).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
