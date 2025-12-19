/**
 * 倾斜校正模块单元测试
 * 
 * 测试内容：
 * - 投影直方图计算
 * - 方差计算
 * - 双线性插值
 * - 图像旋转
 * - 倾斜检测和校正
 */

const { MockImageData, setPixel, getPixel, createImageData } = require('../core');
const {
    calculateHorizontalProjection,
    calculateVerticalProjection,
    calculateProjectionVariance,
    bilinearInterpolate,
    rotateImage,
    detectSkewAngle,
    deskew
} = require('../07-deskewing');

// ==================== 辅助函数 ====================

/**
 * 创建有水平文本行的测试图像
 */
function createTextLinesImage() {
    const img = createImageData(20, 20, 255, 255, 255); // 白色背景
    
    // 添加三条水平黑色线（模拟文本行）
    for (let x = 2; x < 18; x++) {
        setPixel(img, x, 4, 0, 0, 0);   // 第1行
        setPixel(img, x, 10, 0, 0, 0);  // 第2行
        setPixel(img, x, 16, 0, 0, 0);  // 第3行
    }
    
    return img;
}

// ==================== 投影直方图测试 ====================

describe('投影直方图计算', () => {
    test('calculateHorizontalProjection 基本功能', () => {
        const img = createImageData(5, 5, 255, 255, 255);
        // 在第2行添加3个黑色像素
        setPixel(img, 1, 2, 0, 0, 0);
        setPixel(img, 2, 2, 0, 0, 0);
        setPixel(img, 3, 2, 0, 0, 0);
        
        const projection = calculateHorizontalProjection(img);
        
        expect(projection.length).toBe(5);
        expect(projection[0]).toBe(0); // 第0行没有黑色像素
        expect(projection[2]).toBe(3); // 第2行有3个黑色像素
    });
    
    test('calculateVerticalProjection 基本功能', () => {
        const img = createImageData(5, 5, 255, 255, 255);
        // 在第2列添加3个黑色像素
        setPixel(img, 2, 1, 0, 0, 0);
        setPixel(img, 2, 2, 0, 0, 0);
        setPixel(img, 2, 3, 0, 0, 0);
        
        const projection = calculateVerticalProjection(img);
        
        expect(projection.length).toBe(5);
        expect(projection[0]).toBe(0); // 第0列没有黑色像素
        expect(projection[2]).toBe(3); // 第2列有3个黑色像素
    });
    
    test('calculateHorizontalProjection 文本行图像', () => {
        const img = createTextLinesImage();
        
        const projection = calculateHorizontalProjection(img);
        
        // 文本行位置应该有较高的投影值
        expect(projection[4]).toBeGreaterThan(0);
        expect(projection[10]).toBeGreaterThan(0);
        expect(projection[16]).toBeGreaterThan(0);
        
        // 非文本行位置应该为0
        expect(projection[0]).toBe(0);
        expect(projection[7]).toBe(0);
    });
});

// ==================== 方差计算测试 ====================

describe('方差计算', () => {
    test('calculateProjectionVariance 均匀分布', () => {
        const projection = [10, 10, 10, 10, 10];
        
        const variance = calculateProjectionVariance(projection);
        
        // 均匀分布的方差应该是0
        expect(variance).toBe(0);
    });
    
    test('calculateProjectionVariance 有变化的分布', () => {
        const projection = [0, 20, 0, 20, 0];
        
        const variance = calculateProjectionVariance(projection);
        
        // 有变化的分布方差应该大于0
        expect(variance).toBeGreaterThan(0);
    });
    
    test('calculateProjectionVariance 空数组', () => {
        const variance = calculateProjectionVariance([]);
        
        expect(variance).toBe(0);
    });
    
    test('方差与峰谷分布的关系', () => {
        // 明显的峰谷
        const clearPeaks = [0, 0, 100, 0, 0, 100, 0, 0];
        // 模糊的峰谷
        const blurredPeaks = [20, 40, 60, 40, 20, 40, 60, 40];
        
        const clearVariance = calculateProjectionVariance(clearPeaks);
        const blurredVariance = calculateProjectionVariance(blurredPeaks);
        
        // 明显的峰谷应该有更大的方差
        expect(clearVariance).toBeGreaterThan(blurredVariance);
    });
});

// ==================== 双线性插值测试 ====================

describe('双线性插值', () => {
    test('bilinearInterpolate 整数坐标', () => {
        const img = createImageData(3, 3, 0, 0, 0);
        setPixel(img, 1, 1, 100, 100, 100);
        
        const value = bilinearInterpolate(img, 1, 1);
        
        expect(value).toBe(100);
    });
    
    test('bilinearInterpolate 小数坐标', () => {
        const img = createImageData(3, 3, 0, 0, 0);
        setPixel(img, 0, 0, 100, 100, 100);
        setPixel(img, 1, 0, 100, 100, 100);
        setPixel(img, 0, 1, 100, 100, 100);
        setPixel(img, 1, 1, 100, 100, 100);
        
        const value = bilinearInterpolate(img, 0.5, 0.5);
        
        // 四个角都是100，中心也应该是100
        expect(value).toBe(100);
    });
    
    test('bilinearInterpolate 边缘过渡', () => {
        const img = createImageData(2, 2, 0, 0, 0);
        setPixel(img, 0, 0, 0, 0, 0);
        setPixel(img, 1, 0, 100, 100, 100);
        setPixel(img, 0, 1, 0, 0, 0);
        setPixel(img, 1, 1, 100, 100, 100);
        
        const value = bilinearInterpolate(img, 0.5, 0);
        
        // 应该是 0 和 100 的中间值
        expect(value).toBe(50);
    });
});

// ==================== 图像旋转测试 ====================

describe('图像旋转', () => {
    test('rotateImage 0度', () => {
        const img = createImageData(5, 5, 255, 255, 255);
        setPixel(img, 2, 0, 0, 0, 0); // 顶部中心
        
        const result = rotateImage(img, 0);
        
        // 0度旋转应该保持不变
        expect(getPixel(result, 2, 0).r).toBeLessThan(128);
    });
    
    test('rotateImage 90度', () => {
        const img = createImageData(7, 7, 255, 255, 255);
        setPixel(img, 5, 3, 0, 0, 0); // 右侧中心位置
        
        const result = rotateImage(img, 90);
        
        // 90度逆时针旋转后，右侧应该变成顶部附近
        // 由于旋转和插值，检查结果图像中是否有暗像素
        let hasDarkPixel = false;
        for (let y = 0; y < 3; y++) {
            for (let x = 2; x < 5; x++) {
                if (getPixel(result, x, y).r < 200) {
                    hasDarkPixel = true;
                    break;
                }
            }
        }
        expect(hasDarkPixel).toBe(true);
    });
    
    test('rotateImage 使用不同插值方法', () => {
        const img = createImageData(5, 5, 128, 128, 128);
        
        const resultNearest = rotateImage(img, 15, 'nearest');
        const resultBilinear = rotateImage(img, 15, 'bilinear');
        
        // 两种方法都应该成功
        expect(resultNearest.width).toBe(5);
        expect(resultBilinear.width).toBe(5);
    });
    
    test('rotateImage 自定义背景色', () => {
        const img = createImageData(5, 5, 0, 0, 0);
        
        const result = rotateImage(img, 45, 'bilinear', 128);
        
        // 旋转后角落应该被填充背景色
        expect(getPixel(result, 0, 0).r).toBeGreaterThan(0);
    });
});

// ==================== 倾斜检测测试 ====================

describe('倾斜检测', () => {
    test('detectSkewAngle 水平文本', () => {
        const img = createTextLinesImage();
        
        const result = detectSkewAngle(img, {
            minAngle: -10,
            maxAngle: 10,
            step: 1,
            refine: false
        });
        
        // 水平文本的倾斜角度应该在较小范围内
        // 由于离散搜索和图像大小限制，允许一定误差
        expect(Math.abs(result.angle)).toBeLessThanOrEqual(5);
    });
    
    test('detectSkewAngle 返回方差', () => {
        const img = createTextLinesImage();
        
        const result = detectSkewAngle(img);
        
        expect(result.angle).toBeDefined();
        expect(result.variance).toBeDefined();
        expect(result.variance).toBeGreaterThan(0);
    });
    
    test('detectSkewAngle 细化搜索', () => {
        const img = createTextLinesImage();
        
        const resultNoRefine = detectSkewAngle(img, { refine: false, step: 2 });
        const resultWithRefine = detectSkewAngle(img, { refine: true, step: 2, refineStep: 0.1 });
        
        // 细化搜索应该给出更精确的结果
        // 方差应该相近或更高
        expect(resultWithRefine.variance).toBeGreaterThanOrEqual(resultNoRefine.variance * 0.9);
    });
});

// ==================== 完整校正测试 ====================

describe('完整倾斜校正', () => {
    test('deskew 基本功能', () => {
        const img = createTextLinesImage();
        
        const result = deskew(img);
        
        expect(result.imageData).toBeDefined();
        expect(result.angle).toBeDefined();
        expect(result.correctionAngle).toBeDefined();
        expect(result.variance).toBeDefined();
        
        // 校正角度应该与检测角度相反
        expect(result.correctionAngle).toBe(-result.angle);
    });
    
    test('deskew 返回正确尺寸', () => {
        const img = createTextLinesImage();
        
        const result = deskew(img);
        
        expect(result.imageData.width).toBe(img.width);
        expect(result.imageData.height).toBe(img.height);
    });
});

// ==================== 边界情况测试 ====================

describe('边界情况', () => {
    test('处理全黑图像', () => {
        const img = createImageData(10, 10, 0, 0, 0);
        
        expect(() => {
            detectSkewAngle(img);
        }).not.toThrow();
    });
    
    test('处理全白图像', () => {
        const img = createImageData(10, 10, 255, 255, 255);
        
        expect(() => {
            detectSkewAngle(img);
        }).not.toThrow();
    });
    
    test('处理小图像', () => {
        const img = createImageData(3, 3, 128, 128, 128);
        
        expect(() => {
            deskew(img);
        }).not.toThrow();
    });
});
