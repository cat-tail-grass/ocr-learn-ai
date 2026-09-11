const { createImageData, setPixel } = require('../core');
const { binarizeAdaptive } = require('../04-binarization');
const { rotateImage } = require('../07-deskewing');
const { adaptiveMeanFast, preprocessPhoto, segmentDigits, recognizePhoto } = require('../25-ocr-engine');

function sampleLine() {
    const image = createImageData(150, 55);
    for (const x0 of [10, 36, 62, 88, 114]) {
        for (let y = 12; y < 40; y++) for (let x = x0; x < x0 + 12; x++) setPixel(image, x, y, 0, 0, 0);
    }
    return image;
}

describe('照片数字串 pipeline', () => {
    test('积分图均值阈值与第04章朴素算法在边缘及不同窗口一致', () => {
        const image = createImageData(17, 13);
        for (let y = 0; y < 13; y++) for (let x = 0; x < 17; x++) {
            const gray = (x * 37 + y * 53) % 256;
            setPixel(image, x, y, gray, gray, gray);
        }
        for (const size of [3, 7, 21]) {
            expect(Array.from(adaptiveMeanFast(image, size, 8).data)).toEqual(Array.from(binarizeAdaptive(image, size, 8).data));
        }
    });
    test('数字上下断笔仍按同一列投影区域分组，孤立噪点被去除', () => {
        const image = sampleLine();
        for (let x = 10; x < 22; x++) for (let y = 24; y < 27; y++) setPixel(image, x, y, 255, 255, 255);
        setPixel(image, 3, 3, 0, 0, 0);
        const { boxes } = segmentDigits(image);
        expect(boxes).toHaveLength(5);
        expect(boxes[0]).toEqual({ x: 10, y: 12, width: 12, height: 28 });
    });
    test('完整流程保留前导零和连续重复数字；预测器不接收答案', async () => {
        const text = '00110';
        const predict = jest.fn(async (_, index) => Array.from({ length: 10 }, (_v, digit) => digit === Number(text[index]) ? 1 : 0));
        const result = await recognizePhoto(sampleLine(), {
            prepareDigit: imageData => ({ pixels: new Float32Array(784), imageData, blank: false }), predict
        });
        expect(result.text).toBe(text);
        expect(result.characters).toHaveLength(5);
        expect(predict).toHaveBeenCalledTimes(5);
        expect(result.status).toBe('recognized');
    });
    test('白纸和透明底图不调用分类器', async () => {
        const predict = jest.fn();
        for (const image of [createImageData(90, 40), createImageData(90, 40, 0, 0, 0, 0)]) {
            const result = await recognizePhoto(image, { prepareDigit: () => {}, predict });
            expect(result.status).toBe('empty');
            expect(result.text).toBe('');
        }
        expect(predict).not.toHaveBeenCalled();
    });
    test('施加已知相反校正角后，倾斜行仍分成五个数字', () => {
        const tilted = rotateImage(sampleLine(), 6);
        const result = preprocessPhoto(tilted, { correctionAngle: -6 });
        expect(result.boxes).toHaveLength(5);
        expect(result.correctionAngle).toBe(-6);
        for (const box of result.boxes) expect(box.height).toBeGreaterThan(24);
    });
    test('校验图像、窗口和预测器结果，错误不伪造成数字', async () => {
        expect(() => preprocessPhoto({ width: -1, height: 2, data: [] })).toThrow(/RGBA/);
        expect(() => adaptiveMeanFast(sampleLine(), 4)).toThrow(/奇数/);
        await expect(recognizePhoto(sampleLine(), { prepareDigit: imageData => ({ imageData }), predict: () => [NaN] })).rejects.toThrow(/10 个/);
    });
});
