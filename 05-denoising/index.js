/**
 * 05. 图像去噪 (Image Denoising)
 * 
 * 本文件演示图像去噪的核心算法：
 * 1. 卷积操作的实现
 * 2. 均值滤波
 * 3. 高斯滤波
 * 4. 中值滤波
 * 
 * 学习目标：
 * - 理解卷积操作的原理
 * - 掌握三种滤波方法的实现
 * - 了解不同滤波器的适用场景
 * 
 * 与前置知识的关联：
 * - 使用 03.灰度化 的灰度处理函数
 * - 使用 04.二值化 后可能产生的噪点作为处理对象
 * - 复用 shared/imageUtils.js 中的工具函数
 */

const {
    MockImageData,
    getPixel,
    setPixel,
    cloneImageData,
    createImageData,
    grayscaleWeighted,
    clamp
} = require('../shared/imageUtils');

// ==================== 卷积核生成 ====================

/**
 * 函数名称：createMeanKernel
 * 功能说明：生成均值滤波核（Box Filter Kernel）
 * 
 * 原理解释：
 * - 均值核的所有元素都相等
 * - 每个元素的值为 1/(size × size)
 * - 保证卷积后像素值在合理范围内
 * 
 * @param {number} size - 核的大小（必须是奇数，如3、5、7）
 * @returns {number[][]} 二维数组表示的滤波核
 */
function createMeanKernel(size) {
    // Step 1: 确保 size 是奇数
    if (size % 2 === 0) {
        size = size + 1;
        console.warn(`均值核大小必须是奇数，已自动调整为 ${size}`);
    }
    
    // Step 2: 计算每个元素的权重
    const weight = 1 / (size * size);
    
    // Step 3: 创建并填充核
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
 * 函数名称：createGaussianKernel
 * 功能说明：生成高斯滤波核
 * 
 * 原理解释：
 * - 高斯核的权重服从二维高斯分布
 * - 公式：G(x,y) = (1 / 2πσ²) × e^(-(x² + y²) / 2σ²)
 * - 中心权重最大，向边缘递减
 * - σ（sigma）控制分布的"宽度"，即模糊程度
 * 
 * @param {number} size - 核的大小（必须是奇数）
 * @param {number} sigma - 高斯分布的标准差（默认1.0）
 * @returns {number[][]} 二维数组表示的高斯核
 */
function createGaussianKernel(size, sigma = 1.0) {
    // Step 1: 确保 size 是奇数
    if (size % 2 === 0) {
        size = size + 1;
        console.warn(`高斯核大小必须是奇数，已自动调整为 ${size}`);
    }
    
    const kernel = [];
    const center = Math.floor(size / 2);
    let sum = 0;
    
    // Step 2: 计算每个位置的高斯权重
    // 使用二维高斯公式：G(x,y) = e^(-(x² + y²) / 2σ²)
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            // 计算相对于中心的偏移
            const dx = x - center;
            const dy = y - center;
            
            // 高斯公式（省略前面的系数，后面会归一化）
            const exponent = -(dx * dx + dy * dy) / (2 * sigma * sigma);
            const value = Math.exp(exponent);
            
            row.push(value);
            sum += value;
        }
        kernel.push(row);
    }
    
    // Step 3: 归一化（使所有权重之和为1）
    // 这确保卷积后的像素值不会超出范围
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            kernel[y][x] /= sum;
        }
    }
    
    return kernel;
}

/**
 * 函数名称：printKernel
 * 功能说明：打印滤波核（用于调试和学习）
 * 
 * @param {number[][]} kernel - 滤波核
 * @param {string} name - 核的名称
 */
function printKernel(kernel, name = 'Kernel') {
    console.log(`\n${name} (${kernel.length}×${kernel[0].length}):`);
    console.log('┌' + '─────────'.repeat(kernel[0].length) + '┐');
    
    for (let y = 0; y < kernel.length; y++) {
        let row = '│';
        for (let x = 0; x < kernel[y].length; x++) {
            row += ` ${kernel[y][x].toFixed(4)} │`;
        }
        console.log(row);
    }
    
    console.log('└' + '─────────'.repeat(kernel[0].length) + '┘');
    
    // 验证权重和
    const sum = kernel.flat().reduce((a, b) => a + b, 0);
    console.log(`权重总和: ${sum.toFixed(6)}`);
}

// ==================== 卷积操作 ====================

/**
 * 函数名称：convolve
 * 功能说明：对灰度图像执行卷积操作
 * 
 * 原理解释：
 * - 卷积是图像处理的基础操作
 * - 滤波核在图像上滑动，对每个位置计算加权和
 * - 使用边缘复制策略处理边界
 * 
 * 卷积计算过程：
 * 1. 将核的中心对准当前像素
 * 2. 将核的每个元素与对应像素相乘
 * 3. 求和得到新的像素值
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
    
    // 遍历每个像素（跳过边界由 getPixelSafe 处理）
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            
            // 对核的每个位置进行计算
            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    // 计算对应的图像坐标
                    let imgX = x + kx - halfKernel;
                    let imgY = y + ky - halfKernel;
                    
                    // 边界处理：边缘复制策略
                    imgX = clamp(imgX, 0, width - 1);
                    imgY = clamp(imgY, 0, height - 1);
                    
                    // 获取像素灰度值
                    const pixel = getPixel(imageData, imgX, imgY);
                    const gray = pixel.r; // 假设是灰度图
                    
                    // 累加加权值
                    sum += gray * kernel[ky][kx];
                }
            }
            
            // 确保结果在有效范围内
            const newValue = clamp(Math.round(sum), 0, 255);
            setPixel(result, x, y, newValue, newValue, newValue);
        }
    }
    
    return result;
}

// ==================== 滤波器实现 ====================

/**
 * 函数名称：meanFilter
 * 功能说明：均值滤波（Box Filter）
 * 
 * 原理解释：
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
 * 函数名称：gaussianFilter
 * 功能说明：高斯滤波
 * 
 * 原理解释：
 * - 用邻域内像素的加权平均值替代中心像素
 * - 权重服从高斯分布，中心权重最大
 * - 效果：平滑图像，比均值滤波更好地保留边缘
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
 * 函数名称：medianFilter
 * 功能说明：中值滤波
 * 
 * 原理解释：
 * - 用邻域内所有像素的中值替代中心像素
 * - 中值不受极值影响，所以对椒盐噪声效果极佳
 * - 注意：这不是卷积操作，因为使用的是排序而非加权求和
 * 
 * 为什么中值滤波对椒盐噪声有效？
 * - 椒盐噪声是极值（0或255）
 * - 排序后，极值会被推到两端
 * - 中间的中值是正常像素值
 * - 因此极值被"过滤"掉了
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
                    let imgX = x + dx;
                    let imgY = y + dy;
                    
                    // 边界处理：边缘复制
                    imgX = clamp(imgX, 0, width - 1);
                    imgY = clamp(imgY, 0, height - 1);
                    
                    const pixel = getPixel(imageData, imgX, imgY);
                    values.push(pixel.r); // 假设是灰度图
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

// ==================== 噪声生成（用于测试） ====================

/**
 * 函数名称：addGaussianNoise
 * 功能说明：向图像添加高斯噪声（用于测试去噪效果）
 * 
 * 原理解释：
 * - 使用 Box-Muller 变换生成正态分布的随机数
 * - 将噪声叠加到每个像素上
 * - sigma 控制噪声强度
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @param {number} sigma - 噪声标准差（默认25）
 * @returns {MockImageData} 添加噪声后的图像数据
 */
function addGaussianNoise(imageData, sigma = 25) {
    const result = cloneImageData(imageData);
    const data = result.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Box-Muller 变换生成高斯随机数
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const noise = z * sigma;
        
        // 添加噪声到每个通道
        data[i] = clamp(Math.round(data[i] + noise), 0, 255);
        data[i + 1] = clamp(Math.round(data[i + 1] + noise), 0, 255);
        data[i + 2] = clamp(Math.round(data[i + 2] + noise), 0, 255);
    }
    
    return result;
}

/**
 * 函数名称：addSaltPepperNoise
 * 功能说明：向图像添加椒盐噪声（用于测试去噪效果）
 * 
 * 原理解释：
 * - 随机选择一定比例的像素
 * - 将它们设为纯黑（0）或纯白（255）
 * - density 控制噪声密度
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @param {number} density - 噪声密度（0-1，默认0.05即5%）
 * @returns {MockImageData} 添加噪声后的图像数据
 */
function addSaltPepperNoise(imageData, density = 0.05) {
    const result = cloneImageData(imageData);
    const { width, height } = result;
    
    // 计算需要添加噪声的像素数量
    const totalPixels = width * height;
    const noisePixels = Math.floor(totalPixels * density);
    
    // 随机添加椒盐噪声
    for (let i = 0; i < noisePixels; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        
        // 随机选择椒（黑）或盐（白）
        const value = Math.random() < 0.5 ? 0 : 255;
        setPixel(result, x, y, value, value, value);
    }
    
    return result;
}

// ==================== 演示和测试 ====================

/**
 * 计算两张图像的 PSNR（峰值信噪比）
 * 
 * 原理说明：
 * - PSNR 用于衡量图像质量
 * - 值越大表示质量越好
 * - 通常 > 30dB 认为是可接受的质量
 * 
 * @param {ImageData|MockImageData} original - 原始图像
 * @param {ImageData|MockImageData} processed - 处理后的图像
 * @returns {number} PSNR 值（单位：dB）
 */
function calculatePSNR(original, processed) {
    const { width, height } = original;
    let mse = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const orig = getPixel(original, x, y);
            const proc = getPixel(processed, x, y);
            const diff = orig.r - proc.r;
            mse += diff * diff;
        }
    }
    
    mse /= (width * height);
    
    if (mse === 0) return Infinity;
    
    const psnr = 10 * Math.log10((255 * 255) / mse);
    return psnr;
}

/**
 * 主演示函数
 */
function main() {
    console.log('='.repeat(60));
    console.log('05. 图像去噪 (Image Denoising) 演示');
    console.log('='.repeat(60));
    
    // ========== 1. 滤波核演示 ==========
    console.log('\n【1. 滤波核演示】\n');
    
    // 3×3 均值核
    const meanKernel3 = createMeanKernel(3);
    printKernel(meanKernel3, '3×3 均值核');
    
    // 3×3 高斯核
    const gaussianKernel3 = createGaussianKernel(3, 1.0);
    printKernel(gaussianKernel3, '3×3 高斯核 (σ=1.0)');
    
    // 5×5 高斯核
    const gaussianKernel5 = createGaussianKernel(5, 1.5);
    printKernel(gaussianKernel5, '5×5 高斯核 (σ=1.5)');
    
    // ========== 2. 创建测试图像 ==========
    console.log('\n【2. 创建测试图像】\n');
    
    // 创建一个简单的灰度图像（10×10）
    const testImage = createImageData(10, 10, 128, 128, 128);
    
    // 绘制一个简单的图案（中间十字）
    for (let y = 3; y <= 6; y++) {
        setPixel(testImage, 4, y, 50, 50, 50);
        setPixel(testImage, 5, y, 50, 50, 50);
    }
    for (let x = 3; x <= 6; x++) {
        setPixel(testImage, x, 4, 50, 50, 50);
        setPixel(testImage, x, 5, 50, 50, 50);
    }
    
    console.log('原始图像 (10×10):');
    printImage(testImage);
    
    // ========== 3. 高斯噪声测试 ==========
    console.log('\n【3. 高斯噪声去噪测试】\n');
    
    const gaussNoisyImage = addGaussianNoise(testImage, 30);
    console.log('添加高斯噪声后:');
    printImage(gaussNoisyImage);
    
    // 均值滤波
    const meanFiltered = meanFilter(gaussNoisyImage, 3);
    console.log('\n均值滤波后:');
    printImage(meanFiltered);
    const meanPSNR = calculatePSNR(testImage, meanFiltered);
    console.log(`PSNR: ${meanPSNR.toFixed(2)} dB`);
    
    // 高斯滤波
    const gaussFiltered = gaussianFilter(gaussNoisyImage, 3, 1.0);
    console.log('\n高斯滤波后:');
    printImage(gaussFiltered);
    const gaussPSNR = calculatePSNR(testImage, gaussFiltered);
    console.log(`PSNR: ${gaussPSNR.toFixed(2)} dB`);
    
    // 中值滤波
    const medianFiltered = medianFilter(gaussNoisyImage, 3);
    console.log('\n中值滤波后:');
    printImage(medianFiltered);
    const medianPSNR = calculatePSNR(testImage, medianFiltered);
    console.log(`PSNR: ${medianPSNR.toFixed(2)} dB`);
    
    // ========== 4. 椒盐噪声测试 ==========
    console.log('\n【4. 椒盐噪声去噪测试】\n');
    
    const spNoisyImage = addSaltPepperNoise(testImage, 0.1);
    console.log('添加椒盐噪声后 (10%密度):');
    printImage(spNoisyImage);
    
    // 均值滤波
    const meanFilteredSP = meanFilter(spNoisyImage, 3);
    console.log('\n均值滤波后:');
    printImage(meanFilteredSP);
    const meanPSNR_SP = calculatePSNR(testImage, meanFilteredSP);
    console.log(`PSNR: ${meanPSNR_SP.toFixed(2)} dB`);
    
    // 中值滤波
    const medianFilteredSP = medianFilter(spNoisyImage, 3);
    console.log('\n中值滤波后:');
    printImage(medianFilteredSP);
    const medianPSNR_SP = calculatePSNR(testImage, medianFilteredSP);
    console.log(`PSNR: ${medianPSNR_SP.toFixed(2)} dB`);
    
    // ========== 5. 结果对比 ==========
    console.log('\n【5. 去噪效果对比总结】\n');
    console.log('┌─────────────────┬────────────────────┬────────────────────┐');
    console.log('│     滤波器      │   高斯噪声 PSNR    │   椒盐噪声 PSNR    │');
    console.log('├─────────────────┼────────────────────┼────────────────────┤');
    console.log(`│     均值滤波    │    ${meanPSNR.toFixed(2).padStart(8)} dB    │    ${meanPSNR_SP.toFixed(2).padStart(8)} dB    │`);
    console.log(`│     高斯滤波    │    ${gaussPSNR.toFixed(2).padStart(8)} dB    │         N/A        │`);
    console.log(`│     中值滤波    │    ${medianPSNR.toFixed(2).padStart(8)} dB    │    ${medianPSNR_SP.toFixed(2).padStart(8)} dB    │`);
    console.log('└─────────────────┴────────────────────┴────────────────────┘');
    
    console.log('\n结论：');
    console.log('1. 高斯噪声：高斯滤波通常效果最好');
    console.log('2. 椒盐噪声：中值滤波效果远超均值滤波');
    console.log('3. 混合噪声：可以先中值再高斯滤波');
    
    // ========== 6. 卷积操作详解 ==========
    console.log('\n【6. 卷积操作详解】\n');
    demonstrateConvolution();
    
    console.log('\n' + '='.repeat(60));
    console.log('演示完成！');
    console.log('='.repeat(60));
}

/**
 * 打印图像的灰度值矩阵
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 */
function printImage(imageData) {
    const { width, height } = imageData;
    
    // 打印顶部边框
    process.stdout.write('   ');
    for (let x = 0; x < width; x++) {
        process.stdout.write(`${x.toString().padStart(4)} `);
    }
    console.log();
    
    for (let y = 0; y < height; y++) {
        process.stdout.write(`${y.toString().padStart(2)} `);
        for (let x = 0; x < width; x++) {
            const pixel = getPixel(imageData, x, y);
            const value = pixel.r;
            // 用不同灰度级别的字符表示
            const char = value < 64 ? '██' : value < 128 ? '▓▓' : value < 192 ? '░░' : '  ';
            process.stdout.write(` ${value.toString().padStart(3)} `);
        }
        console.log();
    }
}

/**
 * 演示卷积计算过程
 */
function demonstrateConvolution() {
    console.log('卷积计算过程演示：');
    console.log('');
    
    // 创建简单的示例数据
    console.log('原始图像区域 (3×3):');
    console.log('┌─────┬─────┬─────┐');
    console.log('│ 100 │ 120 │ 110 │');
    console.log('├─────┼─────┼─────┤');
    console.log('│  90 │ 255 │ 130 │  ← 中心像素 255（噪点）');
    console.log('├─────┼─────┼─────┤');
    console.log('│  80 │  95 │ 105 │');
    console.log('└─────┴─────┴─────┘');
    
    console.log('');
    console.log('3×3 均值核:');
    console.log('┌───────┬───────┬───────┐');
    console.log('│ 1/9   │ 1/9   │ 1/9   │');
    console.log('├───────┼───────┼───────┤');
    console.log('│ 1/9   │ 1/9   │ 1/9   │');
    console.log('├───────┼───────┼───────┤');
    console.log('│ 1/9   │ 1/9   │ 1/9   │');
    console.log('└───────┴───────┴───────┘');
    
    console.log('');
    console.log('均值滤波计算：');
    console.log('新像素值 = (100+120+110+90+255+130+80+95+105) / 9');
    console.log('        = 1085 / 9');
    console.log('        = 120.56 ≈ 121');
    console.log('');
    console.log('结果：噪点 255 → 121（被平滑了）');
    
    console.log('');
    console.log('中值滤波计算：');
    console.log('邻域值: [100, 120, 110, 90, 255, 130, 80, 95, 105]');
    console.log('排序后: [80, 90, 95, 100, 105, 110, 120, 130, 255]');
    console.log('中值: 105（第5个位置）');
    console.log('');
    console.log('结果：噪点 255 → 105（被完全去除）');
}

// 运行演示
main();

// ==================== 导出模块 ====================

module.exports = {
    createMeanKernel,
    createGaussianKernel,
    convolve,
    meanFilter,
    gaussianFilter,
    medianFilter,
    addGaussianNoise,
    addSaltPepperNoise,
    calculatePSNR
};
