/**
 * 准备可复现的数字行流程夹具。
 * 图像来自真实 MNIST 字迹，行排版、缩放、旋转和阴影由程序合成。
 * 这不是手机实拍数据；开发行只用第 17 章的验证分区，测试行只用 t10k。
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const sharp = require("sharp");
const DATA = path.resolve(__dirname, "../17-cnn-classifier/data");

async function readData(part) {
  const images = zlib.gunzipSync(
    await fs.readFile(path.join(DATA, `${part}-images-idx3-ubyte.gz`)),
  );
  const labels = zlib.gunzipSync(
    await fs.readFile(path.join(DATA, `${part}-labels-idx1-ubyte.gz`)),
  );
  if (images.readUInt32BE(0) !== 2051 || labels.readUInt32BE(0) !== 2049)
    throw new Error("MNIST 文件格式错误");
  return { pixels: images.subarray(16), labels: labels.subarray(8) };
}
async function createLine(dataset, ids, { angle = 0, shadow = 0 } = {}) {
  const width = ids.length * 88 + 64,
    height = 152;
  const layers = [];
  for (let i = 0; i < ids.length; i++) {
    const gray = Buffer.from(
      dataset.pixels.subarray(ids[i] * 784, (ids[i] + 1) * 784),
    );
    // 原始 MNIST 是黑底亮笔画，照片流程约定白纸深色笔，因此反色。
    for (let p = 0; p < gray.length; p++)
      gray[p] = 255 - dataset.pixels[ids[i] * 784 + p];
    const digit = await sharp(gray, {
      raw: { width: 28, height: 28, channels: 1 },
    })
      .resize(80, 80, { kernel: "cubic" })
      .png()
      .toBuffer();
    layers.push({
      input: digit,
      left: 32 + i * 88,
      top: 32 + ((i % 3) - 1) * 3,
    });
  }
  let buffer = await sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite(layers)
    .png()
    .toBuffer();
  if (angle)
    buffer = await sharp(buffer)
      .rotate(angle, { background: "#ffffff" })
      .png()
      .toBuffer();
  if (shadow) {
    const { data, info } = await sharp(buffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const factor = 1 - (shadow * x) / Math.max(1, info.width - 1);
        for (let c = 0; c < info.channels; c++)
          data[(y * info.width + x) * info.channels + c] *= factor;
      }
    buffer = await sharp(data, { raw: info }).png().toBuffer();
  }
  return buffer;
}

async function main() {
  const mode = process.argv.includes("--test") ? "test" : "development";
  const part = mode === "test" ? "t10k" : "train";
  const dataset = await readData(part);
  const split = JSON.parse(
    await fs.readFile(
      path.resolve(__dirname, "../17-cnn-classifier/model/split.json"),
      "utf8",
    ),
  );
  const eligible =
    mode === "test"
      ? Array.from({ length: dataset.labels.length }, (_, i) => i)
      : split.validation;
  const pools = Array.from({ length: 10 }, () => []);
  for (const index of eligible) pools[dataset.labels[index]].push(index);
  const used = new Set();
  const strings = [
    "001208",
    "112233",
    "987654",
    "305",
    "00011",
    "70890",
    "24680",
    "13579",
    "90009",
    "101010",
    "827364",
    "556677",
  ];
  const output = path.join(__dirname, "fixtures");
  await fs.mkdir(output, { recursive: true });
  const rows = [];
  for (let i = 0; i < strings.length; i++) {
    const truth = strings[i];
    const sourceIndices = Array.from(truth, (digit) => {
      const id = pools[Number(digit)].find((index) => !used.has(index));
      if (id === undefined) throw new Error("指定分区中没有足够样本");
      used.add(id);
      return id;
    });
    const transform = {
      angle: i % 3 === 1 ? 3 : 0,
      shadow: i % 3 === 2 ? 0.2 : 0,
    };
    const buffer = await createLine(dataset, sourceIndices, transform);
    const filename =
      mode === "development" && i === 0
        ? "development-line.png"
        : `${mode}-${String(i + 1).padStart(2, "0")}.png`;
    await fs.writeFile(path.join(output, filename), buffer);
    rows.push({
      id: `${mode}-${i + 1}`,
      path: `fixtures/${filename}`,
      truth,
      sourcePart: part,
      sourceIndices,
      transform,
      imageId: crypto.createHash("sha256").update(buffer).digest("hex"),
      sampleKind: "synthetic-mnist",
    });
  }
  const manifest = {
    schemaVersion: 1,
    mode,
    description: "真实 MNIST 字迹的合成数字行；非手机实拍，不代表实拍照片成绩",
    source: "https://github.com/cvdfoundation/mnist",
    writerIsolation:
      "MNIST IDX 不含逐样本书写者标识；遵循官方分区，不能据此证明每行书写者隔离",
    rows,
  };
  await fs.writeFile(
    path.join(__dirname, `${mode}-manifest.json`),
    JSON.stringify(manifest, null, 2),
  );
  console.log(
    `已生成 ${rows.length} 张 ${mode} 合成流程夹具，使用 ${used.size} 个不重复的源数字。`,
  );
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { createLine, readData };
