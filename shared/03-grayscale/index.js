/**
 * 灰度化模块
 * 
 * 提供多种灰度化算法和直方图分析功能
 * 
 * 来源：03. 灰度化
 */

const { forEachPixel } = require('../core/pixelIterator');
const { rgbToGray } = require('../core/colorConversion');

/**
 * 加权平均法灰度化（推荐）
 * 
 * 原理说明：
 * - 使用 ITU-R BT.601 标准权重
 * - Gray = 0.299R + 0.587G + 0.114B
 * - 绿色权重最大，因为人眼对绿色最敏感
 * - 对编码 sRGB 直接加权是快速近似；保留 alpha，不做背景合成
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @returns {MockImageData} 灰度化后的图像数据
 */
function grayscaleWeighted(imageData) {
    return forEachPixel(imageData, (pixel) => {
        const gray = rgbToGray(pixel.r, pixel.g, pixel.b);
        return { r: gray, g: gray, b: gray };
    });
}

/**
 * 平均值法灰度化
 * 
 * 原理说明：
 * - Gray = (R + G + B) / 3
 * - 简单但不符合人眼感知
 * - 适合对精度要求不高的场景
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @returns {MockImageData} 灰度化后的图像数据
 */
function grayscaleAverage(imageData) {
    return forEachPixel(imageData, (pixel) => {
        const gray = Math.round((pixel.r + pixel.g + pixel.b) / 3);
        return { r: gray, g: gray, b: gray };
    });
}

/**
 * 最大值法灰度化
 * 
 * 原理说明：
 * - Gray = max(R, G, B)
 * - 结果偏亮
 * - 保留图像中最亮的通道信息
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @returns {MockImageData} 灰度化后的图像数据
 */
function grayscaleMax(imageData) {
    return forEachPixel(imageData, (pixel) => {
        const gray = Math.max(pixel.r, pixel.g, pixel.b);
        return { r: gray, g: gray, b: gray };
    });
}

/**
 * 最小值法灰度化
 * 
 * 原理说明：
 * - Gray = min(R, G, B)
 * - 结果偏暗
 * - 保留图像中最暗的通道信息
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @returns {MockImageData} 灰度化后的图像数据
 */
function grayscaleMin(imageData) {
    return forEachPixel(imageData, (pixel) => {
        const gray = Math.min(pixel.r, pixel.g, pixel.b);
        return { r: gray, g: gray, b: gray };
    });
}

/**
 * 单通道法灰度化
 * 
 * 原理说明：
 * - 只使用指定的单一通道作为灰度值
 * - 适合分析特定颜色通道
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @param {'r'|'g'|'b'} channel - 要使用的通道
 * @returns {MockImageData} 灰度化后的图像数据
 */
function grayscaleSingleChannel(imageData, channel) {
    if (!['r', 'g', 'b'].includes(channel)) throw new RangeError('channel 必须为 r、g 或 b');
    return forEachPixel(imageData, (pixel) => {
        const gray = pixel[channel];
        return { r: gray, g: gray, b: gray };
    });
}

/**
 * 计算灰度直方图
 * 
 * 原理说明：
 * - 统计每个灰度值（0-255）出现的次数
 * - 用于分析图像亮度分布
 * - 是 Otsu 二值化等算法的基础
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @returns {number[]} 长度为256的数组，索引为灰度值，值为出现次数
 */
function calculateHistogram(imageData) {
    const histogram = new Array(256).fill(0);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i]; // 假设是灰度图，R=G=B
        histogram[gray]++;
    }
    
    return histogram;
}

/**
 * 计算直方图统计信息
 * 
 * 原理说明：
 * - 从直方图提取统计特征
 * - 包括最小值、最大值、均值、中位数、众数、标准差
 * - 用于图像质量分析和自动参数选择
 * 
 * @param {number[]} histogram - 直方图数据
 * @param {number} totalPixels - 总像素数
 * @returns {object} 统计信息 { min, max, mean, median, mode, std }
 */
function calculateHistogramStats(histogram, totalPixels = histogram.reduce((a, b) => a + b, 0)) {
    if (histogram.length !== 256 || Array.from(histogram).some(v => !Number.isSafeInteger(v) || v < 0) ||
        totalPixels !== histogram.reduce((a, b) => a + b, 0) || totalPixels <= 0) {
        throw new RangeError('统计需要非空的 256 桶计数直方图，totalPixels 必须等于计数总和');
    }
    // 计算最小值（第一个非零位置）
    let min = 0, max = 255;
    for (let i = 0; i < 256; i++) {
        if (histogram[i] > 0) { min = i; break; }
    }
    // 计算最大值（最后一个非零位置）
    for (let i = 255; i >= 0; i--) {
        if (histogram[i] > 0) { max = i; break; }
    }
    
    // 计算均值
    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }
    const mean = sum / totalPixels;
    
    // 排序后以 0 为起点的两个中间序号：奇数时二者相同，偶数时取均值。
    const lowerRank = Math.floor((totalPixels - 1) / 2);
    const upperRank = Math.floor(totalPixels / 2);
    let cumulative = 0;
    let lower = null;
    let upper = null;
    for (let i = 0; i < 256; i++) {
        cumulative += histogram[i];
        if (lower === null && cumulative > lowerRank) lower = i;
        if (cumulative > upperRank) { upper = i; break; }
    }
    const median = (lower + upper) / 2;

    // 计算众数（出现次数最多的值）
    let mode = 0;
    let maxCount = 0;
    for (let i = 0; i < 256; i++) {
        if (histogram[i] > maxCount) {
            maxCount = histogram[i];
            mode = i;
        }
    }
    
    // 计算标准差
    let variance = 0;
    for (let i = 0; i < 256; i++) {
        variance += histogram[i] * Math.pow(i - mean, 2);
    }
    const std = Math.sqrt(variance / totalPixels);
    
    return { min, max, mean, median, mode, std };
}

/** 兼容旧名称：直接用 BT.709 系数加权编码值，并非线性光亮度。 */
function grayscaleLuminosity(imageData) {
    return forEachPixel(imageData, pixel => {
        const value = Math.round(0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b);
        return { r: value, g: value, b: value };
    });
}

/** sRGB 解码 → 相对亮度 Y → sRGB 编码的中性灰，alpha 保持不变。 */
function grayscaleLinearSrgb(imageData) {
    const decode = value => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const encode = value => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
    return forEachPixel(imageData, pixel => {
        const y = 0.2126 * decode(pixel.r) + 0.7152 * decode(pixel.g) + 0.0722 * decode(pixel.b);
        const value = Math.round(255 * encode(y));
        return { r: value, g: value, b: value };
    });
}

module.exports = {
    grayscaleWeighted,
    grayscaleLuminosity,
    grayscaleLinearSrgb,
    grayscaleAverage,
    grayscaleMax,
    grayscaleMin,
    grayscaleSingleChannel,
    calculateHistogram,
    calculateHistogramStats
};
