'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {
  loadMNIST
} = require('./data');
async function main() {
  const dataset = await loadMNIST('train');
  const split = JSON.parse(await fs.readFile(path.join(__dirname, 'model', 'split.json'), 'utf8'));
  const samples = [];
  for (let label = 0; label < 10; label++) {
    const originalIndex = split.validation.find(id => dataset.labels[id] === label);
    samples.push({
      originalIndex,
      label: String(label),
      pixels: Array.from(dataset.pixels.subarray(originalIndex * 784, (originalIndex + 1) * 784))
    });
  }
  await fs.writeFile(path.join(__dirname, 'validation-samples.json'), JSON.stringify({
    source: 'MNIST train IDX / fixed validation split; these are not photos',
    seed: split.seed,
    samples
  }));
  console.log('已导出 10 个验证样本，原始索引', samples.map(s => s.originalIndex));
}
if (require.main === module) main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
