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
 * @param {number} threshold - 白色下界 T (0-256，gray >= T 为白)
 * @returns {MockImageData} 二值化后的图像数据
 */
function binarizeFixed(imageData, threshold) {
    if (!Number.isFinite(threshold)) throw new RangeError('threshold 必须有限');
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
 * - 找到使灰度类间方差最大的阈值；不保证语义文字分割最优
 * - 类间方差 = w0 * w1 * (μ0 - μ1)²
 * 
 * 算法步骤：
 * 1. 计算灰度直方图
 * 2. 对每个可能的阈值 t，计算类间方差
 * 3. 选择使类间方差最大的 t 作为最佳阈值
 * 
 * @param {number[]} histogram - 灰度直方图（长度256）
 * @returns {{threshold:number, variance:number, w0:number, w1:number, count0:number, count1:number, total:number, validSplit:boolean}} t 为低灰度类上界，variance 单位为灰度²
 */
function calculateOtsuThreshold(histogram) {
    if (histogram.length !== 256 || Array.from(histogram).some(v => !Number.isFinite(v) || v < 0)) {
        throw new RangeError('Otsu 需要 256 桶非负、有限的直方图');
    }
    const total = histogram.reduce((sum, count) => sum + count, 0);
    if (total === 0) {
        return { threshold: 128, variance: 0, w0: 0, w1: 0, count0: 0, count1: 0, total, validSplit: false };
    }
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sum0 = 0;
    let count0 = 0;
    let maxVariance = 0;
    let threshold = 0;
    // 单一灰度没有有效二类分割，保留 t=0 的确定性回退并明确标记。
    let bestCount0 = histogram[0];
    let validSplit = false;
    for (let t = 0; t < 255; t++) {
        count0 += histogram[t];
        sum0 += t * histogram[t];
        const count1 = total - count0;
        if (count0 === 0) continue;
        if (count1 === 0) break;
        const mean0 = sum0 / count0;
        const mean1 = (sum - sum0) / count1;
        // C0=[0,t], C1=[t+1,255]；w0、w1 是比例而非像素数。
        const variance = (count0 / total) * (count1 / total) * (mean0 - mean1) ** 2;
        // 严格大于保证相同最大值取最小 t；不会强求直方图谷底。
        if (variance > maxVariance) {
            maxVariance = variance;
            threshold = t;
            bestCount0 = count0;
            validSplit = true;
        }
    }
    return {
        threshold, variance: maxVariance,
        w0: bestCount0 / total, w1: (total - bestCount0) / total,
        count0: bestCount0, count1: total - bestCount0, total, validSplit
    };
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
    // Otsu 的前景类包含灰度 t（[0, t]），而固定阈值用的是 gray < threshold。
    // 使用 t + 1 对齐两种边界约定，否则纯黑/白图最佳 t=0 时黑笔画会全部丢失。
    const binaryImage = binarizeFixed(imageData, otsuResult.threshold + 1);
    
    return {
        ...otsuResult,
        imageData: binaryImage
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
    if (!Number.isInteger(blockSize) || blockSize < 1 || blockSize % 2 === 0 || !Number.isFinite(C)) {
        throw new RangeError('blockSize 必须是正奇数，C 必须有限');
    }
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
            
            setPixel(result, x, y, binary, binary, binary, currentPixel.a);
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
