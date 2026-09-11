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
function bilinearInterpolate(imageData, x, y, backgroundColor = 255) {
    const x1 = Math.floor(x), y1 = Math.floor(y);
    const u = x - x1, v = y - y1;
    // 常量背景逐采样点处理；最右/最下整数像素不会因邻居越界而丢失。
    const sample = (sx, sy) => sx >= 0 && sx < imageData.width && sy >= 0 && sy < imageData.height
        ? imageData.data[(sy * imageData.width + sx) * 4] : backgroundColor;
    return Math.round(
        sample(x1, y1) * (1 - u) * (1 - v) + sample(x1 + 1, y1) * u * (1 - v) +
        sample(x1, y1 + 1) * (1 - u) * v + sample(x1 + 1, y1 + 1) * u * v
    );
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
 * srcX = (dstX - cx) * cos(θ) - (dstY - cy) * sin(θ) + cx
 * srcY = (dstX - cx) * sin(θ) + (dstY - cy) * cos(θ) + cy
 * 
 * @param {ImageData|MockImageData} imageData - 灰度/二值图像；输出尺寸固定，旋转可能裁剪
 * @param {number} angleDegrees - 旋转角度（度），正值为逆时针
 * @param {string} interpolation - 插值方法：'nearest' 或 'bilinear'（默认）
 * @param {number} backgroundColor - 背景填充颜色（默认255白色）
 * @returns {MockImageData} 旋转后的图像数据
 */
function rotateImage(imageData, angleDegrees, interpolation = 'bilinear', backgroundColor = 255) {
    if (!Number.isFinite(angleDegrees)) throw new RangeError('旋转角度必须有限');
    if (!['nearest', 'bilinear'].includes(interpolation)) throw new RangeError('未知插值方法');
    const { width, height } = imageData;
    const result = createImageData(width, height, backgroundColor, backgroundColor, backgroundColor);
    // 整数坐标表示像素中心。偶数宽高时，图像中心位于两个像素之间。
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const radians = angleDegrees * Math.PI / 180;
    const cosA = Math.cos(radians), sinA = Math.sin(radians);
    // y向下，正角视觉逆时针；下面是该正向变换的逆变换。
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - cx, dy = y - cy;
            let sx = dx * cosA - dy * sinA + cx;
            let sy = dx * sinA + dy * cosA + cy;
            // 消除90°倍数附近的浮点误差，保持整数映射。
            if (Math.abs(sx - Math.round(sx)) < 1e-10) sx = Math.round(sx);
            if (Math.abs(sy - Math.round(sy)) < 1e-10) sy = Math.round(sy);
            let value = backgroundColor;
            if (interpolation === 'bilinear') {
                value = bilinearInterpolate(imageData, sx, sy, backgroundColor);
            } else {
                const nx = Math.round(sx), ny = Math.round(sy);
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    value = imageData.data[(ny * width + nx) * 4];
                }
            }
            setPixel(result, x, y, value, value, value);
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
 * - 方差最大的试转角是校正角；倾斜角是它的相反数
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
    const { minAngle = -15, maxAngle = 15, step = 1, refine = true, refineStep = 0.1 } = options;
    validateAngleSearch(minAngle, maxAngle, step);
    if (!Number.isFinite(refineStep) || refineStep <= 0) throw new RangeError('细化步长必须为正数');
    let bestAngle = Math.min(maxAngle, Math.max(minAngle, 0));
    let maxVariance = -Infinity;
    const allResults = [];
    const evaluate = angle => {
        const rotated = rotateImage(imageData, angle, 'nearest');
        const variance = calculateProjectionVariance(calculateHorizontalProjection(rotated));
        allResults.push({ angle, variance });
        // 相同分数时优先较小旋转，空白图不任意旋转到搜索边界。
        if (variance > maxVariance + 1e-9 ||
            (Math.abs(variance - maxVariance) <= 1e-9 && Math.abs(angle) < Math.abs(bestAngle))) {
            maxVariance = variance;
            bestAngle = angle;
        }
    };
    const foregroundCount = calculateHorizontalProjection(imageData).reduce((a, b) => a + b, 0);
    if (foregroundCount === 0 || foregroundCount === imageData.width * imageData.height) {
        return { angle: 0, correctionAngle: 0, skewAngle: 0, variance: 0, allResults: [], informative: false };
    }
    for (const angle of angleGrid(minAngle, maxAngle, step)) evaluate(angle);
    if (minAngle <= 0 && maxAngle >= 0) evaluate(0);
    if (refine && step > refineStep) {
        const coarseBest = bestAngle; // 固定细化区间，不能随循环更新漂移。
        const lo = Math.max(minAngle, coarseBest - step);
        const hi = Math.min(maxAngle, coarseBest + step);
        for (const angle of angleGrid(lo, hi, refineStep)) evaluate(angle);
    }
    return { angle: bestAngle, correctionAngle: bestAngle, skewAngle: -bestAngle,
        variance: maxVariance, allResults: allResults.sort((a, b) => a.angle - b.angle), informative: true };
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
    const { interpolation = 'bilinear', method = 'projection' } = options;
    if (!['projection', 'hough'].includes(method)) throw new RangeError('未知检测方法');
    const detection = method === 'hough'
        ? detectSkewAngleByHough(imageData, options) : detectSkewAngle(imageData, options);
    // detection.angle已经是尝试旋转得到的校正角，不再取负。
    const correctionAngle = detection.angle;
    const correctedImage = rotateImage(imageData, correctionAngle, interpolation);
    return { imageData: correctedImage, angle: correctionAngle, correctionAngle,
        skewAngle: -correctionAngle, variance: detection.variance, method, detectionResult: detection };
}

function validateAngleSearch(minAngle, maxAngle, step) {
    if (![minAngle, maxAngle, step].every(Number.isFinite) || minAngle > maxAngle || step <= 0) {
        throw new RangeError('搜索区间须有限且minAngle≤maxAngle，步长须为正数');
    }
}

function angleGrid(min, max, step) {
    const values = [];
    const count = Math.floor((max - min) / step + 1e-9);
    for (let i = 0; i <= count; i++) values.push(Number((min + i * step).toFixed(10)));
    if (Math.abs(values[values.length - 1] - max) > 1e-9) values.push(max);
    return values;
}

/** 标准ρ-θ投票；θ是y向下坐标中的法线角，ρ为带符号距离。 */
function houghTransform(imageData, options = {}) {
    const { thetaStep = 1, rhoStep = 1 } = options;
    if (![thetaStep, rhoStep].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('霍夫步长须为正数');
    const { width, height } = imageData;
    const diagonal = Math.hypot(width - 1, height - 1);
    const rhoRadius = Math.ceil(diagonal / rhoStep);
    const thetas = angleGrid(0, 180, thetaStep).filter(theta => theta < 180);
    const accumulator = thetas.map(() => new Uint32Array(2 * rhoRadius + 1));
    const trig = thetas.map(t => [Math.cos(t * Math.PI / 180), Math.sin(t * Math.PI / 180)]);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (imageData.data[(y * width + x) * 4] >= 128) continue;
            for (let t = 0; t < thetas.length; t++) {
                const rho = x * trig[t][0] + y * trig[t][1];
                accumulator[t][Math.round(rho / rhoStep) + rhoRadius]++;
            }
        }
    }
    return { accumulator, thetas, thetaStep, rhoStep, diagonal, rhoRadius };
}

/**
 * 教学简化：取每个法线角上的最大ρ票数，而不是所有ρ票数之和。
 * 每个点在每个角度都投一票，所以总和恒等于前景数，不能检测方向。
 * 正视觉逆时针的校正角c=θ−90°；只在水平附近搜索。
 */
function detectSkewAngleByHough(imageData, options = {}) {
    const { minAngle = -15, maxAngle = 15, thetaStep = options.step ?? 1 } = options;
    validateAngleSearch(minAngle, maxAngle, thetaStep);
    if (minAngle <= -90 || maxAngle >= 90) throw new RangeError('霍夫校正角搜索须在(-90,90)内');
    const hough = houghTransform(imageData, { ...options, thetaStep });
    const allResults = [];
    let best = null;
    for (let t = 0; t < hough.thetas.length; t++) {
        const theta = hough.thetas[t], angle = theta - 90;
        if (angle < minAngle || angle > maxAngle) continue;
        let peak = 0;
        for (const count of hough.accumulator[t]) peak = Math.max(peak, count);
        const candidate = { angle, theta, peak };
        allResults.push(candidate);
        if (!best || peak > best.peak || (peak === best.peak && Math.abs(angle) < Math.abs(best.angle))) best = candidate;
    }
    if (!best) throw new RangeError('当前霍夫步长在搜索区间内没有采样角');
    const informative = best.peak > 0;
    const angle = informative ? best.angle : 0;
    return { angle, correctionAngle: angle, skewAngle: -angle, detectedTheta: best.theta,
        peak: best.peak, allResults, informative };
}

module.exports = {
    houghTransform,
    detectSkewAngleByHough,
    calculateHorizontalProjection,
    calculateVerticalProjection,
    calculateProjectionVariance,
    bilinearInterpolate,
    rotateImage,
    detectSkewAngle,
    deskew
};
