const { createImageData } = require('../core');
const { binarizeOtsu } = require('../04-binarization');

describe('照片预处理边界回归', () => {
    test('Otsu 保留精确黑白图的黑色笔画（阈值分组边界一致）', () => {
        const image = createImageData(4, 1);
        image.data.set([0, 0, 0, 255, 0, 0, 0, 255], 0);
        const result = binarizeOtsu(image);
        expect(Array.from(result.imageData.data)).toEqual(Array.from(image.data));
    });
    test('纯白输入仍为空白，纯黑输入仍为黑色', () => {
        for (const value of [0, 255]) {
            const image = createImageData(3, 2, value, value, value, 255);
            expect(Array.from(binarizeOtsu(image).imageData.data)).toEqual(Array.from(image.data));
        }
    });
});
