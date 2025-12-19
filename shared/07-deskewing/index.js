/**
 * 倾斜校正模块
 * 
 * 提供文档倾斜检测和校正功能
 * 
 * 来源：07. 倾斜校正
 */

const { createImageData } = require('../core/imageData');
const { getPixel, setPixel } = require('../core/pixelAccess');

/**
 * 计算水平投影直方图
 * 
 * 原理说明：
 * - 水平投影是统计每一行中前景（黑色）像素的数量
 * - 结果是一个一维数组，长度等于图像高度
 * - 用于分析文字行的分布规律
 * - 当文档水平时，投影会有明显的峰谷
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @returns {number[]} 水平投影数组，索引为行号，值为该行黑色像素数
 */
function calculateHorizontalProjection(imageData) {
    const { width, height } = imageData;
    const projection = new Array(height).fill(0);
    
    for (let y = 0; y < height; y++) {
        let blackCount = 0;
        for (let x = 0; x < width; x++) {
            const pixel = getPixel(imageData, x, y);
            // 黑色像素值 < 128 视为前景
            if (pixel.r < 128) {
                blackCount++;
            }
        }
        projection[y] = blackCount;
    }
    
    return projection;
}

/**
 * 计算垂直投影直方图
 * 
 * 原理说明：
 * - 垂直投影是统计每一列中前景（黑色）像素的数量
 * - 结果是一个一维数组，长度等于图像宽度
 * - 用于字符分割和文本区域检测
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @returns {number[]} 垂直投影数组，索引为列号，值为该列黑色像素数
 */
function calculateVerticalProjection(imageData) {
    const { width, height } = imageData;
    const projection = new Array(width).fill(0);
    
    for (let x = 0; x < width; x++) {
        let blackCount = 0;
        for (let y = 0; y < height; y++) {
            const pixel = getPixel(imageData, x, y);
            if (pixel.r < 128) {
                blackCount++;
            }
        }
        projection[x] = blackCount;
    }
    
    return projection;
}

/**
 * 计算投影直方图的方差
 * 
 * 原理说明：
 * - 方差反映数据的离散程度
 * - 当文档水平时，水平投影会有明显的峰（文字行）和谷（行间距）
 * - 这种峰谷分布使得方差较大
 * - 当文档倾斜时，峰谷变得模糊，方差减小
 * - 因此，方差最大的角度即为正确的文档方向
 * 
 * @param {number[]} projection - 投影直方图
 * @returns {number} 方差值
 */
function calculateProjectionVariance(projection) {
    const n = projection.length;
    if (n === 0) return 0;
    
    // 计算均值
    const sum = projection.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;
    
    // 计算方差
    let variance = 0;
    for (let i = 0; i < n; i++) {
        const diff = projection[i] - mean;
        variance += diff * diff;
    }
    
    return variance / n;
}

/**
 * 使用双线性插值计算非整数坐标的像素值
 * 
 * 原理说明：
 * - 旋转图像时，目标像素可能对应源图像的非整数坐标
 * - 双线性插值使用周围4个像素的加权平均
 * - 权重根据距离计算
 * - 结果比最近邻插值更平滑
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {number} x - X坐标（可以是小数）
 * @param {number} y - Y坐标（可以是小数）
 * @returns {number} 插值后的灰度值
 */
function bilinearInterpolate(imageData, x, y) {
    const x1 = Math.floor(x);
    const x2 = x1 + 1;
    const y1 = Math.floor(y);
    const y2 = y1 + 1;
    
    const xFrac = x - x1;
    const yFrac = y - y1;
    
    // 获取四个角点的像素值
    const q11 = getPixel(imageData, x1, y1).r;
    const q12 = getPixel(imageData, x2, y1).r;
    const q21 = getPixel(imageData, x1, y2).r;
    const q22 = getPixel(imageData, x2, y2).r;
    
    // 水平方向插值
    const r1 = q11 * (1 - xFrac) + q12 * xFrac;
    const r2 = q21 * (1 - xFrac) + q22 * xFrac;
    
    // 垂直方向插值
    return Math.round(r1 * (1 - yFrac) + r2 * yFrac);
}

/**
 * 旋转图像指定角度
 * 
 * 原理说明：
 * - 使用仿射变换进行旋转
 * - 绕图像中心点旋转
 * - 使用逆变换 + 插值计算像素值
 * - 逆变换：从目标图像坐标计算源图像坐标
 * 
 * 旋转公式（逆变换）：
 * srcX = (dstX - cx) * cos(θ) + (dstY - cy) * sin(θ) + cx
 * srcY = -(dstX - cx) * sin(θ) + (dstY - cy) * cos(θ) + cy
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @param {number} angleDegrees - 旋转角度（度），正值为逆时针
 * @param {string} interpolation - 插值方法：'nearest' 或 'bilinear'（默认）
 * @param {number} backgroundColor - 背景填充颜色（默认255白色）
 * @returns {MockImageData} 旋转后的图像数据
 */
function rotateImage(imageData, angleDegrees, interpolation = 'bilinear', backgroundColor = 255) {
    const { width, height } = imageData;
    const result = createImageData(width, height, backgroundColor, backgroundColor, backgroundColor);
    
    // 图像中心点
    const cx = width / 2;
    const cy = height / 2;
    
    // 将角度转换为弧度（负号是因为使用逆变换）
    const angleRadians = -angleDegrees * Math.PI / 180;
    const cosA = Math.cos(angleRadians);
    const sinA = Math.sin(angleRadians);
    
    // 对每个目标像素，计算其在源图像中的位置
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // 相对于中心的坐标
            const dx = x - cx;
            const dy = y - cy;
            
            // 应用逆旋转变换
            const srcX = dx * cosA + dy * sinA + cx;
            const srcY = -dx * sinA + dy * cosA + cy;
            
            // 检查是否在源图像范围内
            if (srcX >= 0 && srcX < width - 1 && srcY >= 0 && srcY < height - 1) {
                let pixelValue;
                
                if (interpolation === 'bilinear') {
                    pixelValue = bilinearInterpolate(imageData, srcX, srcY);
                } else {
                    // 最近邻插值
                    const nearestX = Math.round(srcX);
                    const nearestY = Math.round(srcY);
                    const pixel = getPixel(imageData, nearestX, nearestY);
                    pixelValue = pixel.r;
                }
                
                setPixel(result, x, y, pixelValue, pixelValue, pixelValue);
            }
        }
    }
    
    return result;
}

/**
 * 使用投影分析法检测倾斜角度
 * 
 * 原理说明：
 * - 将图像旋转不同角度
 * - 对每个角度计算水平投影的方差
 * - 方差最大的角度即为倾斜角度
 * - 先粗搜索，再细化搜索以提高精度
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {object} options - 配置选项
 * @param {number} options.minAngle - 最小搜索角度（默认 -15）
 * @param {number} options.maxAngle - 最大搜索角度（默认 15）
 * @param {number} options.step - 搜索步长（默认 1）
 * @param {boolean} options.refine - 是否进行细化搜索（默认 true）
 * @param {number} options.refineStep - 细化搜索步长（默认 0.1）
 * @returns {{angle: number, variance: number}} 检测结果
 */
function detectSkewAngle(imageData, options = {}) {
    const {
        minAngle = -15,
        maxAngle = 15,
        step = 1,
        refine = true,
        refineStep = 0.1
    } = options;
    
    let bestAngle = 0;
    let maxVariance = 0;
    
    // 粗搜索
    for (let angle = minAngle; angle <= maxAngle; angle += step) {
        const rotated = rotateImage(imageData, angle, 'nearest');
        const projection = calculateHorizontalProjection(rotated);
        const variance = calculateProjectionVariance(projection);
        
        if (variance > maxVariance) {
            maxVariance = variance;
            bestAngle = angle;
        }
    }
    
    // 细化搜索
    if (refine && step > refineStep) {
        const refineMin = bestAngle - step;
        const refineMax = bestAngle + step;
        
        for (let angle = refineMin; angle <= refineMax; angle += refineStep) {
            if (Math.abs(angle - bestAngle) < 0.001) continue;
            
            const rotated = rotateImage(imageData, angle, 'nearest');
            const projection = calculateHorizontalProjection(rotated);
            const variance = calculateProjectionVariance(projection);
            
            if (variance > maxVariance) {
                maxVariance = variance;
                bestAngle = angle;
            }
        }
    }
    
    return { angle: bestAngle, variance: maxVariance };
}

/**
 * 执行完整的倾斜校正
 * 
 * 原理说明：
 * - 首先检测倾斜角度
 * - 然后使用仿射变换旋转图像
 * - 校正方向与倾斜方向相反
 * - 返回校正后的图像和检测信息
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {object} options - 配置选项
 * @param {string} options.interpolation - 插值方法：'bilinear'（默认）或 'nearest'
 * @returns {{imageData: MockImageData, angle: number, correctionAngle: number}} 校正结果
 */
function deskew(imageData, options = {}) {
    const { interpolation = 'bilinear' } = options;
    
    // 检测倾斜角度
    const detection = detectSkewAngle(imageData, options);
    
    // 校正方向与倾斜方向相反
    const correctionAngle = -detection.angle;
    
    // 旋转图像
    const correctedImage = rotateImage(imageData, correctionAngle, interpolation);
    
    return {
        imageData: correctedImage,
        angle: detection.angle,
        correctionAngle: correctionAngle,
        variance: detection.variance
    };
}

module.exports = {
    calculateHorizontalProjection,
    calculateVerticalProjection,
    calculateProjectionVariance,
    bilinearInterpolate,
    rotateImage,
    detectSkewAngle,
    deskew
};
