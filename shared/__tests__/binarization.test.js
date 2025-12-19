/**
 * 二值化模块单元测试
 * 
 * 测试内容：
 * - 固定阈值二值化
 * - Otsu 阈值计算和二值化
 * - 自适应阈值二值化
 */

const { MockImageData, setPixel, getPixel } = require('../core');
const {
    binarizeFixed,
    calculateOtsuThreshold,
    binarizeOtsu,
    binarizeAdaptive
} = require('../04-binarization');

// ==================== 辅助函数 ====================

/**
 * 创建灰度渐变测试图像
 */
function createGradientImage() {
    const img = new MockImageData(5, 1);
    setPixel(img, 0, 0, 0, 0, 0);       // 0
    setPixel(img, 1, 0, 64, 64, 64);    // 64
    setPixel(img, 2, 0, 128, 128, 128); // 128
    setPixel(img, 3, 0, 192, 192, 192); // 192
    setPixel(img, 4, 0, 255, 255, 255); // 255
    return img;
}

// ==================== 固定阈值二值化测试 ====================

describe('固定阈值二值化', () => {
    test('binarizeFixed 基本功能', () => {
        const img = createGradientImage();
        const result = binarizeFixed(img, 128);
        
        // 小于 128 的变黑
        expect(getPixel(result, 0, 0).r).toBe(0);   // 0 < 128
        expect(getPixel(result, 1, 0).r).toBe(0);   // 64 < 128
        
        // 大于等于 128 的变白
        expect(getPixel(result, 2, 0).r).toBe(255); // 128 >= 128
        expect(getPixel(result, 3, 0).r).toBe(255); // 192 >= 128
        expect(getPixel(result, 4, 0).r).toBe(255); // 255 >= 128
    });
    
    test('binarizeFixed 阈值为 0', () => {
        const img = createGradientImage();
        const result = binarizeFixed(img, 0);
        
        // 所有像素都应该变白（>= 0）
        for (let x = 0; x < 5; x++) {
            expect(getPixel(result, x, 0).r).toBe(255);
        }
    });
    
    test('binarizeFixed 阈值为 256', () => {
        const img = createGradientImage();
        const result = binarizeFixed(img, 256);
        
        // 所有像素都应该变黑（< 256）
        for (let x = 0; x < 5; x++) {
            expect(getPixel(result, x, 0).r).toBe(0);
        }
    });
});

// ==================== Otsu 二值化测试 ====================

describe('Otsu 二值化', () => {
    test('calculateOtsuThreshold 双峰分布', () => {
        // 创建双峰直方图（前景和背景明显分离）
        const histogram = new Array(256).fill(0);
        histogram[50] = 100;  // 背景峰
        histogram[200] = 100; // 前景峰
        
        const result = calculateOtsuThreshold(histogram);
        
        // 最佳阈值应该在两峰之间或等于某个峰
        // Otsu 算法在这种完美双峰情况下，阈值可以是 50 或之间的任意值
        expect(result.threshold).toBeGreaterThanOrEqual(50);
        expect(result.threshold).toBeLessThanOrEqual(200);
        expect(result.variance).toBeGreaterThan(0);
    });
    
    test('calculateOtsuThreshold 空直方图', () => {
        const histogram = new Array(256).fill(0);
        
        const result = calculateOtsuThreshold(histogram);
        
        expect(result.threshold).toBe(128); // 默认值
        expect(result.variance).toBe(0);
    });
    
    test('binarizeOtsu 完整流程', () => {
        // 创建明显的黑白图像（确保有足够的对比度）
        const img = new MockImageData(6, 1);
        setPixel(img, 0, 0, 10, 10, 10);    // 暗
        setPixel(img, 1, 0, 15, 15, 15);    // 暗
        setPixel(img, 2, 0, 20, 20, 20);    // 暗
        setPixel(img, 3, 0, 230, 230, 230); // 亮
        setPixel(img, 4, 0, 235, 235, 235); // 亮
        setPixel(img, 5, 0, 240, 240, 240); // 亮
        
        const result = binarizeOtsu(img);
        
        expect(result.imageData).toBeDefined();
        expect(result.threshold).toBeDefined();
        expect(result.variance).toBeDefined();
        
        // 阈值应该在暗区和亮区之间（包含边界）
        expect(result.threshold).toBeGreaterThanOrEqual(10);
        expect(result.threshold).toBeLessThanOrEqual(240);
        
        // 暗像素应该变黑（低于阈值）
        expect(getPixel(result.imageData, 0, 0).r).toBe(0);
        
        // 亮像素应该变白（高于阈值）
        expect(getPixel(result.imageData, 5, 0).r).toBe(255);
    });
});

// ==================== 自适应阈值二值化测试 ====================

describe('自适应阈值二值化', () => {
    test('binarizeAdaptive 基本功能', () => {
        // 创建有局部变化的图像
        const img = new MockImageData(5, 5);
        
        // 填充中间亮，周围暗的图案
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                const value = (x === 2 && y === 2) ? 200 : 100;
                setPixel(img, x, y, value, value, value);
            }
        }
        
        const result = binarizeAdaptive(img, 3, 0);
        
        // 中心应该比周围亮，所以应该变白
        expect(getPixel(result, 2, 2).r).toBe(255);
    });
    
    test('binarizeAdaptive 参数调整', () => {
        const img = new MockImageData(3, 3);
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                setPixel(img, x, y, 128, 128, 128);
            }
        }
        
        // C = 0 时，等于均值的像素应该变白（>= 阈值）
        const result1 = binarizeAdaptive(img, 3, 0);
        expect(getPixel(result1, 1, 1).r).toBe(255);
        
        // C = 10 时，阈值 = 128 - 10 = 118，128 >= 118，应该变白
        const result2 = binarizeAdaptive(img, 3, 10);
        expect(getPixel(result2, 1, 1).r).toBe(255);
    });
});

// ==================== 边界情况测试 ====================

describe('边界情况', () => {
    test('处理纯白图像', () => {
        const img = new MockImageData(3, 3);
        // 默认是白色
        
        const result = binarizeFixed(img, 128);
        
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                expect(getPixel(result, x, y).r).toBe(255);
            }
        }
    });
    
    test('处理纯黑图像', () => {
        const img = new MockImageData(3, 3);
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                setPixel(img, x, y, 0, 0, 0);
            }
        }
        
        const result = binarizeFixed(img, 128);
        
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                expect(getPixel(result, x, y).r).toBe(0);
            }
        }
    });
});
