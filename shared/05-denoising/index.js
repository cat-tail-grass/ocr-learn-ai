/**
 * 图像去噪模块
 * 
 * 提供多种滤波算法用于去除图像噪声
 * 
 * 来源：05. 图像去噪
 */

const { cloneImageData } = require('../core/imageData');
const { getPixel, setPixel } = require('../core/pixelAccess');
const { clamp } = require('../core/utils');

/** 保持旧 API 的正偶数向上调为奇数约定，但拒绝无意义尺寸。 */
function normalizeSize(size) {
    if (!Number.isInteger(size) || size < 1) throw new RangeError('size 必须是正整数');
    return size % 2 === 0 ? size + 1 : size;
}

function validateKernel(kernel) {
    const rows = kernel.length;
    const cols = kernel[0]?.length;
    if (!rows || rows % 2 === 0 || !cols || cols % 2 === 0 ||
        kernel.some(row => row.length !== cols || row.some(v => !Number.isFinite(v)))) {
        throw new RangeError('kernel 必须为非空、有限值、行列均为奇数的矩形核');
    }
}

/**
 * 创建均值滤波核
 * 
 * 原理说明：
 * - 均值核的所有元素都相等
 * - 每个元素的值为 1/(size × size)
 * - 保证卷积后像素值在合理范围内
 * 
 * @param {number} size - 核的大小（正偶数会向上调整为奇数）
 * @returns {number[][]} 二维数组表示的滤波核
 */
function createMeanKernel(size) {
    size = normalizeSize(size);
    
    const weight = 1 / (size * size);
    const kernel = [];
    
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            row.push(weight);
        }
        kernel.push(row);
    }
    
    return kernel;
}

/**
 * 创建高斯滤波核
 * 
 * 原理说明：
 * - 高斯核的权重服从二维高斯分布
 * - 公式：G(x,y) = (1 / 2πσ²) × e^(-(x² + y²) / 2σ²)
 * - 中心权重最大，向边缘递减
 * - 同样会模糊边缘；效果取决于核大小、sigma 和图像内容
 * 
 * @param {number} size - 核的大小（正偶数会向上调整为奇数）
 * @param {number} sigma - 高斯分布的标准差（默认1.0）
 * @returns {number[][]} 二维数组表示的高斯核
 */
function createGaussianKernel(size, sigma = 1.0) {
    if (!Number.isFinite(sigma) || sigma <= 0) throw new RangeError('sigma 必须为正且有限');
    size = normalizeSize(size);
    
    const kernel = [];
    const center = Math.floor(size / 2);
    let sum = 0;
    
    // 计算高斯权重
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            const dx = x - center;
            const dy = y - center;
            const exponent = -0.5 * ((dx / sigma) ** 2 + (dy / sigma) ** 2);
            const value = Math.exp(exponent);
            row.push(value);
            sum += value;
        }
        kernel.push(row);
    }
    
    // 归一化，使所有权重之和为1
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            kernel[y][x] /= sum;
        }
    }
    
    return kernel;
}

/**
 * 相关：K 不翻转，在复制边界的灰度图上滑动加权。
 * 输入与输出均为 H×W×4 的 8-bit RGBA；仅 R 用于灰度计算，alpha 原样保留。
 * 最终四舍五入并裁剪到 [0,255]，不适合保存负梯度或浮点特征响应。
 */
function correlate(imageData, kernel) {
    validateKernel(kernel);
    const { width, height, data } = imageData;
    const result = cloneImageData(imageData);
    const rows = kernel.length;
    const cols = kernel[0].length;
    const halfY = Math.floor(rows / 2);
    const halfX = Math.floor(cols / 2);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let ky = 0; ky < rows; ky++) {
                for (let kx = 0; kx < cols; kx++) {
                    const imgX = clamp(x + kx - halfX, 0, width - 1);
                    const imgY = clamp(y + ky - halfY, 0, height - 1);
                    sum += data[(imgY * width + imgX) * 4] * kernel[ky][kx];
                }
            }
            const index = (y * width + x) * 4;
            const value = clamp(Math.round(sum), 0, 255);
            result.data[index] = result.data[index + 1] = result.data[index + 2] = value;
        }
    }
    return result;
}

/**
 * 数学卷积：先将核旋转 180° 再做相关，等价于 I(x-i,y-j)K(i,j)。
 * 均值/高斯核中心对称，所以 convolve 与 correlate 在这些核上相同。
 * 其余边界、量化、alpha 约定同 correlate。
 */
function convolve(imageData, kernel) {
    validateKernel(kernel);
    const flipped = kernel.slice().reverse().map(row => row.slice().reverse());
    return correlate(imageData, flipped);
}

/**
 * 均值滤波
 * 
 * 原理说明：
 * - 用邻域内所有像素的平均值替代中心像素
 * - 效果：平滑图像，减少噪声
 * - 缺点：会模糊边缘
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number} size - 滤波器大小（默认3）
 * @returns {MockImageData} 滤波后的图像数据
 */
function meanFilter(imageData, size = 3) {
    const kernel = createMeanKernel(size);
    return convolve(imageData, kernel);
}

/**
 * 高斯滤波
 * 
 * 原理说明：
 * - 用邻域内像素的加权平均值替代中心像素
 * - 权重服从高斯分布，中心权重最大
 * - 效果：同样会模糊边缘；效果取决于核大小、sigma 和图像内容
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number} size - 滤波器大小（默认3）
 * @param {number} sigma - 高斯标准差（默认1.0）
 * @returns {MockImageData} 滤波后的图像数据
 */
function gaussianFilter(imageData, size = 3, sigma = 1.0) {
    const kernel = createGaussianKernel(size, sigma);
    return convolve(imageData, kernel);
}

/**
 * 中值滤波
 * 
 * 原理说明：
 * - 用邻域内所有像素的中值替代中心像素
 * - 少量极值通常不改变中间次序；噪声占多数或细笔画时仍可失败
 * - 可保持宽区域边缘，也会抹去细线和孤立结构
 * - 非线性滤波器，不能用卷积实现
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number} size - 滤波器大小（默认3）
 * @returns {MockImageData} 滤波后的图像数据
 */
function medianFilter(imageData, size = 3) {
    size = normalizeSize(size);
    const { width, height } = imageData;
    const result = cloneImageData(imageData);
    const halfSize = Math.floor(size / 2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const values = [];
            
            // 收集邻域内所有像素值
            for (let dy = -halfSize; dy <= halfSize; dy++) {
                for (let dx = -halfSize; dx <= halfSize; dx++) {
                    const imgX = clamp(x + dx, 0, width - 1);
                    const imgY = clamp(y + dy, 0, height - 1);
                    const pixel = getPixel(imageData, imgX, imgY);
                    values.push(pixel.r);
                }
            }
            
            // 排序并取中值
            values.sort((a, b) => a - b);
            const medianValue = values[Math.floor(values.length / 2)];
            
            setPixel(result, x, y, medianValue, medianValue, medianValue, getPixel(imageData, x, y).a);
        }
    }
    
    return result;
}

/**
 * 向图像添加高斯噪声（用于测试）
 * 
 * 原理说明：
 * - 使用 Box-Muller 变换生成正态分布随机数
 * - 将噪声叠加到每个像素上
 * - 模拟相机传感器噪声
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @param {number} sigma - 噪声标准差（默认25）
 * @param {Function} [random=Math.random] - 返回 [0,1) 的随机数；可注入固定种子
 * @returns {MockImageData} 添加噪声后的图像数据
 */
function addGaussianNoise(imageData, sigma = 25, random = Math.random) {
    if (!Number.isFinite(sigma) || sigma < 0) throw new RangeError('噪声 sigma 必须非负且有限');
    const result = cloneImageData(imageData);
    if (sigma === 0) return result;
    const data = result.data;
    for (let i = 0; i < data.length; i += 4) {
        // random()∈[0,1)，所以 u1∈(0,1]，不会 log(0)。
        const u1 = 1 - random();
        const u2 = random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const noise = z * sigma;
        // 彩色输入三个通道共享本像素的噪声；本章演示使用灰度图。
        for (let channel = 0; channel < 3; channel++) {
            data[i + channel] = clamp(Math.round(data[i + channel] + noise), 0, 255);
        }
    }
    return result;
}

/**
 * 向图像添加椒盐噪声（用于测试）
 * 
 * 原理说明：
 * - 每个像素独立以给定概率被选择
 * - 将它们设为纯黑（0，椒）或纯白（255，盐）
 * - 模拟传感器坏点或传输错误
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @param {number} density - 噪声密度（0-1，默认0.05即5%）
 * @param {Function} [random=Math.random] - 返回 [0,1) 的随机数；可注入固定种子
 * @returns {MockImageData} 添加噪声后的图像数据
 */
function addSaltPepperNoise(imageData, density = 0.05, random = Math.random) {
    if (!Number.isFinite(density) || density < 0 || density > 1) {
        throw new RangeError('density 必须在 [0,1]');
    }
    const result = cloneImageData(imageData);
    // 每个像素独立以 density 概率被选中；是期望比例，不是固定数量。
    // 被选中后椒/盐各 50%；原来已是相同极值时外观可能不变。
    for (let i = 0; i < result.data.length; i += 4) {
        if (random() < density) {
            const value = random() < 0.5 ? 0 : 255;
            result.data[i] = result.data[i + 1] = result.data[i + 2] = value;
        }
    }
    return result;
}

/**
 * 8-bit 灰度 PSNR：MSE=Σ(I-J)²/(W×H)，PSNR=10log10(255²/MSE)。
 * 对齐、同尺寸灰度输入；忽略 alpha，只读 R。完全相同为 +Infinity。
 * 用于与已知干净参考比较；不代表 OCR 准确率，也没有通用 30dB 合格线。
 */
function calculatePSNR(original, processed) {
    if (!original.width || !original.height || original.width !== processed.width ||
        original.height !== processed.height || original.data.length !== original.width * original.height * 4 ||
        processed.data.length !== original.data.length) {
        throw new RangeError('PSNR 需要相同且非空尺寸的灰度 RGBA 图像');
    }
    let squaredError = 0;
    for (let i = 0; i < original.data.length; i += 4) {
        if (original.data[i] !== original.data[i + 1] || original.data[i] !== original.data[i + 2] ||
            processed.data[i] !== processed.data[i + 1] || processed.data[i] !== processed.data[i + 2]) {
            throw new RangeError('本章 PSNR 仅接受 R=G=B 的灰度图');
        }
        squaredError += (original.data[i] - processed.data[i]) ** 2;
    }
    const mse = squaredError / (original.width * original.height);
    return mse === 0 ? Infinity : 10 * Math.log10(255 ** 2 / mse);
}

module.exports = {
    createMeanKernel,
    createGaussianKernel,
    convolve,
    correlate,
    calculatePSNR,
    meanFilter,
    gaussianFilter,
    medianFilter,
    addGaussianNoise,
    addSaltPepperNoise
};
