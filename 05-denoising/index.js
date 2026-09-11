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

// 同一共享算法用于 Node 和 HTML；本文件保留逐步数字实验。
const { getPixel, setPixel, createImageData, createSeededRandom } = require('../shared/core');
const { createMeanKernel, createGaussianKernel, convolve, correlate,
    meanFilter, gaussianFilter, medianFilter, addGaussianNoise,
    addSaltPepperNoise, calculatePSNR } = require('../shared/05-denoising');

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
    
    const gaussNoisyImage = addGaussianNoise(testImage, 30, createSeededRandom(20260911));
    console.log('添加高斯噪声后:');
    printImage(gaussNoisyImage);
    
    // 均值滤波
    const meanFiltered = meanFilter(gaussNoisyImage, 3);
    console.log('\n均值滤波后:');
    printImage(meanFiltered);
    const meanPSNR = calculatePSNR(testImage, meanFiltered);
    console.log(`PSNR: ${meanPSNR.toFixed(2)} dB（含噪基线 ${calculatePSNR(testImage, gaussNoisyImage).toFixed(2)} dB）`);
    
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
    
    const spNoisyImage = addSaltPepperNoise(testImage, 0.1, createSeededRandom(20260911));
    console.log('添加椒盐噪声后 (逐像素10%概率，固定种子20260911):');
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
    console.log('1. 以上PSNR只描述这个固定样例，不保证某滤波器始终最佳。');
    console.log('2. 中值通常对稀疏椒盐有效，也可能抹去细笔画；须比较原始含噪PSNR和识别结果。');
    console.log('3. 混合噪声：可以先中值再高斯滤波');
    
    // ========== 6. 卷积操作详解 ==========
    console.log('\n【6. 卷积操作详解】\n');
    demonstrateConvolution();
    demonstrateCounterexamples();
    
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
    console.log('结果：255 → 105（取邻域中值，不等于已知真实像素）');
}

function demonstrateCounterexamples() {
    console.log('\n【7. 相关方向、细线损失与PSNR边界】');
    const row = createImageData(3, 1);
    [10, 20, 40].forEach((v, x) => setPixel(row, x, 0, v, v, v));
    const kernel = [[0, 0, 0], [1, 0, 0], [0, 0, 0]];
    console.log(`非对称核中心：相关=${getPixel(correlate(row, kernel), 1, 0).r}，卷积=${getPixel(convolve(row, kernel), 1, 0).r}`);
    const line = createImageData(3, 3);
    for (let y = 0; y < 3; y++) setPixel(line, 1, y, 0, 0, 0);
    console.log(`一像素宽黑线经3×3中值后中心=${getPixel(medianFilter(line, 3), 1, 1).r}（黑线消失）`);
    const reference = createImageData(2, 1, 0, 0, 0);
    setPixel(reference, 1, 0, 255, 255, 255);
    console.log(`PSNR([0,255],[0,0])=${calculatePSNR(reference, createImageData(2, 1, 0, 0, 0)).toFixed(4)}dB；同图=${calculatePSNR(reference, reference)}`);
    console.log('PSNR需要同尺寸、对齐的灰度参考；不等于OCR准确率。');
}

// 运行演示
if (require.main === module) main();

// ==================== 导出模块 ====================

module.exports = {
    createMeanKernel,
    createGaussianKernel,
    convolve,
    correlate,
    meanFilter,
    gaussianFilter,
    medianFilter,
    addGaussianNoise,
    addSaltPepperNoise,
    calculatePSNR
};
