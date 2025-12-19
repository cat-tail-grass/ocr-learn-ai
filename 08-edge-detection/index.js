/**
 * 08. 边缘检测 (Edge Detection) - Node.js 示例
 * 
 * 本文件演示边缘检测的核心算法实现：
 * 1. Sobel 边缘检测
 * 2. Prewitt 边缘检测
 * 3. Canny 边缘检测（完整五步实现）
 * 
 * 前置知识：
 * - 05. 图像去噪（卷积操作）
 * - 07. 倾斜校正（图像预处理）
 * 
 * 运行方式：node index.js
 */

// 引入共享工具函数
const {
    MockImageData,
    getPixel,
    setPixel,
    cloneImageData,
    createImageData,
    convolve,
    gaussianFilter,
    clamp
} = require('../shared/imageUtils');

// ==================== 梯度算子定义 ====================

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

// ==================== 基础梯度计算 ====================

/**
 * 使用指定算子计算图像梯度
 * 
 * 原理说明：
 * - 分别使用 X 和 Y 方向的卷积核进行卷积
 * - 卷积结果可能为负值，需要单独存储
 * - 最终计算梯度幅值和方向
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number[][]} kernelX - X 方向卷积核
 * @param {number[][]} kernelY - Y 方向卷积核
 * @returns {{gx: number[], gy: number[], magnitude: number[], direction: number[]}} 梯度结果
 */
function computeGradient(imageData, kernelX, kernelY) {
    const { width, height } = imageData;
    const size = width * height;
    
    // 存储梯度分量（可能为负值）
    const gx = new Float32Array(size);
    const gy = new Float32Array(size);
    const magnitude = new Float32Array(size);
    const direction = new Float32Array(size);
    
    const kernelSize = kernelX.length;
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Step 1: 计算 Gx 和 Gy
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sumX = 0;
            let sumY = 0;
            
            // 卷积计算
            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    // 计算图像中对应的位置
                    let imgX = x + kx - halfKernel;
                    let imgY = y + ky - halfKernel;
                    
                    // 边界处理：边缘复制
                    imgX = clamp(imgX, 0, width - 1);
                    imgY = clamp(imgY, 0, height - 1);
                    
                    const pixel = getPixel(imageData, imgX, imgY);
                    const gray = pixel.r; // 假设是灰度图
                    
                    sumX += gray * kernelX[ky][kx];
                    sumY += gray * kernelY[ky][kx];
                }
            }
            
            const idx = y * width + x;
            gx[idx] = sumX;
            gy[idx] = sumY;
            
            // Step 2: 计算梯度幅值
            // G = √(Gx² + Gy²)
            magnitude[idx] = Math.sqrt(sumX * sumX + sumY * sumY);
            
            // Step 3: 计算梯度方向
            // θ = arctan(Gy / Gx)，结果转换为度数
            direction[idx] = Math.atan2(sumY, sumX) * 180 / Math.PI;
        }
    }
    
    return { gx, gy, magnitude, direction, width, height };
}

// ==================== Sobel 边缘检测 ====================

/**
 * Sobel 边缘检测
 * 
 * 原理说明：
 * - 使用 Sobel 算子计算梯度
 * - 返回梯度幅值作为边缘强度图
 * 
 * 优点：
 * - 简单快速
 * - 有一定的噪声抑制能力
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {boolean} normalize - 是否归一化到 0-255（默认 true）
 * @returns {{imageData: MockImageData, gx: Float32Array, gy: Float32Array, magnitude: Float32Array, direction: Float32Array}} 边缘检测结果
 */
function sobelEdgeDetection(imageData, normalize = true) {
    console.log('=== Sobel 边缘检测 ===');
    
    const kernelX = createSobelKernelX();
    const kernelY = createSobelKernelY();
    
    console.log('Sobel X 核:', kernelX);
    console.log('Sobel Y 核:', kernelY);
    
    // 计算梯度
    const gradient = computeGradient(imageData, kernelX, kernelY);
    
    // 创建输出图像
    const { width, height, magnitude } = gradient;
    const result = createImageData(width, height, 0, 0, 0);
    
    // 找到最大幅值用于归一化
    let maxMagnitude = 0;
    for (let i = 0; i < magnitude.length; i++) {
        if (magnitude[i] > maxMagnitude) {
            maxMagnitude = magnitude[i];
        }
    }
    
    console.log(`最大梯度幅值: ${maxMagnitude.toFixed(2)}`);
    
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

// ==================== Prewitt 边缘检测 ====================

/**
 * Prewitt 边缘检测
 * 
 * 原理说明：
 * - 使用 Prewitt 算子计算梯度
 * - 比 Sobel 更简单，但噪声敏感度更高
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {boolean} normalize - 是否归一化到 0-255（默认 true）
 * @returns {{imageData: MockImageData, magnitude: Float32Array}} 边缘检测结果
 */
function prewittEdgeDetection(imageData, normalize = true) {
    console.log('\n=== Prewitt 边缘检测 ===');
    
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
    
    console.log(`最大梯度幅值: ${maxMagnitude.toFixed(2)}`);
    
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

// ==================== Canny 边缘检测 ====================

/**
 * 非极大值抑制 (Non-Maximum Suppression)
 * 
 * 原理说明：
 * - 沿着梯度方向，只保留局部最大值
 * - 将梯度方向离散化为 4 个方向（0°、45°、90°、135°）
 * - 比较当前像素与该方向上两个相邻像素的梯度幅值
 * - 如果当前像素不是最大值，则抑制（设为 0）
 * 
 * @param {Float32Array} magnitude - 梯度幅值
 * @param {Float32Array} direction - 梯度方向（度数）
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Float32Array} 抑制后的梯度幅值
 */
function nonMaxSuppression(magnitude, direction, width, height) {
    console.log('\n--- 非极大值抑制 (NMS) ---');
    
    const result = new Float32Array(width * height);
    let suppressedCount = 0;
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const mag = magnitude[idx];
            
            // 将角度归一化到 0-180（边缘方向不区分正反）
            let angle = direction[idx];
            if (angle < 0) angle += 180;
            
            // 根据角度确定比较方向
            let neighbor1, neighbor2;
            
            // 角度离散化为 4 个方向
            if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
                // 水平方向 (0°)：比较左右
                neighbor1 = magnitude[idx - 1];
                neighbor2 = magnitude[idx + 1];
            } else if (angle >= 22.5 && angle < 67.5) {
                // 对角方向 (45°)：比较右上和左下
                neighbor1 = magnitude[(y - 1) * width + (x + 1)];
                neighbor2 = magnitude[(y + 1) * width + (x - 1)];
            } else if (angle >= 67.5 && angle < 112.5) {
                // 垂直方向 (90°)：比较上下
                neighbor1 = magnitude[(y - 1) * width + x];
                neighbor2 = magnitude[(y + 1) * width + x];
            } else {
                // 对角方向 (135°)：比较左上和右下
                neighbor1 = magnitude[(y - 1) * width + (x - 1)];
                neighbor2 = magnitude[(y + 1) * width + (x + 1)];
            }
            
            // 如果当前像素是局部最大值，保留；否则抑制
            if (mag >= neighbor1 && mag >= neighbor2) {
                result[idx] = mag;
            } else {
                result[idx] = 0;
                suppressedCount++;
            }
        }
    }
    
    const totalPixels = (width - 2) * (height - 2);
    console.log(`抑制像素: ${suppressedCount}/${totalPixels} (${(suppressedCount/totalPixels*100).toFixed(1)}%)`);
    
    return result;
}

/**
 * 双阈值检测
 * 
 * 原理说明：
 * - 将像素分为三类：强边缘、弱边缘、非边缘
 * - 强边缘：梯度幅值 >= 高阈值
 * - 弱边缘：低阈值 <= 梯度幅值 < 高阈值
 * - 非边缘：梯度幅值 < 低阈值
 * 
 * @param {Float32Array} magnitude - 梯度幅值（NMS 后）
 * @param {number} lowThreshold - 低阈值
 * @param {number} highThreshold - 高阈值
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {{strong: Uint8Array, weak: Uint8Array}} 强边缘和弱边缘标记
 */
function doubleThreshold(magnitude, lowThreshold, highThreshold, width, height) {
    console.log(`\n--- 双阈值检测 (低=${lowThreshold}, 高=${highThreshold}) ---`);
    
    const size = width * height;
    const strong = new Uint8Array(size); // 强边缘标记
    const weak = new Uint8Array(size);   // 弱边缘标记
    
    let strongCount = 0;
    let weakCount = 0;
    
    for (let i = 0; i < size; i++) {
        if (magnitude[i] >= highThreshold) {
            strong[i] = 1;
            strongCount++;
        } else if (magnitude[i] >= lowThreshold) {
            weak[i] = 1;
            weakCount++;
        }
    }
    
    console.log(`强边缘: ${strongCount} 像素`);
    console.log(`弱边缘: ${weakCount} 像素`);
    console.log(`非边缘: ${size - strongCount - weakCount} 像素`);
    
    return { strong, weak };
}

/**
 * 滞后阈值 - 边缘连接
 * 
 * 原理说明：
 * - 使用 BFS/DFS 从强边缘出发，连接相邻的弱边缘
 * - 如果弱边缘与强边缘相连（8邻域），则保留为边缘
 * - 孤立的弱边缘被舍弃
 * 
 * @param {Uint8Array} strong - 强边缘标记
 * @param {Uint8Array} weak - 弱边缘标记
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Uint8Array} 最终边缘标记
 */
function hysteresisTracking(strong, weak, width, height) {
    console.log('\n--- 边缘连接（滞后阈值） ---');
    
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
    
    // 使用 BFS 从每个强边缘开始追踪
    const queue = [];
    
    // 将所有强边缘加入队列
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (strong[idx]) {
                queue.push({ x, y });
                visited[idx] = 1;
            }
        }
    }
    
    let connectedWeakCount = 0;
    
    // BFS 追踪
    while (queue.length > 0) {
        const current = queue.shift();
        
        // 检查 8 个邻居
        for (let i = 0; i < 8; i++) {
            const nx = current.x + dx[i];
            const ny = current.y + dy[i];
            
            // 边界检查
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                continue;
            }
            
            const nidx = ny * width + nx;
            
            // 如果邻居是弱边缘且未访问过
            if (weak[nidx] && !visited[nidx]) {
                result[nidx] = 1; // 标记为边缘
                visited[nidx] = 1;
                queue.push({ x: nx, y: ny });
                connectedWeakCount++;
            }
        }
    }
    
    console.log(`连接的弱边缘: ${connectedWeakCount} 像素`);
    
    return result;
}

/**
 * Canny 边缘检测 - 完整实现
 * 
 * 原理说明：
 * - 五步经典算法：高斯滤波 → 梯度计算 → NMS → 双阈值 → 边缘连接
 * - 每个步骤都有明确的目的和作用
 * - 可调节参数：高斯核大小、高低阈值
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {object} options - 配置选项
 * @param {number} options.gaussianSize - 高斯核大小（默认 5）
 * @param {number} options.gaussianSigma - 高斯标准差（默认 1.4）
 * @param {number} options.lowThreshold - 低阈值（默认 50）
 * @param {number} options.highThreshold - 高阈值（默认 100）
 * @returns {{imageData: MockImageData, steps: object}} 边缘检测结果和中间步骤
 */
function cannyEdgeDetection(imageData, options = {}) {
    console.log('\n========== Canny 边缘检测 ==========');
    
    const {
        gaussianSize = 5,
        gaussianSigma = 1.4,
        lowThreshold = 50,
        highThreshold = 100
    } = options;
    
    const { width, height } = imageData;
    
    // 保存中间步骤用于可视化
    const steps = {};
    
    // ========== Step 1: 高斯滤波 ==========
    console.log('\n[Step 1] 高斯滤波');
    console.log(`  高斯核大小: ${gaussianSize}×${gaussianSize}`);
    console.log(`  高斯标准差: ${gaussianSigma}`);
    
    const blurred = gaussianFilter(imageData, gaussianSize, gaussianSigma);
    steps.blurred = cloneImageData(blurred);
    
    // ========== Step 2: 计算梯度 ==========
    console.log('\n[Step 2] 计算梯度（使用 Sobel 算子）');
    
    const kernelX = createSobelKernelX();
    const kernelY = createSobelKernelY();
    const gradient = computeGradient(blurred, kernelX, kernelY);
    
    // 保存梯度幅值图
    const magnitudeImage = createImageData(width, height, 0, 0, 0);
    let maxMag = 0;
    for (let i = 0; i < gradient.magnitude.length; i++) {
        if (gradient.magnitude[i] > maxMag) {
            maxMag = gradient.magnitude[i];
        }
    }
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const value = Math.round(gradient.magnitude[idx] / maxMag * 255);
            setPixel(magnitudeImage, x, y, value, value, value);
        }
    }
    steps.magnitude = magnitudeImage;
    console.log(`  最大梯度幅值: ${maxMag.toFixed(2)}`);
    
    // ========== Step 3: 非极大值抑制 ==========
    console.log('\n[Step 3] 非极大值抑制');
    
    const suppressed = nonMaxSuppression(
        gradient.magnitude, 
        gradient.direction, 
        width, 
        height
    );
    
    // 保存 NMS 结果图
    const nmsImage = createImageData(width, height, 0, 0, 0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const value = clamp(Math.round(suppressed[idx] / maxMag * 255), 0, 255);
            setPixel(nmsImage, x, y, value, value, value);
        }
    }
    steps.nms = nmsImage;
    
    // ========== Step 4: 双阈值检测 ==========
    console.log('\n[Step 4] 双阈值检测');
    
    // 根据最大梯度幅值调整阈值（如果使用百分比）
    const actualLow = lowThreshold;
    const actualHigh = highThreshold;
    
    const { strong, weak } = doubleThreshold(
        suppressed, 
        actualLow, 
        actualHigh, 
        width, 
        height
    );
    
    // 保存双阈值结果图（强=白，弱=灰，非边缘=黑）
    const thresholdImage = createImageData(width, height, 0, 0, 0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            let value = 0;
            if (strong[idx]) {
                value = 255; // 强边缘 - 白色
            } else if (weak[idx]) {
                value = 128; // 弱边缘 - 灰色
            }
            setPixel(thresholdImage, x, y, value, value, value);
        }
    }
    steps.threshold = thresholdImage;
    
    // ========== Step 5: 边缘连接 ==========
    console.log('\n[Step 5] 边缘连接（滞后阈值）');
    
    const finalEdges = hysteresisTracking(strong, weak, width, height);
    
    // 创建最终结果图
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
    console.log(`\n最终边缘像素: ${edgeCount}`);
    console.log('========== Canny 完成 ==========\n');
    
    return {
        imageData: result,
        steps: steps,
        edgeCount: edgeCount
    };
}

// ==================== 测试代码 ====================

/**
 * 创建测试用的灰度图像
 * 
 * 创建一个包含简单几何形状的测试图像：
 * - 左边是垂直边缘
 * - 右边是水平边缘
 * - 中间是对角线边缘
 */
function createTestImage() {
    const width = 20;
    const height = 20;
    const testImage = createImageData(width, height, 200, 200, 200); // 浅灰背景
    
    // 绘制一个深色矩形（创建边缘）
    for (let y = 5; y < 15; y++) {
        for (let x = 5; x < 15; x++) {
            setPixel(testImage, x, y, 50, 50, 50); // 深灰色
        }
    }
    
    return testImage;
}

/**
 * 打印简化的图像表示
 */
function printImageSimple(imageData, title) {
    console.log(`\n${title}:`);
    console.log(`尺寸: ${imageData.width}×${imageData.height}`);
    
    const { width, height } = imageData;
    
    // 只打印一小部分
    const displaySize = Math.min(10, width, height);
    
    let output = '';
    for (let y = 0; y < displaySize; y++) {
        let row = '';
        for (let x = 0; x < displaySize; x++) {
            const pixel = getPixel(imageData, x, y);
            // 使用字符表示灰度级别
            if (pixel.r > 200) {
                row += '██'; // 白色/亮
            } else if (pixel.r > 100) {
                row += '▓▓'; // 中灰
            } else if (pixel.r > 50) {
                row += '░░'; // 暗灰
            } else {
                row += '  '; // 黑色/暗
            }
        }
        output += row + '\n';
    }
    console.log(output);
}

/**
 * 统计边缘像素
 */
function countEdgePixels(imageData) {
    let count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 128) {
            count++;
        }
    }
    return count;
}

// ==================== 主程序 ====================

function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          08. 边缘检测 (Edge Detection) - 示例程序           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 创建测试图像
    console.log('>>> 创建测试图像');
    const testImage = createTestImage();
    printImageSimple(testImage, '原始图像');
    
    // 测试 Sobel 边缘检测
    console.log('\n' + '='.repeat(60));
    console.log('>>> 测试 Sobel 边缘检测');
    console.log('='.repeat(60));
    
    const sobelResult = sobelEdgeDetection(testImage);
    printImageSimple(sobelResult.imageData, 'Sobel 结果');
    console.log(`边缘像素数: ${countEdgePixels(sobelResult.imageData)}`);
    
    // 测试 Prewitt 边缘检测
    console.log('\n' + '='.repeat(60));
    console.log('>>> 测试 Prewitt 边缘检测');
    console.log('='.repeat(60));
    
    const prewittResult = prewittEdgeDetection(testImage);
    printImageSimple(prewittResult.imageData, 'Prewitt 结果');
    console.log(`边缘像素数: ${countEdgePixels(prewittResult.imageData)}`);
    
    // 测试 Canny 边缘检测
    console.log('\n' + '='.repeat(60));
    console.log('>>> 测试 Canny 边缘检测');
    console.log('='.repeat(60));
    
    const cannyResult = cannyEdgeDetection(testImage, {
        gaussianSize: 3,
        gaussianSigma: 1.0,
        lowThreshold: 30,
        highThreshold: 80
    });
    
    printImageSimple(cannyResult.imageData, 'Canny 结果');
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('>>> 边缘检测算法对比');
    console.log('='.repeat(60));
    
    console.log(`
┌──────────┬──────────────────────────────────────────────────────┐
│ 算法     │ 特点                                                  │
├──────────┼──────────────────────────────────────────────────────┤
│ Sobel    │ 简单快速，有一定噪声抑制，边缘较粗                    │
│ Prewitt  │ 更简单，噪声敏感度较高                                │
│ Canny    │ 多阶段处理，边缘精确，单像素宽，可调阈值（推荐）      │
└──────────┴──────────────────────────────────────────────────────┘
`);
    
    console.log('\n>>> 在 OCR 中的应用');
    console.log(`
边缘检测用于：
1. 检测文字笔画的边界
2. 为连通域分析提供输入
3. 文本区域定位的辅助信息
4. 文档边界检测

推荐流程：灰度化 → 去噪 → 边缘检测 → 连通域分析
`);
    
    console.log('\n✅ 边缘检测示例完成！');
    console.log('提示：运行 index.html 可以看到更直观的可视化效果。');
}

// 运行主程序
main();

// 导出函数供其他模块使用
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
