/**
 * 边缘检测模块
 * 
 * 提供多种边缘检测算法
 * 
 * 来源：08. 边缘检测
 */

const { createImageData, cloneImageData } = require('../core/imageData');
const { getPixel, setPixel } = require('../core/pixelAccess');
const { clamp } = require('../core/utils');
const { gaussianFilter } = require('../05-denoising');

/**
 * 创建 Sobel X 方向卷积核
 * 
 * 原理说明：
 * - 检测垂直边缘（左右灰度变化）
 * - 中心列为 0，左负右正
 * - 中心行权重为 2，提供垂直方向的平滑效果
 * 
 * @returns {number[][]} 3×3 卷积核
 */
function createSobelKernelX() {
    return [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ];
}

/**
 * 创建 Sobel Y 方向卷积核
 * 
 * 原理说明：
 * - 检测水平边缘（上下灰度变化）
 * - 中心行为 0，上负下正
 * - 中心列权重为 2，提供水平方向的平滑效果
 * 
 * @returns {number[][]} 3×3 卷积核
 */
function createSobelKernelY() {
    return [
        [-1, -2, -1],
        [ 0,  0,  0],
        [ 1,  2,  1]
    ];
}

/**
 * 创建 Prewitt X 方向卷积核
 * 
 * 原理说明：
 * - 类似 Sobel，但所有权重相等
 * - 计算更简单，但噪声抑制能力较弱
 * 
 * @returns {number[][]} 3×3 卷积核
 */
function createPrewittKernelX() {
    return [
        [-1, 0, 1],
        [-1, 0, 1],
        [-1, 0, 1]
    ];
}

/**
 * 创建 Prewitt Y 方向卷积核
 * 
 * @returns {number[][]} 3×3 卷积核
 */
function createPrewittKernelY() {
    return [
        [-1, -1, -1],
        [ 0,  0,  0],
        [ 1,  1,  1]
    ];
}

/**
 * 计算图像梯度
 * 
 * 原理说明：
 * - 按原核方向做互相关（常被称为卷积），不反转Sobel核
 * - x向右、y向下；方向为atan2(Gy,Gx)的度数，梯度指向亮度增大方向
 * - 梯度幅值：|G| = √(Gx² + Gy²)
 * - 梯度方向：θ = atan2(Gy, Gx)
 * - 梯度幅值表示边缘强度，梯度方向垂直于边缘方向
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number[][]} kernelX - X 方向卷积核
 * @param {number[][]} kernelY - Y 方向卷积核
 * @returns {{gx: Float32Array, gy: Float32Array, magnitude: Float32Array, direction: Float32Array, width: number, height: number}} 梯度结果
 */
function computeGradient(imageData, kernelX, kernelY) {
    const { width, height } = imageData;
    const size = width * height;
    
    const gx = new Float32Array(size);
    const gy = new Float32Array(size);
    const magnitude = new Float32Array(size);
    const direction = new Float32Array(size);
    
    const kernelSize = kernelX.length;
    const halfKernel = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sumX = 0;
            let sumY = 0;
            
            // 应用卷积核
            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    let imgX = x + kx - halfKernel;
                    let imgY = y + ky - halfKernel;
                    
                    // 边界处理：边缘复制
                    imgX = clamp(imgX, 0, width - 1);
                    imgY = clamp(imgY, 0, height - 1);
                    
                    const pixel = getPixel(imageData, imgX, imgY);
                    const gray = pixel.r;
                    
                    sumX += gray * kernelX[ky][kx];
                    sumY += gray * kernelY[ky][kx];
                }
            }
            
            const idx = y * width + x;
            gx[idx] = sumX;
            gy[idx] = sumY;
            magnitude[idx] = Math.sqrt(sumX * sumX + sumY * sumY);
            direction[idx] = Math.atan2(sumY, sumX) * 180 / Math.PI;
        }
    }
    
    return { gx, gy, magnitude, direction, width, height };
}

/**
 * Sobel 边缘检测
 * 
 * 原理说明：
 * - 使用 Sobel 算子计算梯度
 * - 返回梯度幅值作为边缘强度图
 * - Sobel 算子对噪声有一定抑制能力
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {boolean} normalize - 是否归一化到 0-255（默认 true）
 * @returns {{imageData: MockImageData, gx: Float32Array, gy: Float32Array, magnitude: Float32Array, direction: Float32Array}} 边缘检测结果
 */
function sobelEdgeDetection(imageData, normalize = true) {
    const kernelX = createSobelKernelX();
    const kernelY = createSobelKernelY();
    const gradient = computeGradient(imageData, kernelX, kernelY);
    
    const { width, height, magnitude } = gradient;
    const result = createImageData(width, height, 0, 0, 0);
    
    // 找到最大梯度幅值用于归一化
    let maxMagnitude = 0;
    for (let i = 0; i < magnitude.length; i++) {
        if (magnitude[i] > maxMagnitude) {
            maxMagnitude = magnitude[i];
        }
    }
    
    // 将梯度幅值转换为图像
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            let value;
            
            if (normalize && maxMagnitude > 0) {
                value = Math.round(magnitude[idx] / maxMagnitude * 255);
            } else {
                value = clamp(Math.round(magnitude[idx]), 0, 255);
            }
            
            setPixel(result, x, y, value, value, value);
        }
    }
    
    return {
        imageData: result,
        gx: gradient.gx,
        gy: gradient.gy,
        magnitude: gradient.magnitude,
        direction: gradient.direction
    };
}

/**
 * Prewitt 边缘检测
 * 
 * 原理说明：
 * - 使用 Prewitt 算子计算梯度
 * - 比 Sobel 更简单，但噪声敏感度更高
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {boolean} normalize - 是否归一化到 0-255（默认 true）
 * @returns {{imageData: MockImageData, magnitude: Float32Array, direction: Float32Array}} 边缘检测结果
 */
function prewittEdgeDetection(imageData, normalize = true) {
    const kernelX = createPrewittKernelX();
    const kernelY = createPrewittKernelY();
    const gradient = computeGradient(imageData, kernelX, kernelY);
    
    const { width, height, magnitude } = gradient;
    const result = createImageData(width, height, 0, 0, 0);
    
    let maxMagnitude = 0;
    for (let i = 0; i < magnitude.length; i++) {
        if (magnitude[i] > maxMagnitude) {
            maxMagnitude = magnitude[i];
        }
    }
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            let value;
            
            if (normalize && maxMagnitude > 0) {
                value = Math.round(magnitude[idx] / maxMagnitude * 255);
            } else {
                value = clamp(Math.round(magnitude[idx]), 0, 255);
            }
            
            setPixel(result, x, y, value, value, value);
        }
    }
    
    return {
        imageData: result,
        magnitude: gradient.magnitude,
        direction: gradient.direction
    };
}

/**
 * 非极大值抑制 (Non-Maximum Suppression)
 * 
 * 原理说明：
 * - Canny 算法的第三步
 * - 沿着梯度方向，只保留局部最大值
 * - 将边缘细化为单像素宽度
 * - 将无向梯度量化到4个方向；平台用>=保留，未承诺严格单像素宽
 * 
 * @param {Float32Array} magnitude - 梯度幅值
 * @param {Float32Array} direction - 梯度方向（度数）
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Float32Array} 抑制后的梯度幅值
 */
function nonMaxSuppression(magnitude, direction, width, height) {
    const result = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const mag = magnitude[idx];
            
            // 将角度归一化到 0-180
            let angle = direction[idx];
            if (angle < 0) angle += 180;
            
            let neighbor1, neighbor2;
            
            // 根据梯度方向选择比较的邻居
            if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
                // 水平方向
                neighbor1 = magnitude[idx - 1];
                neighbor2 = magnitude[idx + 1];
            } else if (angle >= 22.5 && angle < 67.5) {
                // y向下，+45°为左上↔右下。
                neighbor1 = magnitude[(y - 1) * width + (x - 1)];
                neighbor2 = magnitude[(y + 1) * width + (x + 1)];
            } else if (angle >= 67.5 && angle < 112.5) {
                // 垂直方向
                neighbor1 = magnitude[(y - 1) * width + x];
                neighbor2 = magnitude[(y + 1) * width + x];
            } else {
                // +135°为右上↔左下。
                neighbor1 = magnitude[(y - 1) * width + (x + 1)];
                neighbor2 = magnitude[(y + 1) * width + (x - 1)];
            }
            
            // 只保留局部最大值
            if (mag >= neighbor1 && mag >= neighbor2) {
                result[idx] = mag;
            }
        }
    }
    
    return result;
}

/**
 * 双阈值检测
 * 
 * 原理说明：
 * - Canny 算法的第四步
 * - 将像素分为三类：
 *   - 强边缘：>= highThreshold，确定是边缘
 *   - 弱边缘：>= lowThreshold，可能是边缘
 *   - 非边缘：< lowThreshold，确定不是边缘
 * 
 * @param {Float32Array} magnitude - 梯度幅值（NMS 后）
 * @param {number} lowThreshold - 低阈值
 * @param {number} highThreshold - 高阈值
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {{strong: Uint8Array, weak: Uint8Array}} 强边缘和弱边缘标记
 */
function doubleThreshold(magnitude, lowThreshold, highThreshold, width, height) {
    if (![lowThreshold, highThreshold].every(Number.isFinite) || lowThreshold < 0 || highThreshold < lowThreshold) {
        throw new RangeError('阈值须满足0≤lowThreshold≤highThreshold');
    }
    const size = width * height;
    const strong = new Uint8Array(size);
    const weak = new Uint8Array(size);
    
    for (let i = 0; i < size; i++) {
        if (magnitude[i] <= 0) continue; // 零梯度永远不是边缘，包括阈值为0时。
        if (magnitude[i] >= highThreshold) {
            strong[i] = 1;
        } else if (magnitude[i] >= lowThreshold) {
            weak[i] = 1;
        }
    }
    
    return { strong, weak };
}

/**
 * 滞后阈值 - 边缘连接
 * 
 * 原理说明：
 * - Canny 算法的第五步
 * - 使用 BFS 从强边缘出发，连接相邻的弱边缘
 * - 与强边缘相连的弱边缘被保留，孤立的弱边缘被舍弃
 * - 这样可以保持边缘的连续性
 * 
 * @param {Uint8Array} strong - 强边缘标记
 * @param {Uint8Array} weak - 弱边缘标记
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Uint8Array} 最终边缘标记
 */
function hysteresisTracking(strong, weak, width, height) {
    const result = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    
    // 复制强边缘到结果
    for (let i = 0; i < strong.length; i++) {
        if (strong[i]) {
            result[i] = 1;
        }
    }
    
    // 8邻域偏移
    const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy = [-1, -1, -1, 0, 0, 1, 1, 1];
    const queue = [];
    
    // 所有强边缘都是种子，包含边界像素。
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (strong[idx]) {
                queue.push({ x, y });
                visited[idx] = 1;
            }
        }
    }
    
    // BFS 连接弱边缘
    for (let head = 0; head < queue.length; head++) {
        const current = queue[head];
        
        // 检查8邻域
        for (let i = 0; i < 8; i++) {
            const nx = current.x + dx[i];
            const ny = current.y + dy[i];
            
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                continue;
            }
            
            const nidx = ny * width + nx;
            
            // 如果是未访问的弱边缘，则连接
            if (weak[nidx] && !visited[nidx]) {
                result[nidx] = 1;
                visited[nidx] = 1;
                queue.push({ x: nx, y: ny });
            }
        }
    }
    
    return result;
}

/**
 * Canny 边缘检测
 * 
 * 原理说明：
 * - 经典的五步边缘检测算法
 * - Step 1: 高斯滤波去噪
 * - Step 2: 计算梯度幅值和方向（使用 Sobel 算子）
 * - Step 3: 非极大值抑制，细化边缘
 * - Step 4: 双阈值检测，区分强弱边缘
 * - Step 5: 滞后阈值，连接边缘
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {object} options - 配置选项
 * @param {number} options.gaussianSize - 高斯核大小（默认 5）
 * @param {number} options.gaussianSigma - 高斯标准差（默认 1.4）
 * @param {number} options.lowThreshold - 低阈值（默认 50）
 * @param {number} options.highThreshold - 高阈值（默认 100）
 * @returns {{imageData: MockImageData, steps: object, edgeCount: number}} 边缘检测结果和中间步骤
 */
function cannyEdgeDetection(imageData, options = {}) {
    const {
        gaussianSize = 5,
        gaussianSigma = 1.4,
        lowThreshold = 50,
        highThreshold = 100
    } = options;
    
    const { width, height } = imageData;
    const steps = {};
    
    // Step 1: 高斯滤波
    const blurred = gaussianFilter(imageData, gaussianSize, gaussianSigma);
    steps.blurred = cloneImageData(blurred);
    
    // Step 2: 计算梯度
    const kernelX = createSobelKernelX();
    const kernelY = createSobelKernelY();
    const gradient = computeGradient(blurred, kernelX, kernelY);
    
    // 找到最大梯度用于归一化显示
    let maxMag = 0;
    for (let i = 0; i < gradient.magnitude.length; i++) {
        if (gradient.magnitude[i] > maxMag) {
            maxMag = gradient.magnitude[i];
        }
    }
    
    const magnitudeImage = createImageData(width, height, 0, 0, 0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const value = maxMag > 0 ? Math.round(gradient.magnitude[idx] / maxMag * 255) : 0;
            setPixel(magnitudeImage, x, y, value, value, value);
        }
    }
    steps.magnitude = magnitudeImage;
    
    // Step 3: 非极大值抑制
    const suppressed = nonMaxSuppression(
        gradient.magnitude,
        gradient.direction,
        width,
        height
    );
    
    const nmsImage = createImageData(width, height, 0, 0, 0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const value = maxMag > 0 ? clamp(Math.round(suppressed[idx] / maxMag * 255), 0, 255) : 0;
            setPixel(nmsImage, x, y, value, value, value);
        }
    }
    steps.nms = nmsImage;
    
    // Step 4: 双阈值检测
    const { strong, weak } = doubleThreshold(
        suppressed,
        lowThreshold,
        highThreshold,
        width,
        height
    );
    
    const thresholdImage = createImageData(width, height, 0, 0, 0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            let value = 0;
            if (strong[idx]) {
                value = 255;  // 强边缘：白色
            } else if (weak[idx]) {
                value = 128;  // 弱边缘：灰色
            }
            setPixel(thresholdImage, x, y, value, value, value);
        }
    }
    steps.threshold = thresholdImage;
    
    // Step 5: 边缘连接
    const finalEdges = hysteresisTracking(strong, weak, width, height);
    
    const result = createImageData(width, height, 0, 0, 0);
    let edgeCount = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (finalEdges[idx]) {
                setPixel(result, x, y, 255, 255, 255);
                edgeCount++;
            }
        }
    }
    steps.final = result;
    
    return {
        imageData: result,
        steps: steps,
        edgeCount: edgeCount
    };
}

module.exports = {
    createSobelKernelX,
    createSobelKernelY,
    createPrewittKernelX,
    createPrewittKernelY,
    computeGradient,
    sobelEdgeDetection,
    prewittEdgeDetection,
    nonMaxSuppression,
    doubleThreshold,
    hysteresisTracking,
    cannyEdgeDetection
};
