/**
 * 共享图像处理工具模块
 * 
 * 本模块提供图像处理的基础工具函数，供所有章节复用。
 * 这些函数最终将整合到 25-ocr-engine 中。
 * 
 * 使用方式：
 * const { getPixel, setPixel, ... } = require('../shared/imageUtils');
 */

// ==================== 模拟 ImageData 类 ====================

/**
 * 模拟浏览器的 ImageData 类
 * 
 * 原理说明：
 * - 真正的 ImageData 是浏览器 API
 * - 这里模拟其结构以便在 Node.js 环境中使用
 * - 包含 width, height, data 三个属性
 * 
 * 来源：02. JavaScript 图像处理基础
 * 
 * @class
 */
class MockImageData {
    /**
     * 创建 ImageData 对象
     * @param {number|Uint8ClampedArray} widthOrData - 宽度或数据数组
     * @param {number} height - 高度（或当第一个参数是数据时为宽度）
     * @param {number} [width] - 当第一个参数是数据时，需要提供高度
     */
    constructor(widthOrData, height, width) {
        if (widthOrData instanceof Uint8ClampedArray) {
            // 从现有数据创建
            this.data = widthOrData;
            this.width = height;
            this.height = width;
        } else {
            // 创建空白图像
            this.width = widthOrData;
            this.height = height;
            this.data = new Uint8ClampedArray(widthOrData * height * 4);
            
            // 默认填充白色不透明
            for (let i = 0; i < this.data.length; i += 4) {
                this.data[i] = 255;     // R
                this.data[i + 1] = 255; // G
                this.data[i + 2] = 255; // B
                this.data[i + 3] = 255; // A
            }
        }
    }
}

// ==================== 像素访问函数 ====================

/**
 * 获取指定位置的像素值
 * 
 * 原理说明：
 * - 使用公式 index = (y * width + x) * 4 计算一维数组索引
 * - 返回 RGBA 对象
 * 
 * 来源：01. 数字图像基础（索引计算）
 *       02. JavaScript 图像处理基础（函数封装）
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @returns {{r: number, g: number, b: number, a: number}} RGBA 值
 */
function getPixel(imageData, x, y) {
    // 边界检查
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return { r: 0, g: 0, b: 0, a: 0 };
    }
    
    // 计算一维数组索引
    const index = (y * imageData.width + x) * 4;
    
    return {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2],
        a: imageData.data[index + 3]
    };
}

/**
 * 设置指定位置的像素值
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @param {number} [a=255] - 透明度 (0-255)
 */
function setPixel(imageData, x, y, r, g, b, a = 255) {
    // 边界检查
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return;
    }
    
    const index = (y * imageData.width + x) * 4;
    
    // Uint8ClampedArray 会自动将值限制在 0-255
    imageData.data[index] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = a;
}

/**
 * 获取指定位置的灰度值
 * 
 * 原理说明：
 * - 使用加权公式将 RGB 转换为灰度值
 * - Gray = 0.299R + 0.587G + 0.114B
 * - 权重基于人眼对不同颜色的敏感度
 * 
 * 来源：01. 数字图像基础
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @returns {number} 灰度值 (0-255)
 */
function getGray(imageData, x, y) {
    const pixel = getPixel(imageData, x, y);
    return Math.round(0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b);
}

// ==================== 图像数据操作 ====================

/**
 * 克隆 ImageData 对象
 * 
 * 原理说明：
 * - 创建数据的深拷贝
 * - 避免修改原始图像
 * 
 * @param {ImageData|MockImageData} imageData - 要克隆的图像数据
 * @returns {MockImageData} 克隆的副本
 */
function cloneImageData(imageData) {
    return new MockImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
    );
}

/**
 * 创建指定尺寸的空白图像数据
 * 
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number} [r=255] - 默认红色值
 * @param {number} [g=255] - 默认绿色值
 * @param {number} [b=255] - 默认蓝色值
 * @param {number} [a=255] - 默认透明度
 * @returns {MockImageData} 新的图像数据
 */
function createImageData(width, height, r = 255, g = 255, b = 255, a = 255) {
    const imageData = new MockImageData(width, height);
    
    // 填充指定颜色
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
        imageData.data[i + 3] = a;
    }
    
    return imageData;
}

// ==================== 像素遍历函数 ====================

/**
 * 遍历图像的所有像素（按索引方式）
 * 
 * 原理说明：
 * - 提供统一的像素遍历接口
 * - 回调函数接收像素信息和索引
 * - 返回新的像素值即可修改
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {Function} callback - 回调函数 (pixel, index) => newPixel
 * @returns {MockImageData} 处理后的图像数据
 */
function forEachPixel(imageData, callback) {
    const result = cloneImageData(imageData);
    const data = result.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const pixel = {
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
            a: data[i + 3]
        };
        
        const newPixel = callback(pixel, i);
        
        if (newPixel) {
            data[i] = newPixel.r !== undefined ? newPixel.r : pixel.r;
            data[i + 1] = newPixel.g !== undefined ? newPixel.g : pixel.g;
            data[i + 2] = newPixel.b !== undefined ? newPixel.b : pixel.b;
            data[i + 3] = newPixel.a !== undefined ? newPixel.a : pixel.a;
        }
    }
    
    return result;
}

/**
 * 遍历图像的所有像素（按坐标方式）
 * 
 * 原理说明：
 * - 使用双层循环遍历
 * - 回调函数接收像素信息、坐标和索引
 * - 适合需要坐标信息的操作
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {Function} callback - 回调函数 (pixel, x, y, index) => newPixel
 * @returns {MockImageData} 处理后的图像数据
 */
function forEachPixelXY(imageData, callback) {
    const result = cloneImageData(imageData);
    const { width, height, data } = result;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const pixel = {
                r: data[index],
                g: data[index + 1],
                b: data[index + 2],
                a: data[index + 3]
            };
            
            const newPixel = callback(pixel, x, y, index);
            
            if (newPixel) {
                data[index] = newPixel.r !== undefined ? newPixel.r : pixel.r;
                data[index + 1] = newPixel.g !== undefined ? newPixel.g : pixel.g;
                data[index + 2] = newPixel.b !== undefined ? newPixel.b : pixel.b;
                data[index + 3] = newPixel.a !== undefined ? newPixel.a : pixel.a;
            }
        }
    }
    
    return result;
}

// ==================== 颜色转换函数 ====================

/**
 * RGB 转十六进制颜色代码
 * 
 * 来源：01. 数字图像基础
 * 
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {string} 十六进制颜色代码，如 "#FF0000"
 */
function rgbToHex(r, g, b) {
    const toHex = (value) => {
        const hex = Math.max(0, Math.min(255, Math.round(value))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * 十六进制颜色代码转 RGB
 * 
 * @param {string} hex - 十六进制颜色代码，如 "#FF0000" 或 "FF0000"
 * @returns {{r: number, g: number, b: number}} RGB 值
 */
function hexToRgb(hex) {
    // 移除 # 前缀
    hex = hex.replace(/^#/, '');
    
    // 处理简写形式 (如 "F00" -> "FF0000")
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

/**
 * RGB 转灰度值
 * 
 * 原理说明：
 * - 使用标准加权公式（ITU-R BT.601）
 * - 权重基于人眼对不同颜色的敏感度
 * 
 * 来源：01. 数字图像基础
 * 
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {number} 灰度值 (0-255)
 */
function rgbToGray(r, g, b) {
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * RGB 转 HSV
 * 
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {{h: number, s: number, v: number}} HSV 值 (h: 0-360, s: 0-100, v: 0-100)
 */
function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;
    
    if (diff !== 0) {
        if (max === r) {
            h = 60 * (((g - b) / diff) % 6);
        } else if (max === g) {
            h = 60 * ((b - r) / diff + 2);
        } else {
            h = 60 * ((r - g) / diff + 4);
        }
    }
    
    if (h < 0) h += 360;
    
    return {
        h: Math.round(h),
        s: Math.round(s * 100),
        v: Math.round(v * 100)
    };
}

// ==================== 工具函数 ====================

/**
 * 限制值在指定范围内
 * 
 * @param {number} value - 要限制的值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 线性插值
 * 
 * @param {number} a - 起始值
 * @param {number} b - 结束值
 * @param {number} t - 插值比例 (0-1)
 * @returns {number} 插值结果
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ==================== 导出模块 ====================

module.exports = {
    // 类
    MockImageData,
    
    // 像素访问
    getPixel,
    setPixel,
    getGray,
    
    // 图像数据操作
    cloneImageData,
    createImageData,
    
    // 像素遍历
    forEachPixel,
    forEachPixelXY,
    
    // 颜色转换
    rgbToHex,
    hexToRgb,
    rgbToGray,
    rgbToHsv,
    
    // 工具函数
    clamp,
    lerp
};
