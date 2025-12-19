/**
 * 二值化模块
 * 
 * 提供多种二值化算法，将灰度图像转换为黑白图像
 * 
 * 来源：04. 二值化
 */

const { forEachPixel } = require('../core/pixelIterator');
const { cloneImageData } = require('../core/imageData');
const { getPixel, setPixel } = require('../core/pixelAccess');
const { calculateHistogram } = require('../03-grayscale');

/**
 * 固定阈值二值化
 * 
 * 原理说明：
 * - 使用固定阈值分割图像
 * - 大于等于阈值的像素变白（255），小于阈值的变黑（0）
 * - 最简单的二值化方法
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number} threshold - 阈值 (0-255)
 * @returns {MockImageData} 二值化后的图像数据
 */
function binarizeFixed(imageData, threshold) {
    return forEachPixel(imageData, (pixel) => {
        const gray = pixel.r; // 假设是灰度图
        const binary = gray >= threshold ? 255 : 0;
        return { r: binary, g: binary, b: binary };
    });
}

/**
 * 计算 Otsu 阈值
 * 
 * 原理说明：
 * - 基于类间方差最大化原理
 * - 遍历所有可能的阈值（0-255）
 * - 找到使前景和背景分离最好的阈值
 * - 类间方差 = w0 * w1 * (μ0 - μ1)²
 * 
 * 算法步骤：
 * 1. 计算灰度直方图
 * 2. 对每个可能的阈值 t，计算类间方差
 * 3. 选择使类间方差最大的 t 作为最佳阈值
 * 
 * @param {number[]} histogram - 灰度直方图（长度256）
 * @returns {{threshold: number, variance: number}} Otsu 结果
 */
function calculateOtsuThreshold(histogram) {
    const total = histogram.reduce((sum, count) => sum + count, 0);
    
    if (total === 0) {
        return { threshold: 128, variance: 0 };
    }
    
    // 计算所有像素的灰度值总和
    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }
    
    let sumB = 0;  // 背景像素灰度和
    let wB = 0;    // 背景像素数
    let maxVariance = 0;
    let bestThreshold = 0;
    
    // 遍历所有可能的阈值
    for (let t = 0; t < 256; t++) {
        wB += histogram[t];         // 背景像素数
        if (wB === 0) continue;
        
        const wF = total - wB;      // 前景像素数
        if (wF === 0) break;
        
        sumB += t * histogram[t];   // 背景灰度和
        const mB = sumB / wB;       // 背景平均灰度
        const mF = (sum - sumB) / wF; // 前景平均灰度
        
        // 类间方差
        const variance = wB * wF * (mB - mF) * (mB - mF);
        
        if (variance > maxVariance) {
            maxVariance = variance;
            bestThreshold = t;
        }
    }
    
    return { threshold: bestThreshold, variance: maxVariance };
}

/**
 * Otsu 二值化
 * 
 * 原理说明：
 * - 自动计算最佳阈值并进行二值化
 * - 结合了直方图计算和 Otsu 阈值计算
 * - 适合前景背景对比明显的图像
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @returns {{imageData: MockImageData, threshold: number, variance: number}} 结果
 */
function binarizeOtsu(imageData) {
    const histogram = calculateHistogram(imageData);
    const otsuResult = calculateOtsuThreshold(histogram);
    const binaryImage = binarizeFixed(imageData, otsuResult.threshold);
    
    return {
        imageData: binaryImage,
        threshold: otsuResult.threshold,
        variance: otsuResult.variance
    };
}

/**
 * 自适应阈值二值化
 * 
 * 原理说明：
 * - 每个像素的阈值根据其局部邻域动态计算
 * - 阈值 = 邻域均值 - C
 * - 适合处理光照不均匀的图像（如扫描文档）
 * 
 * 算法步骤：
 * 1. 对每个像素，计算其 blockSize × blockSize 邻域的平均灰度
 * 2. 阈值 = 邻域均值 - C
 * 3. 如果像素值 >= 阈值，设为白色，否则设为黑色
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number} blockSize - 邻域大小（奇数，默认15）
 * @param {number} C - 从均值减去的常数（默认5）
 * @returns {MockImageData} 二值化后的图像数据
 */
function binarizeAdaptive(imageData, blockSize = 15, C = 5) {
    const { width, height } = imageData;
    const result = cloneImageData(imageData);
    const halfBlock = Math.floor(blockSize / 2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0, count = 0;
            
            // 计算邻域均值
            for (let dy = -halfBlock; dy <= halfBlock; dy++) {
                for (let dx = -halfBlock; dx <= halfBlock; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const pixel = getPixel(imageData, nx, ny);
                        sum += pixel.r;
                        count++;
                    }
                }
            }
            
            const mean = sum / count;
            const threshold = mean - C;
            
            const currentPixel = getPixel(imageData, x, y);
            const binary = currentPixel.r >= threshold ? 255 : 0;
            
            setPixel(result, x, y, binary, binary, binary);
        }
    }
    
    return result;
}

module.exports = {
    binarizeFixed,
    calculateOtsuThreshold,
    binarizeOtsu,
    binarizeAdaptive
};
