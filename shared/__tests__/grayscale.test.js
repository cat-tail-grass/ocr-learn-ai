/**
 * 灰度化模块单元测试
 * 
 * 测试内容：
 * - 各种灰度化算法（加权、平均、最大、最小、单通道）
 * - 直方图计算和统计
 */

const { MockImageData, setPixel, getPixel } = require('../core');
const {
    grayscaleWeighted,
    grayscaleAverage,
    grayscaleMax,
    grayscaleMin,
    grayscaleSingleChannel,
    calculateHistogram,
    calculateHistogramStats
} = require('../03-grayscale');

// ==================== 辅助函数 ====================

/**
 * 创建测试用的彩色图像
 */
function createColorImage() {
    const img = new MockImageData(3, 3);
    // 红色像素
    setPixel(img, 0, 0, 255, 0, 0);
    // 绿色像素
    setPixel(img, 1, 0, 0, 255, 0);
    // 蓝色像素
    setPixel(img, 2, 0, 0, 0, 255);
    // 白色像素
    setPixel(img, 0, 1, 255, 255, 255);
    // 黑色像素
    setPixel(img, 1, 1, 0, 0, 0);
    // 灰色像素
    setPixel(img, 2, 1, 128, 128, 128);
    return img;
}

// ==================== 灰度化算法测试 ====================

describe('灰度化算法', () => {
    let colorImage;
    
    beforeEach(() => {
        colorImage = createColorImage();
    });
    
    test('grayscaleWeighted 加权灰度化', () => {
        const result = grayscaleWeighted(colorImage);
        
        // 红色：0.299 * 255 ≈ 76
        const redPixel = getPixel(result, 0, 0);
        expect(redPixel.r).toBe(76);
        expect(redPixel.g).toBe(76);
        expect(redPixel.b).toBe(76);
        
        // 绿色：0.587 * 255 ≈ 150
        const greenPixel = getPixel(result, 1, 0);
        expect(greenPixel.r).toBe(150);
        
        // 蓝色：0.114 * 255 ≈ 29
        const bluePixel = getPixel(result, 2, 0);
        expect(bluePixel.r).toBe(29);
        
        // 白色应该还是 255
        const whitePixel = getPixel(result, 0, 1);
        expect(whitePixel.r).toBe(255);
        
        // 黑色应该还是 0
        const blackPixel = getPixel(result, 1, 1);
        expect(blackPixel.r).toBe(0);
    });
    
    test('grayscaleAverage 平均值灰度化', () => {
        const result = grayscaleAverage(colorImage);
        
        // 红色：(255 + 0 + 0) / 3 = 85
        const redPixel = getPixel(result, 0, 0);
        expect(redPixel.r).toBe(85);
        
        // 绿色：(0 + 255 + 0) / 3 = 85
        const greenPixel = getPixel(result, 1, 0);
        expect(greenPixel.r).toBe(85);
        
        // 白色：(255 + 255 + 255) / 3 = 255
        const whitePixel = getPixel(result, 0, 1);
        expect(whitePixel.r).toBe(255);
    });
    
    test('grayscaleMax 最大值灰度化', () => {
        const result = grayscaleMax(colorImage);
        
        // 红色：max(255, 0, 0) = 255
        const redPixel = getPixel(result, 0, 0);
        expect(redPixel.r).toBe(255);
        
        // 黑色：max(0, 0, 0) = 0
        const blackPixel = getPixel(result, 1, 1);
        expect(blackPixel.r).toBe(0);
    });
    
    test('grayscaleMin 最小值灰度化', () => {
        const result = grayscaleMin(colorImage);
        
        // 红色：min(255, 0, 0) = 0
        const redPixel = getPixel(result, 0, 0);
        expect(redPixel.r).toBe(0);
        
        // 白色：min(255, 255, 255) = 255
        const whitePixel = getPixel(result, 0, 1);
        expect(whitePixel.r).toBe(255);
    });
    
    test('grayscaleSingleChannel 单通道灰度化', () => {
        // 使用红色通道
        const resultR = grayscaleSingleChannel(colorImage, 'r');
        const redPixel = getPixel(resultR, 0, 0);
        expect(redPixel.r).toBe(255);
        
        // 使用绿色通道
        const resultG = grayscaleSingleChannel(colorImage, 'g');
        const greenPixel = getPixel(resultG, 1, 0);
        expect(greenPixel.r).toBe(255);
        
        // 使用蓝色通道
        const resultB = grayscaleSingleChannel(colorImage, 'b');
        const bluePixel = getPixel(resultB, 2, 0);
        expect(bluePixel.r).toBe(255);
    });
});

// ==================== 直方图测试 ====================

describe('直方图计算', () => {
    test('calculateHistogram 统计正确', () => {
        // 创建简单的灰度图像
        const img = new MockImageData(3, 1);
        setPixel(img, 0, 0, 0, 0, 0);      // 黑色
        setPixel(img, 1, 0, 128, 128, 128); // 灰色
        setPixel(img, 2, 0, 255, 255, 255); // 白色
        
        const histogram = calculateHistogram(img);
        
        expect(histogram.length).toBe(256);
        expect(histogram[0]).toBe(1);   // 1个黑色像素
        expect(histogram[128]).toBe(1); // 1个灰色像素
        expect(histogram[255]).toBe(1); // 1个白色像素
    });
    
    test('calculateHistogramStats 统计信息正确', () => {
        // 创建测试直方图
        const histogram = new Array(256).fill(0);
        histogram[50] = 10;  // 10个像素值为50
        histogram[100] = 20; // 20个像素值为100
        histogram[150] = 10; // 10个像素值为150
        
        const totalPixels = 40;
        const stats = calculateHistogramStats(histogram, totalPixels);
        
        expect(stats.min).toBe(50);
        expect(stats.max).toBe(150);
        expect(stats.mode).toBe(100); // 众数是出现最多的值
        
        // 均值：(50*10 + 100*20 + 150*10) / 40 = 100
        expect(stats.mean).toBe(100);
    });
    
    test('calculateHistogramStats 中位数计算', () => {
        const histogram = new Array(256).fill(0);
        histogram[0] = 5;
        histogram[100] = 5;
        histogram[200] = 5;
        
        const totalPixels = 15;
        const stats = calculateHistogramStats(histogram, totalPixels);
        
        // 中位数应该是第 8 个像素的值，即 100
        expect(stats.median).toBe(100);
    });
});

// ==================== 边界情况测试 ====================

describe('边界情况', () => {
    test('处理 1x1 图像', () => {
        const img = new MockImageData(1, 1);
        setPixel(img, 0, 0, 100, 150, 200);
        
        const result = grayscaleWeighted(img);
        const pixel = getPixel(result, 0, 0);
        
        // 0.299 * 100 + 0.587 * 150 + 0.114 * 200 = 141
        expect(pixel.r).toBe(141);
    });
    
    test('处理全黑图像', () => {
        const img = new MockImageData(3, 3);
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                setPixel(img, x, y, 0, 0, 0);
            }
        }
        
        const result = grayscaleWeighted(img);
        
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                expect(getPixel(result, x, y).r).toBe(0);
            }
        }
    });
});
