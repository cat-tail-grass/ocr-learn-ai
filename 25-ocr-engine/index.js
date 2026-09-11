/**
 * 第 25 章：照片数字串 OCR 的 Node.js 教学实验。
 * 运行：node 25-ocr-engine/index.js
 * 使用第 17 章已经训练并保存的模型，不会重新训练或下载成品模型。
 * 实验一至四观察处理步骤，实验五至七执行真正的模型推理和边界检查。
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const sharp = require("sharp");
const tf = require("@tensorflow/tfjs");
const { createImageData, setPixel } = require("../shared/core");
const { binarizeAdaptive } = require("../shared/04-binarization");
const { prepareDigit, PREPROCESSING } = require("../shared/17-cnn-classifier");
const {
  flattenImage,
  adaptiveMeanFast,
  segmentDigits,
  foregroundBounds,
  cropImage,
  recognizePhoto,
} = require("../shared/25-ocr-engine");
const { loadModel } = require("../17-cnn-classifier/model-io");

function heading(number, title) {
  console.log(
    `\n${"=".repeat(58)}\n实验 ${number}：${title}\n${"=".repeat(58)}`,
  );
}
function printImage(image, title) {
  console.log(title);
  for (let y = 0; y < image.height; y++) {
    let line = "";
    for (let x = 0; x < image.width; x++)
      line += image.data[(y * image.width + x) * 4] < 128 ? "██" : "  ";
    console.log(line);
  }
}
function createBrokenStrokes() {
  const image = createImageData(52, 19);
  for (const left of [5, 20, 35]) {
    for (let y = 4; y < 15; y++)
      for (let x = left; x < left + 6; x++) setPixel(image, x, y, 0, 0, 0);
  }
  for (let x = 5; x < 11; x++) setPixel(image, x, 9, 255, 255, 255);
  setPixel(image, 1, 1, 0, 0, 0);
  return image;
}

async function main() {
  console.log("第 25 章：从 RGBA 照片到完整数字串");
  console.log(
    "基础知识：03 灰度、04 阈值、07 校正、09 连通域、10 分割、17 数字模型。",
  );

  heading(1, "透明像素与纸张背景的约定");
  const transparent = createImageData(2, 1, 0, 0, 0, 0);
  setPixel(transparent, 1, 0, 0, 0, 0, 128);
  const flattened = flattenImage(transparent);
  console.log("输入：透明黑 (0,0,0,0)，半透明黑 (0,0,0,128)");
  console.log("白底合成公式：C = α × 原色 + (1−α) × 255");
  console.log("结果灰度：", flattened.data[0], flattened.data[4]);
  assert.equal(flattened.data[0], 255);
  console.log("透明背景不代表黑色笔画；相同 RGB 值不能忽略 alpha。");

  heading(2, "积分图怎样加速局部阈值");
  const gradient = createImageData(9, 7);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 9; x++) {
      const value = (x * 19 + y * 31) % 256;
      setPixel(gradient, x, y, value, value, value);
    }
  const fast = adaptiveMeanFast(gradient, 3, 8);
  const reference = binarizeAdaptive(gradient, 3, 8);
  assert.deepEqual(Array.from(fast.data), Array.from(reference.data));
  console.log("输入 9×7；窗口 3×3；偏移 C=8。");
  console.log("左上角窗口只有 [0, 19; 31, 50]，均值 25，阈值 17。");
  console.log("当前像素 0 < 17，因此输出黑色：", fast.data[0]);
  console.log("矩形和 = P(右下) − P(左下) − P(右上) + P(左上)。");
  console.log("完整图像与第 04 章朴素实现逐字节一致。");

  heading(3, "断笔与孤立噪点：一个连通域并不等于一个数字");
  const strokes = createBrokenStrokes();
  printImage(strokes, "受控形状，只用于分割测试，不冒充真实数字：");
  const segmented = segmentDigits(strokes);
  printImage(segmented.binary, "过滤孤立噪点后：");
  console.table(segmented.boxes);
  assert.equal(segmented.boxes.length, 3);
  console.log("第一个形状上下断开，但列投影重叠，仍形成一个字符框。");
  console.log(
    "如果两个数字横向粘连，列投影可能无法找到分界，这是此路线的限制。",
  );

  heading(4, "将不同大小的字符统一成模型输入");
  const cropped = cropImage(segmented.binary, segmented.boxes[0], 1);
  const normalized = prepareDigit(cropped);
  console.log("裁剪尺寸：", cropped.width, "×", cropped.height);
  console.log("模型约定：", PREPROCESSING);
  console.log("输入向量长度：", normalized.pixels.length);
  console.log("背景=0，笔画强度趋近1；保留比例缩放，按灰度质心居中。");
  printImage(normalized.imageData, "归一化的 28×28 展示图（仍以黑笔画显示）：");
  assert.equal(normalized.pixels.length, 784);
  assert.equal(prepareDigit(createImageData(20, 20)).blank, true);

  heading(5, "使用自己训练的 CNN 识别完整合成手写行");
  await tf.setBackend("cpu");
  await tf.ready();
  const { model, metadata } = await loadModel(
    tf,
    path.join(__dirname, "../17-cnn-classifier/model"),
  );
  try {
    console.log("模型标识：", metadata.modelId);
    const filename = path.join(
      __dirname,
      "../26-validation/fixtures/development-line.png",
    );
    const { data, info } = await sharp(filename)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const image = { width: info.width, height: info.height, data };
    const predict = (pixels) =>
      tf.tidy(() =>
        Array.from(
          model.predict(tf.tensor4d(pixels, [1, 28, 28, 1])).dataSync(),
        ),
      );
    const result = await recognizePhoto(image, {
      prepareDigit,
      predict,
      thresholdMethod: "otsu",
      autoDeskew: true,
    });
    console.log("图像来源：MNIST 验证分区字迹拼接，非手机实拍。");
    console.table(
      result.characters.map((item, index) => ({
        index: index + 1,
        x: item.box.x,
        width: item.box.width,
        prediction: item.label,
        modelScore: item.score.toFixed(4),
      })),
    );
    console.log("拼接结果（字符串）：", JSON.stringify(result.text));
    console.log(
      "模型得分不是准确率；实际答案由评估模块单独读取。耗时：",
      result.elapsedMs,
      "ms",
    );

    heading(6, "同一图片的 Otsu 与局部阈值对照");
    const adaptive = await recognizePhoto(image, {
      prepareDigit,
      predict,
      thresholdMethod: "adaptive",
      autoDeskew: true,
    });
    console.table([
      {
        method: "Otsu",
        boxes: result.boxes.length,
        prediction: result.text,
        milliseconds: result.elapsedMs,
      },
      {
        method: "局部均值",
        boxes: adaptive.boxes.length,
        prediction: adaptive.text,
        milliseconds: adaptive.elapsedMs,
      },
    ]);
    console.log(
      "适合单峰/双峰、光照条件与笔画宽度的策略不同；比较结果，不默认越多预处理越好。",
    );

    heading(7, "空白与非法输入的恢复边界");
    const blank = await recognizePhoto(createImageData(120, 60), {
      prepareDigit,
      predict,
    });
    assert.equal(blank.text, "");
    assert.equal(blank.status, "empty");
    console.log(
      "白纸结果：",
      blank.status,
      JSON.stringify(blank.text),
      "；没有强行分类为0。",
    );
    console.log("空白前景边界：", foregroundBounds(createImageData(3, 3)));
    try {
      adaptiveMeanFast(image, 4);
    } catch (error) {
      console.log("偶数窗口被明确拒绝：", error.message);
    }
    console.log(
      "下一章：用正确答案、编辑距离和独立样本评估，不把这些受控实验当成实拍成绩。",
    );
  } finally {
    model.dispose();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    console.error(
      "请先完成第 17 章模型准备，并运行 node 26-validation/prepare-fixtures.js。",
    );
    process.exitCode = 1;
  });
module.exports = { createBrokenStrokes };
