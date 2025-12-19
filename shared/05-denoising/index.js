/**
 * 图像去噪模块
 * 
 * 提供多种滤波算法用于去除图像噪声
 * 
 * 来源：05. 图像去噪
 */

const { cloneImageData, createImageData } = require('../core/imageData');
const { getPixel, setPixel } = require('../core/pixelAccess');
const { clamp } = require('../core/utils');

/**
 * 创建均值滤波核
 * 
 * 原理说明：
 * - 均值核的所有元素都相等
 * - 每个元素的值为 1/(size × size)
 * - 保证卷积后像素值在合理范围内
 * 
 * @param {number} size - 核的大小（必须是奇数）
 * @returns {number[][]} 二维数组表示的滤波核
 */
function createMeanKernel(size) {
    if (size % 2 === 0) size = size + 1;
    
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
 * - 比均值滤波更好地保留边缘
 * 
 * @param {number} size - 核的大小（必须是奇数）
 * @param {number} sigma - 高斯分布的标准差（默认1.0）
 * @returns {number[][]} 二维数组表示的高斯核
 */
function createGaussianKernel(size, sigma = 1.0) {
    if (size % 2 === 0) size = size + 1;
    
    const kernel = [];
    const center = Math.floor(size / 2);
    let sum = 0;
    
    // 计算高斯权重
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            const dx = x - center;
            const dy = y - center;
            const exponent = -(dx * dx + dy * dy) / (2 * sigma * sigma);
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
 * 对灰度图像执行卷积操作
 * 
 * 原理说明：
 * - 卷积是图像处理的基础操作
 * - 滤波核在图像上滑动，对每个位置计算加权和
 * - 使用边缘复制策略处理边界
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number[][]} kernel - 滤波核（二维数组）
 * @returns {MockImageData} 卷积后的图像数据
 */
function convolve(imageData, kernel) {
    const { width, height } = imageData;
    const result = cloneImageData(imageData);
    
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            
            // 对核的每个位置进行加权求和
            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    let imgX = x + kx - halfKernel;
                    let imgY = y + ky - halfKernel;
                    
                    // 边界处理：边缘复制
                    imgX = clamp(imgX, 0, width - 1);
                    imgY = clamp(imgY, 0, height - 1);
                    
                    const pixel = getPixel(imageData, imgX, imgY);
                    sum += pixel.r * kernel[ky][kx];
                }
            }
            
            const newValue = clamp(Math.round(sum), 0, 255);
            setPixel(result, x, y, newValue, newValue, newValue);
        }
    }
    
    return result;
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
 * - 效果：比均值滤波更好地保留边缘
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
 * - 中值不受极值影响，对椒盐噪声效果极佳
 * - 保留边缘效果好
 * - 非线性滤波器，不能用卷积实现
 * 
 * @param {ImageData|MockImageData} imageData - 灰度图像数据
 * @param {number} size - 滤波器大小（默认3）
 * @returns {MockImageData} 滤波后的图像数据
 */
function medianFilter(imageData, size = 3) {
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
            
            setPixel(result, x, y, medianValue, medianValue, medianValue);
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
 * @returns {MockImageData} 添加噪声后的图像数据
 */
function addGaussianNoise(imageData, sigma = 25) {
    const result = cloneImageData(imageData);
    const data = result.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Box-Muller 变换生成正态分布随机数
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const noise = z * sigma;
        
        const newValue = clamp(Math.round(data[i] + noise), 0, 255);
        data[i] = newValue;
        data[i + 1] = newValue;
        data[i + 2] = newValue;
    }
    
    return result;
}

/**
 * 向图像添加椒盐噪声（用于测试）
 * 
 * 原理说明：
 * - 随机选择一定比例的像素
 * - 将它们设为纯黑（0，椒）或纯白（255，盐）
 * - 模拟传感器坏点或传输错误
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @param {number} density - 噪声密度（0-1，默认0.05即5%）
 * @returns {MockImageData} 添加噪声后的图像数据
 */
function addSaltPepperNoise(imageData, density = 0.05) {
    const result = cloneImageData(imageData);
    const { width, height } = result;
    
    const totalPixels = width * height;
    const noisePixels = Math.floor(totalPixels * density);
    
    for (let i = 0; i < noisePixels; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        const value = Math.random() < 0.5 ? 0 : 255; // 50%椒，50%盐
        setPixel(result, x, y, value, value, value);
    }
    
    return result;
}

module.exports = {
    createMeanKernel,
    createGaussianKernel,
    convolve,
    meanFilter,
    gaussianFilter,
    medianFilter,
    addGaussianNoise,
    addSaltPepperNoise
};
