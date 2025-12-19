/**
 * 核心模块单元测试
 * 
 * 测试内容：
 * - MockImageData 类
 * - 像素访问函数（getPixel, setPixel, getGray）
 * - 图像数据操作（cloneImageData, createImageData）
 * - 像素遍历（forEachPixel, forEachPixelXY）
 * - 颜色转换（rgbToHex, hexToRgb, rgbToGray, rgbToHsv）
 * - 工具函数（clamp, lerp）
 */

const {
    MockImageData,
    getPixel,
    setPixel,
    getGray,
    cloneImageData,
    createImageData,
    forEachPixel,
    forEachPixelXY,
    rgbToHex,
    hexToRgb,
    rgbToGray,
    rgbToHsv,
    clamp,
    lerp
} = require('../core');

// ==================== MockImageData 测试 ====================

describe('MockImageData', () => {
    test('创建空白图像数据', () => {
        const img = new MockImageData(10, 10);
        
        expect(img.width).toBe(10);
        expect(img.height).toBe(10);
        expect(img.data.length).toBe(400); // 10 * 10 * 4
        expect(img.data).toBeInstanceOf(Uint8ClampedArray);
    });
    
    test('默认填充白色', () => {
        const img = new MockImageData(2, 2);
        
        // 检查第一个像素是白色
        expect(img.data[0]).toBe(255); // R
        expect(img.data[1]).toBe(255); // G
        expect(img.data[2]).toBe(255); // B
        expect(img.data[3]).toBe(255); // A
    });
    
    test('从现有数据创建', () => {
        const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
        const img = new MockImageData(data, 2, 1);
        
        expect(img.width).toBe(2);
        expect(img.height).toBe(1);
        expect(img.data[0]).toBe(255); // 红色像素的 R
        expect(img.data[4]).toBe(0);   // 绿色像素的 R
    });
});

// ==================== 像素访问函数测试 ====================

describe('像素访问函数', () => {
    let testImage;
    
    beforeEach(() => {
        testImage = new MockImageData(5, 5);
    });
    
    test('getPixel 获取像素值', () => {
        const pixel = getPixel(testImage, 0, 0);
        
        expect(pixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    });
    
    test('getPixel 边界外返回黑色透明', () => {
        const pixel = getPixel(testImage, -1, 0);
        
        expect(pixel).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });
    
    test('setPixel 设置像素值', () => {
        setPixel(testImage, 2, 2, 100, 150, 200, 255);
        const pixel = getPixel(testImage, 2, 2);
        
        expect(pixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });
    });
    
    test('setPixel 边界外忽略', () => {
        // 不应抛出错误
        expect(() => {
            setPixel(testImage, -1, 0, 100, 100, 100);
        }).not.toThrow();
    });
    
    test('setPixel 默认 alpha 为 255', () => {
        setPixel(testImage, 0, 0, 100, 100, 100);
        const pixel = getPixel(testImage, 0, 0);
        
        expect(pixel.a).toBe(255);
    });
    
    test('getGray 计算灰度值', () => {
        setPixel(testImage, 0, 0, 100, 150, 200);
        const gray = getGray(testImage, 0, 0);
        
        // 0.299 * 100 + 0.587 * 150 + 0.114 * 200 = 140.75 ≈ 141
        expect(gray).toBe(141);
    });
});

// ==================== 图像数据操作测试 ====================

describe('图像数据操作', () => {
    test('cloneImageData 深拷贝', () => {
        const original = new MockImageData(3, 3);
        setPixel(original, 1, 1, 100, 100, 100);
        
        const cloned = cloneImageData(original);
        
        // 验证是独立的副本
        expect(cloned.width).toBe(original.width);
        expect(cloned.height).toBe(original.height);
        expect(getPixel(cloned, 1, 1).r).toBe(100);
        
        // 修改原始图像不影响克隆
        setPixel(original, 1, 1, 200, 200, 200);
        expect(getPixel(cloned, 1, 1).r).toBe(100);
    });
    
    test('createImageData 指定颜色', () => {
        const img = createImageData(2, 2, 100, 150, 200, 128);
        
        const pixel = getPixel(img, 0, 0);
        expect(pixel).toEqual({ r: 100, g: 150, b: 200, a: 128 });
    });
    
    test('createImageData 默认白色', () => {
        const img = createImageData(2, 2);
        
        const pixel = getPixel(img, 0, 0);
        expect(pixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    });
});

// ==================== 像素遍历函数测试 ====================

describe('像素遍历函数', () => {
    test('forEachPixel 遍历所有像素', () => {
        const img = createImageData(3, 3, 100, 100, 100);
        
        // 将所有像素设为黑色
        const result = forEachPixel(img, (pixel) => {
            return { r: 0, g: 0, b: 0 };
        });
        
        // 验证所有像素都变黑
        const pixel = getPixel(result, 1, 1);
        expect(pixel.r).toBe(0);
        expect(pixel.g).toBe(0);
        expect(pixel.b).toBe(0);
    });
    
    test('forEachPixel 不返回值时保持原像素', () => {
        const img = createImageData(2, 2, 100, 100, 100);
        
        const result = forEachPixel(img, (pixel) => {
            // 不返回任何值
        });
        
        const pixel = getPixel(result, 0, 0);
        expect(pixel.r).toBe(100);
    });
    
    test('forEachPixelXY 提供坐标信息', () => {
        const img = createImageData(3, 3, 0, 0, 0);
        const coordinates = [];
        
        forEachPixelXY(img, (pixel, x, y) => {
            coordinates.push({ x, y });
            return pixel;
        });
        
        expect(coordinates.length).toBe(9);
        expect(coordinates[0]).toEqual({ x: 0, y: 0 });
        expect(coordinates[4]).toEqual({ x: 1, y: 1 });
        expect(coordinates[8]).toEqual({ x: 2, y: 2 });
    });
});

// ==================== 颜色转换函数测试 ====================

describe('颜色转换函数', () => {
    test('rgbToHex 转换正确', () => {
        expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
        expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
        expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
        expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
        expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });
    
    test('rgbToHex 处理边界值', () => {
        expect(rgbToHex(256, 0, 0)).toBe('#ff0000'); // 超出范围被 clamp
        expect(rgbToHex(-1, 0, 0)).toBe('#000000');
    });
    
    test('hexToRgb 转换正确', () => {
        expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
        expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
        expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });
    
    test('hexToRgb 处理简写格式', () => {
        expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
        expect(hexToRgb('0f0')).toEqual({ r: 0, g: 255, b: 0 });
    });
    
    test('rgbToGray 加权计算', () => {
        // 纯红：0.299 * 255 = 76.245 ≈ 76
        expect(rgbToGray(255, 0, 0)).toBe(76);
        // 纯绿：0.587 * 255 = 149.685 ≈ 150
        expect(rgbToGray(0, 255, 0)).toBe(150);
        // 纯蓝：0.114 * 255 = 29.07 ≈ 29
        expect(rgbToGray(0, 0, 255)).toBe(29);
        // 白色：255
        expect(rgbToGray(255, 255, 255)).toBe(255);
    });
    
    test('rgbToHsv 转换正确', () => {
        // 纯红
        expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 100, v: 100 });
        // 纯绿
        expect(rgbToHsv(0, 255, 0)).toEqual({ h: 120, s: 100, v: 100 });
        // 纯蓝
        expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 100, v: 100 });
        // 白色
        expect(rgbToHsv(255, 255, 255)).toEqual({ h: 0, s: 0, v: 100 });
        // 黑色
        expect(rgbToHsv(0, 0, 0)).toEqual({ h: 0, s: 0, v: 0 });
    });
});

// ==================== 工具函数测试 ====================

describe('工具函数', () => {
    test('clamp 限制值范围', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(15, 0, 10)).toBe(10);
        expect(clamp(0, 0, 10)).toBe(0);
        expect(clamp(10, 0, 10)).toBe(10);
    });
    
    test('lerp 线性插值', () => {
        expect(lerp(0, 10, 0)).toBe(0);
        expect(lerp(0, 10, 1)).toBe(10);
        expect(lerp(0, 10, 0.5)).toBe(5);
        expect(lerp(10, 20, 0.25)).toBe(12.5);
    });
});

// ==================== 向后兼容性测试 ====================

describe('向后兼容性', () => {
    test('通过 imageUtils.js 导入', () => {
        const imageUtils = require('../imageUtils');
        
        expect(imageUtils.MockImageData).toBeDefined();
        expect(imageUtils.getPixel).toBeDefined();
        expect(imageUtils.grayscaleWeighted).toBeDefined();
        expect(imageUtils.cannyEdgeDetection).toBeDefined();
    });
    
    test('通过 index.js 导入', () => {
        const shared = require('../index');
        
        expect(shared.MockImageData).toBeDefined();
        expect(shared.getPixel).toBeDefined();
        expect(shared.grayscaleWeighted).toBeDefined();
        expect(shared.cannyEdgeDetection).toBeDefined();
    });
});
