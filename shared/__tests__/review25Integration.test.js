const { createImageData, setPixel } = require('../core');
const { rotateImage } = require('../07-deskewing');
const { prepareDigit } = require('../17-cnn-classifier');
const { preprocessPhoto, recognizePhoto } = require('../25-ocr-engine');

describe('第25章跨模块修复后的识别契约', () => {
  test('两个方向的已知倾斜都施加相反校正，保留原字符框', () => {
    const line = createImageData(150, 55);
    const positions = [10, 36, 62, 88, 114];
    for (const left of positions) for (let y = 12; y < 40; y++)
      for (let x = left; x < left + 12; x++) setPixel(line, x, y, 0, 0, 0);
    for (const angle of [-6, 6]) {
      const result = preprocessPhoto(rotateImage(line, angle), { autoDeskew: true });
      expect(result.correctionAngle).toBe(-angle);
      expect(result.boxes).toEqual(positions.map(x => ({ x, y: 12, width: 12, height: 28 })));
    }
  });
  test('大裁剪中的细小前景经缩放消失时拒绝推理，不输出伪数字', async () => {
    const input = createImageData(128, 128);
    setPixel(input, 10, 10, 0, 0, 0);
    setPixel(input, 117, 117, 0, 0, 0);
    const predict = jest.fn(() => Array(10).fill(0.1));
    await expect(recognizePhoto(input, { prepareDigit, predict, minArea: 1, mergeGap: 120 }))
      .rejects.toThrow(/归一化后为空/);
    expect(predict).not.toHaveBeenCalled();
  });
});
