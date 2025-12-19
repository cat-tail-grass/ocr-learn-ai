/**
 * 灰度化模块
 * 
 * 提供多种灰度化算法和直方图分析功能
 * 
 * 来源：03. 灰度化
 */

const { forEachPixel } = require('../core/pixelIterator');

/**
 * 加权平均法灰度化（推荐）
 * 
 * 原理说明：
 * - 使用 ITU-R BT.601 标准权重
 * - Gray = 0.299R + 0.587G + 0.114B
 * - 绿色权重最大，因为人眼对绿色最敏感
 * - 这是最符合人眼感知的灰度化方法
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @returns {MockImageData} 灰度化后的图像数据
 */
function grayscaleWeighted(imageData) {
    return forEachPixel(imageData, (pixel) => {
        const gray = Math.round(0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b);
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
function calculateHistogramStats(histogram, totalPixels) {
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
    
    // 计算中位数（累积分布的中点）
    let cumSum = 0;
    let median = 0;
    for (let i = 0; i < 256; i++) {
        cumSum += histogram[i];
        if (cumSum >= totalPixels / 2) {
            median = i;
            break;
        }
    }
    
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

module.exports = {
    grayscaleWeighted,
    grayscaleAverage,
    grayscaleMax,
    grayscaleMin,
    grayscaleSingleChannel,
    calculateHistogram,
    calculateHistogramStats
};
