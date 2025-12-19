/**
 * 特征提取模块 - 第 11 章
 * 
 * 本模块提供字符图像特征提取的各种方法，包括：
 * - 像素级特征
 * - 统计特征（均值、方差、矩）
 * - 结构特征（投影、网格）
 * - HOG 特征（方向梯度直方图）
 * 
 * 这些特征将用于后续的模板匹配和 KNN 分类器。
 */

const { cloneImageData, createImageData } = require('../core');

// ==================== 像素级特征 ====================

/**
 * 提取像素级特征
 * 
 * 原理说明：
 * 将图像的像素值展开为一维向量，这是最简单直接的特征表示。
 * 通常需要先对图像进行尺寸归一化，确保所有字符的特征向量长度相同。
 * 
 * @param {ImageData} imageData - 输入图像（应为灰度图或二值图）
 * @param {object} options - 配置选项
 * @param {boolean} options.normalize - 是否归一化到 [0, 1]，默认 true
 * @param {boolean} options.binary - 是否作为二值特征（0 或 1），默认 false
 * @returns {number[]} 像素特征向量
 */
function extractPixelFeatures(imageData, options = {}) {
    const {
        normalize = true,
        binary = false
    } = options;
    
    const { width, height, data } = imageData;
    const features = [];
    
    // 遍历所有像素，提取灰度值
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = data[idx]; // 假设已是灰度图（R=G=B）
            
            if (binary) {
                // 二值特征：前景为 1，背景为 0
                features.push(gray < 128 ? 1 : 0);
            } else if (normalize) {
                // 归一化到 [0, 1]
                features.push(gray / 255);
            } else {
                features.push(gray);
            }
        }
    }
    
    return features;
}

// ==================== 统计特征 ====================

/**
 * 提取基本统计特征
 * 
 * 原理说明：
 * 通过统计量（均值、方差、填充率、质心等）来描述图像的全局特性。
 * 这些特征维度低、计算快，但信息有损。
 * 
 * @param {ImageData} imageData - 输入图像
 * @returns {object} 包含各种统计特征的对象
 */
function extractStatisticalFeatures(imageData) {
    const { width, height, data } = imageData;
    const totalPixels = width * height;
    
    let sum = 0;
    let foregroundCount = 0;
    let sumX = 0, sumY = 0;
    
    // 第一次遍历：计算基本统计量
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = data[idx];
            sum += gray;
            
            if (gray < 128) { // 前景像素（黑色）
                foregroundCount++;
                sumX += x;
                sumY += y;
            }
        }
    }
    
    const mean = sum / totalPixels;
    const fillRatio = foregroundCount / totalPixels;
    
    // 质心（归一化到 [0, 1]）
    const centroidX = foregroundCount > 0 ? (sumX / foregroundCount) / width : 0.5;
    const centroidY = foregroundCount > 0 ? (sumY / foregroundCount) / height : 0.5;
    
    // 第二次遍历：计算方差
    let varianceSum = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = data[idx];
            varianceSum += (gray - mean) ** 2;
        }
    }
    const variance = varianceSum / totalPixels;
    const stdDev = Math.sqrt(variance);
    
    return {
        mean: mean / 255,                    // 归一化均值 [0, 1]
        variance: variance / (255 * 255),    // 归一化方差
        stdDev: stdDev / 255,                // 归一化标准差
        fillRatio,                           // 填充率（前景像素占比）
        centroidX,                           // 归一化质心 X [0, 1]
        centroidY,                           // 归一化质心 Y [0, 1]
        foregroundCount,                     // 前景像素数量
        aspectRatio: width / height          // 宽高比
    };
}

/**
 * 将统计特征转换为向量
 * 
 * @param {object} stats - extractStatisticalFeatures 的返回值
 * @returns {number[]} 特征向量
 */
function statisticalFeaturesToVector(stats) {
    return [
        stats.mean,
        stats.variance,
        stats.stdDev,
        stats.fillRatio,
        stats.centroidX,
        stats.centroidY
    ];
}

// ==================== 图像矩 ====================

/**
 * 计算图像的原始矩
 * 
 * 原理说明：
 * 原始矩 M_pq = Σ Σ x^p × y^q × I(x, y)
 * 其中 I(x, y) 是像素强度，p 和 q 是矩的阶数
 * 
 * @param {ImageData} imageData - 输入图像（二值图效果最好）
 * @param {number} p - x 的幂次
 * @param {number} q - y 的幂次
 * @returns {number} 矩值
 */
function calculateRawMoment(imageData, p, q) {
    const { width, height, data } = imageData;
    let moment = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // 对于二值图，前景为 1，背景为 0
            const intensity = data[idx] < 128 ? 1 : 0;
            moment += Math.pow(x, p) * Math.pow(y, q) * intensity;
        }
    }
    
    return moment;
}

/**
 * 计算图像的中心矩
 * 
 * 原理说明：
 * 中心矩相对于质心计算，具有平移不变性
 * μ_pq = Σ Σ (x - x̄)^p × (y - ȳ)^q × I(x, y)
 * 
 * @param {ImageData} imageData - 输入图像
 * @returns {object} 包含各阶中心矩的对象
 */
function calculateCentralMoments(imageData) {
    // 计算原始矩
    const m00 = calculateRawMoment(imageData, 0, 0);
    const m10 = calculateRawMoment(imageData, 1, 0);
    const m01 = calculateRawMoment(imageData, 0, 1);
    const m20 = calculateRawMoment(imageData, 2, 0);
    const m02 = calculateRawMoment(imageData, 0, 2);
    const m11 = calculateRawMoment(imageData, 1, 1);
    const m30 = calculateRawMoment(imageData, 3, 0);
    const m03 = calculateRawMoment(imageData, 0, 3);
    const m21 = calculateRawMoment(imageData, 2, 1);
    const m12 = calculateRawMoment(imageData, 1, 2);
    
    // 计算质心
    const xBar = m00 > 0 ? m10 / m00 : 0;
    const yBar = m00 > 0 ? m01 / m00 : 0;
    
    // 计算中心矩（使用公式展开）
    const mu00 = m00;
    const mu10 = 0; // 中心矩的一阶总是 0
    const mu01 = 0;
    const mu20 = m20 - xBar * m10;
    const mu02 = m02 - yBar * m01;
    const mu11 = m11 - xBar * m01;
    const mu30 = m30 - 3 * xBar * m20 + 2 * xBar * xBar * m10;
    const mu03 = m03 - 3 * yBar * m02 + 2 * yBar * yBar * m01;
    const mu21 = m21 - 2 * xBar * m11 - yBar * m20 + 2 * xBar * xBar * m01;
    const mu12 = m12 - 2 * yBar * m11 - xBar * m02 + 2 * yBar * yBar * m10;
    
    return {
        // 原始矩
        m00, m10, m01, m20, m02, m11, m30, m03, m21, m12,
        // 质心
        xBar, yBar,
        // 中心矩
        mu00, mu10, mu01, mu20, mu02, mu11, mu30, mu03, mu21, mu12
    };
}

/**
 * 计算 Hu 矩（7 个旋转不变矩）
 * 
 * 原理说明：
 * Hu 矩由归一化中心矩的非线性组合构成，具有：
 * - 平移不变性（使用中心矩）
 * - 尺度不变性（使用归一化）
 * - 旋转不变性（特殊的组合方式）
 * 
 * @param {ImageData} imageData - 输入图像
 * @returns {number[]} 7 个 Hu 矩值
 */
function calculateHuMoments(imageData) {
    const moments = calculateCentralMoments(imageData);
    const { m00, mu20, mu02, mu11, mu30, mu03, mu21, mu12 } = moments;
    
    // 避免除以零
    if (m00 === 0) {
        return [0, 0, 0, 0, 0, 0, 0];
    }
    
    // 计算归一化中心矩
    // η_pq = μ_pq / M00^((p+q)/2 + 1)
    const norm = (p, q) => Math.pow(m00, (p + q) / 2 + 1);
    
    const eta20 = mu20 / norm(2, 0);
    const eta02 = mu02 / norm(0, 2);
    const eta11 = mu11 / norm(1, 1);
    const eta30 = mu30 / norm(3, 0);
    const eta03 = mu03 / norm(0, 3);
    const eta21 = mu21 / norm(2, 1);
    const eta12 = mu12 / norm(1, 2);
    
    // 计算 Hu 矩（7 个不变矩）
    const h1 = eta20 + eta02;
    
    const h2 = Math.pow(eta20 - eta02, 2) + 4 * Math.pow(eta11, 2);
    
    const h3 = Math.pow(eta30 - 3 * eta12, 2) + Math.pow(3 * eta21 - eta03, 2);
    
    const h4 = Math.pow(eta30 + eta12, 2) + Math.pow(eta21 + eta03, 2);
    
    const h5 = (eta30 - 3 * eta12) * (eta30 + eta12) * 
               (Math.pow(eta30 + eta12, 2) - 3 * Math.pow(eta21 + eta03, 2)) +
               (3 * eta21 - eta03) * (eta21 + eta03) * 
               (3 * Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2));
    
    const h6 = (eta20 - eta02) * 
               (Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2)) +
               4 * eta11 * (eta30 + eta12) * (eta21 + eta03);
    
    const h7 = (3 * eta21 - eta03) * (eta30 + eta12) * 
               (Math.pow(eta30 + eta12, 2) - 3 * Math.pow(eta21 + eta03, 2)) -
               (eta30 - 3 * eta12) * (eta21 + eta03) * 
               (3 * Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2));
    
    return [h1, h2, h3, h4, h5, h6, h7];
}

/**
 * 对 Hu 矩进行对数变换
 * 
 * 原理说明：
 * Hu 矩的数值范围差异很大，对数变换可以压缩范围，使特征更易于比较
 * 
 * @param {number[]} huMoments - 7 个 Hu 矩
 * @returns {number[]} 对数变换后的 Hu 矩
 */
function logTransformHuMoments(huMoments) {
    return huMoments.map(h => {
        if (h === 0) return 0;
        return -Math.sign(h) * Math.log10(Math.abs(h) + 1e-10);
    });
}

// ==================== 投影特征 ====================

/**
 * 提取投影特征
 * 
 * 原理说明：
 * - 水平投影：统计每行的前景像素数，反映字符的垂直结构
 * - 垂直投影：统计每列的前景像素数，反映字符的水平结构
 * 
 * 这些特征对于区分不同形状的字符非常有效。
 * 
 * @param {ImageData} imageData - 输入图像（二值图效果最好）
 * @param {object} options - 配置选项
 * @param {boolean} options.normalize - 是否归一化，默认 true
 * @returns {object} 投影特征对象
 */
function extractProjectionFeatures(imageData, options = {}) {
    const { normalize = true } = options;
    
    const { width, height, data } = imageData;
    
    // 初始化投影数组
    const horizontalProjection = new Array(height).fill(0);
    const verticalProjection = new Array(width).fill(0);
    
    // 遍历所有像素，计算投影
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx] < 128) { // 前景像素
                horizontalProjection[y]++;
                verticalProjection[x]++;
            }
        }
    }
    
    // 归一化（除以最大值）
    if (normalize) {
        const maxH = Math.max(...horizontalProjection, 1);
        const maxV = Math.max(...verticalProjection, 1);
        
        for (let i = 0; i < height; i++) {
            horizontalProjection[i] /= maxH;
        }
        for (let i = 0; i < width; i++) {
            verticalProjection[i] /= maxV;
        }
    }
    
    return {
        horizontal: horizontalProjection,    // 水平投影（高度维）
        vertical: verticalProjection,        // 垂直投影（宽度维）
        combined: [...horizontalProjection, ...verticalProjection]  // 合并
    };
}

// ==================== 网格特征 ====================

/**
 * 提取网格（分区）特征
 * 
 * 原理说明：
 * 将图像划分为 N×N 的网格，统计每个网格中的前景像素比例。
 * 这种方法可以捕获字符的局部分布信息。
 * 
 * @param {ImageData} imageData - 输入图像
 * @param {number} gridSize - 网格大小（如 4 表示 4×4 网格），默认 4
 * @returns {number[]} 网格特征向量（长度为 gridSize²）
 */
function extractZoneFeatures(imageData, gridSize = 4) {
    const { width, height, data } = imageData;
    
    // 计算每个网格单元的尺寸
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;
    
    const features = [];
    
    // 遍历每个网格单元
    for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
            let foregroundCount = 0;
            let totalCount = 0;
            
            // 计算当前网格的边界
            const startX = Math.floor(gx * cellWidth);
            const startY = Math.floor(gy * cellHeight);
            const endX = Math.floor((gx + 1) * cellWidth);
            const endY = Math.floor((gy + 1) * cellHeight);
            
            // 统计网格内的前景像素
            for (let y = startY; y < endY && y < height; y++) {
                for (let x = startX; x < endX && x < width; x++) {
                    const idx = (y * width + x) * 4;
                    totalCount++;
                    if (data[idx] < 128) {
                        foregroundCount++;
                    }
                }
            }
            
            // 归一化为填充率
            features.push(totalCount > 0 ? foregroundCount / totalCount : 0);
        }
    }
    
    return features;
}

// ==================== 梯度计算（HOG 基础）====================

/**
 * 计算图像梯度
 * 
 * 原理说明：
 * 使用简单差分计算每个像素的梯度幅值和方向：
 * - Gx = I(x+1, y) - I(x-1, y)
 * - Gy = I(x, y+1) - I(x, y-1)
 * - 幅值 = √(Gx² + Gy²)
 * - 方向 = atan2(Gy, Gx)
 * 
 * @param {ImageData} imageData - 输入图像（灰度图）
 * @returns {object} 包含幅值和方向数组
 */
function computeImageGradients(imageData) {
    const { width, height, data } = imageData;
    
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            
            // 边界处理：边界像素梯度设为 0
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                magnitude[idx] = 0;
                direction[idx] = 0;
                continue;
            }
            
            // 计算 x 和 y 方向的梯度
            const left = data[((y) * width + (x - 1)) * 4];
            const right = data[((y) * width + (x + 1)) * 4];
            const up = data[((y - 1) * width + x) * 4];
            const down = data[((y + 1) * width + x) * 4];
            
            const gx = right - left;
            const gy = down - up;
            
            magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
            direction[idx] = Math.atan2(gy, gx) * 180 / Math.PI; // 转换为角度
        }
    }
    
    return { magnitude, direction, width, height };
}

// ==================== HOG 特征 ====================

/**
 * 提取 HOG（方向梯度直方图）特征
 * 
 * 原理说明：
 * HOG 是一种强大的特征描述子，通过统计局部区域的梯度方向分布来描述形状。
 * 
 * 计算步骤：
 * 1. 计算每个像素的梯度幅值和方向
 * 2. 将图像划分为 Cell（如 8×8 像素）
 * 3. 对每个 Cell 计算梯度方向直方图
 * 4. 将相邻 Cell 组成 Block，进行归一化
 * 5. 拼接所有 Block 的特征
 * 
 * @param {ImageData} imageData - 输入图像（灰度图）
 * @param {object} options - 配置选项
 * @returns {number[]} HOG 特征向量
 */
function extractHOGFeatures(imageData, options = {}) {
    const {
        cellSize = 7,           // Cell 大小（像素）
        blockSize = 2,          // Block 包含的 Cell 数
        numBins = 9,            // 方向直方图的 bin 数
        unsigned = true         // 是否使用无符号梯度（0-180°）
    } = options;
    
    const { width, height } = imageData;
    
    // Step 1: 计算梯度
    const gradients = computeImageGradients(imageData);
    
    // Step 2: 计算 Cell 数量
    const numCellsX = Math.floor(width / cellSize);
    const numCellsY = Math.floor(height / cellSize);
    
    if (numCellsX < blockSize || numCellsY < blockSize) {
        // 图像太小，返回空特征
        return [];
    }
    
    // Step 3: 计算每个 Cell 的直方图
    const cellHistograms = [];
    const binWidth = unsigned ? 180 / numBins : 360 / numBins;
    
    for (let cy = 0; cy < numCellsY; cy++) {
        for (let cx = 0; cx < numCellsX; cx++) {
            const histogram = new Array(numBins).fill(0);
            
            const startX = cx * cellSize;
            const startY = cy * cellSize;
            
            for (let y = startY; y < startY + cellSize && y < height; y++) {
                for (let x = startX; x < startX + cellSize && x < width; x++) {
                    const idx = y * width + x;
                    const mag = gradients.magnitude[idx];
                    let dir = gradients.direction[idx];
                    
                    // 将方向转换到正确的范围
                    if (unsigned) {
                        // 无符号：将 [-180, 180] 映射到 [0, 180]
                        if (dir < 0) dir += 180;
                        if (dir >= 180) dir -= 180;
                    } else {
                        // 有符号：将 [-180, 180] 映射到 [0, 360]
                        if (dir < 0) dir += 360;
                    }
                    
                    // 计算 bin 索引
                    const bin = Math.floor(dir / binWidth) % numBins;
                    
                    // 使用幅值作为投票权重
                    histogram[bin] += mag;
                }
            }
            
            cellHistograms.push(histogram);
        }
    }
    
    // Step 4: Block 归一化
    const numBlocksX = numCellsX - blockSize + 1;
    const numBlocksY = numCellsY - blockSize + 1;
    
    if (numBlocksX <= 0 || numBlocksY <= 0) {
        return [];
    }
    
    const features = [];
    
    for (let by = 0; by < numBlocksY; by++) {
        for (let bx = 0; bx < numBlocksX; bx++) {
            const blockFeatures = [];
            
            // 收集 Block 内所有 Cell 的直方图
            for (let dy = 0; dy < blockSize; dy++) {
                for (let dx = 0; dx < blockSize; dx++) {
                    const cellIdx = (by + dy) * numCellsX + (bx + dx);
                    blockFeatures.push(...cellHistograms[cellIdx]);
                }
            }
            
            // L2 归一化
            const norm = Math.sqrt(
                blockFeatures.reduce((sum, val) => sum + val * val, 0) + 1e-6
            );
            
            features.push(...blockFeatures.map(v => v / norm));
        }
    }
    
    return features;
}

// ==================== 特征归一化 ====================

/**
 * 特征向量归一化
 * 
 * @param {number[]} features - 原始特征向量
 * @param {string} method - 归一化方法：'minmax', 'zscore', 'l2'
 * @param {object} params - 额外参数（用于 minmax 和 zscore）
 * @returns {number[]} 归一化后的特征向量
 */
function normalizeFeatures(features, method = 'l2', params = {}) {
    const n = features.length;
    
    if (n === 0) return [];
    
    switch (method) {
        case 'minmax': {
            // Min-Max 归一化：x' = (x - min) / (max - min)
            const min = params.min !== undefined ? params.min : Math.min(...features);
            const max = params.max !== undefined ? params.max : Math.max(...features);
            const range = max - min || 1;
            return features.map(f => (f - min) / range);
        }
        
        case 'zscore': {
            // Z-Score 标准化：x' = (x - μ) / σ
            const mean = params.mean !== undefined ? params.mean : 
                         features.reduce((a, b) => a + b, 0) / n;
            const std = params.std !== undefined ? params.std :
                        Math.sqrt(features.reduce((sum, f) => sum + (f - mean) ** 2, 0) / n) || 1;
            return features.map(f => (f - mean) / std);
        }
        
        case 'l2':
        default: {
            // L2 归一化：x' = x / ||x||₂
            const norm = Math.sqrt(features.reduce((sum, f) => sum + f * f, 0)) || 1;
            return features.map(f => f / norm);
        }
    }
}

// ==================== 图像预处理 ====================

/**
 * 图像尺寸归一化（简单缩放）
 * 
 * 原理说明：
 * 使用最近邻插值将图像缩放到目标尺寸。
 * 这是特征提取前的必要步骤，确保所有字符的特征向量长度相同。
 * 
 * @param {ImageData} imageData - 输入图像
 * @param {number} targetWidth - 目标宽度
 * @param {number} targetHeight - 目标高度
 * @returns {ImageData} 缩放后的图像
 */
function resizeImage(imageData, targetWidth, targetHeight) {
    const { width: srcWidth, height: srcHeight, data: srcData } = imageData;
    
    const result = createImageData(targetWidth, targetHeight);
    const dstData = result.data;
    
    const scaleX = srcWidth / targetWidth;
    const scaleY = srcHeight / targetHeight;
    
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            // 最近邻插值：找到源图像中对应的位置
            const srcX = Math.min(Math.floor(x * scaleX), srcWidth - 1);
            const srcY = Math.min(Math.floor(y * scaleY), srcHeight - 1);
            
            const srcIdx = (srcY * srcWidth + srcX) * 4;
            const dstIdx = (y * targetWidth + x) * 4;
            
            dstData[dstIdx] = srcData[srcIdx];         // R
            dstData[dstIdx + 1] = srcData[srcIdx + 1]; // G
            dstData[dstIdx + 2] = srcData[srcIdx + 2]; // B
            dstData[dstIdx + 3] = srcData[srcIdx + 3]; // A
        }
    }
    
    return result;
}

/**
 * 计算图像的边界框（紧凑裁剪）
 * 
 * @param {ImageData} imageData - 输入图像（二值图）
 * @returns {object} 边界框 {x, y, width, height}
 */
function getBoundingBox(imageData) {
    const { width, height, data } = imageData;
    
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasForeground = false;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx] < 128) { // 前景像素
                hasForeground = true;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    if (!hasForeground) {
        return { x: 0, y: 0, width: width, height: height };
    }
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
}

/**
 * 裁剪并居中字符图像
 * 
 * @param {ImageData} imageData - 输入图像
 * @param {number} targetSize - 目标尺寸（正方形）
 * @param {number} padding - 边距比例，默认 0.1
 * @returns {ImageData} 处理后的图像
 */
function cropAndCenter(imageData, targetSize, padding = 0.1) {
    const bbox = getBoundingBox(imageData);
    const { width: srcWidth, height: srcHeight, data: srcData } = imageData;
    
    // 创建目标图像（白色背景）
    const result = createImageData(targetSize, targetSize);
    const dstData = result.data;
    
    // 填充白色背景
    for (let i = 0; i < dstData.length; i += 4) {
        dstData[i] = 255;
        dstData[i + 1] = 255;
        dstData[i + 2] = 255;
        dstData[i + 3] = 255;
    }
    
    // 计算缩放比例，保持宽高比
    const paddingPixels = Math.floor(targetSize * padding);
    const availableSize = targetSize - 2 * paddingPixels;
    const scale = Math.min(availableSize / bbox.width, availableSize / bbox.height);
    
    const scaledWidth = Math.floor(bbox.width * scale);
    const scaledHeight = Math.floor(bbox.height * scale);
    
    // 计算居中偏移
    const offsetX = Math.floor((targetSize - scaledWidth) / 2);
    const offsetY = Math.floor((targetSize - scaledHeight) / 2);
    
    // 复制并缩放像素
    for (let y = 0; y < scaledHeight; y++) {
        for (let x = 0; x < scaledWidth; x++) {
            const srcX = bbox.x + Math.min(Math.floor(x / scale), bbox.width - 1);
            const srcY = bbox.y + Math.min(Math.floor(y / scale), bbox.height - 1);
            
            const srcIdx = (srcY * srcWidth + srcX) * 4;
            const dstIdx = ((y + offsetY) * targetSize + (x + offsetX)) * 4;
            
            dstData[dstIdx] = srcData[srcIdx];
            dstData[dstIdx + 1] = srcData[srcIdx + 1];
            dstData[dstIdx + 2] = srcData[srcIdx + 2];
            dstData[dstIdx + 3] = srcData[srcIdx + 3];
        }
    }
    
    return result;
}

// ==================== 组合特征 ====================

/**
 * 提取组合特征（多种特征的拼接）
 * 
 * @param {ImageData} imageData - 输入图像
 * @param {object} options - 配置选项
 * @returns {object} 包含各类特征和组合特征的对象
 */
function extractCombinedFeatures(imageData, options = {}) {
    const {
        includePixels = false,      // 是否包含像素特征（维度高）
        includeStats = true,        // 是否包含统计特征
        includeHuMoments = true,    // 是否包含 Hu 矩
        includeProjection = true,   // 是否包含投影特征
        includeZone = true,         // 是否包含网格特征
        includeHOG = false,         // 是否包含 HOG 特征（计算较慢）
        zoneGridSize = 4,           // 网格大小
        hogOptions = {}             // HOG 配置
    } = options;
    
    const features = {
        all: [],
        details: {}
    };
    
    // 像素特征
    if (includePixels) {
        const pixelFeatures = extractPixelFeatures(imageData, { normalize: true });
        features.details.pixels = pixelFeatures;
        features.all.push(...pixelFeatures);
    }
    
    // 统计特征
    if (includeStats) {
        const stats = extractStatisticalFeatures(imageData);
        const statsVector = statisticalFeaturesToVector(stats);
        features.details.stats = statsVector;
        features.all.push(...statsVector);
    }
    
    // Hu 矩
    if (includeHuMoments) {
        const huMoments = calculateHuMoments(imageData);
        const logHu = logTransformHuMoments(huMoments);
        features.details.huMoments = logHu;
        features.all.push(...logHu);
    }
    
    // 投影特征
    if (includeProjection) {
        const projection = extractProjectionFeatures(imageData);
        features.details.projection = projection.combined;
        features.all.push(...projection.combined);
    }
    
    // 网格特征
    if (includeZone) {
        const zoneFeatures = extractZoneFeatures(imageData, zoneGridSize);
        features.details.zone = zoneFeatures;
        features.all.push(...zoneFeatures);
    }
    
    // HOG 特征
    if (includeHOG) {
        const hogFeatures = extractHOGFeatures(imageData, hogOptions);
        features.details.hog = hogFeatures;
        features.all.push(...hogFeatures);
    }
    
    return features;
}

// ==================== 距离度量 ====================

/**
 * 计算欧氏距离
 * 
 * @param {number[]} a - 特征向量 A
 * @param {number[]} b - 特征向量 B
 * @returns {number} 欧氏距离
 */
function euclideanDistance(a, b) {
    if (a.length !== b.length) {
        throw new Error('向量长度不一致');
    }
    
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
}

/**
 * 计算余弦相似度
 * 
 * @param {number[]} a - 特征向量 A
 * @param {number[]} b - 特征向量 B
 * @returns {number} 余弦相似度 [-1, 1]
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error('向量长度不一致');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * 计算曼哈顿距离
 * 
 * @param {number[]} a - 特征向量 A
 * @param {number[]} b - 特征向量 B
 * @returns {number} 曼哈顿距离
 */
function manhattanDistance(a, b) {
    if (a.length !== b.length) {
        throw new Error('向量长度不一致');
    }
    
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += Math.abs(a[i] - b[i]);
    }
    return sum;
}

// 导出所有函数
module.exports = {
    // 像素级特征
    extractPixelFeatures,
    
    // 统计特征
    extractStatisticalFeatures,
    statisticalFeaturesToVector,
    
    // 图像矩
    calculateRawMoment,
    calculateCentralMoments,
    calculateHuMoments,
    logTransformHuMoments,
    
    // 投影特征
    extractProjectionFeatures,
    
    // 网格特征
    extractZoneFeatures,
    
    // 梯度计算
    computeImageGradients,
    
    // HOG 特征
    extractHOGFeatures,
    
    // 特征归一化
    normalizeFeatures,
    
    // 图像预处理
    resizeImage,
    getBoundingBox,
    cropAndCenter,
    
    // 组合特征
    extractCombinedFeatures,
    
    // 距离度量
    euclideanDistance,
    cosineSimilarity,
    manhattanDistance
};
