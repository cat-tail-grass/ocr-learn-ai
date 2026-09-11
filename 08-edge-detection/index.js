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

// 核心算法与HTML共用shared实现；下文保留可直接运行的逐步实验。
const { createImageData, cloneImageData } = require('../shared/core/imageData');
const { getPixel, setPixel } = require('../shared/core/pixelAccess');
const { createSobelKernelX, createSobelKernelY, createPrewittKernelX, createPrewittKernelY, computeGradient, sobelEdgeDetection, prewittEdgeDetection, nonMaxSuppression, doubleThreshold, hysteresisTracking, cannyEdgeDetection } = require('../shared/08-edge-detection');

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
    
    console.log('>>> Canny中间步骤：幅值/NMS图仅为显示归一化，阈值作用于原始Sobel幅值');
    printImageSimple(cannyResult.steps.magnitude, '梯度幅值');
    printImageSimple(cannyResult.steps.nms, 'NMS');
    printImageSimple(cannyResult.steps.threshold, '强255/弱128');
    const patch = createImageData(3,3,0,0,0);
    [[50,50,100],[50,60,120],[50,70,130]].forEach((row,y)=>row.forEach((v,x)=>setPixel(patch,x,y,v,v,v)));
    const g = computeGradient(patch,createSobelKernelX(),createSobelKernelY());
    console.log('>>> 手算核验：Gx=270,Gy=70，实际=',g.gx[4],g.gy[4], '幅值=',g.magnitude[4].toFixed(2),'方向=',g.direction[4].toFixed(2)+'°');
    const m = new Float32Array([9,0,0,0,5,0,0,0,9]);
    console.log('>>> 45°中心5对照左上/右下9，NMS后中心=',nonMaxSuppression(m,new Float32Array(9).fill(45),3,3)[4]);
    console.log('>>> 常量图、阈值均为0：边缘数=',cannyEdgeDetection(createImageData(5,5,100,100,100),{lowThreshold:0,highThreshold:0}).edgeCount);
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
│ Canny    │ 多阶段处理，边缘精确，平台处可能多像素宽，可调阈值（推荐）      │
└──────────┴──────────────────────────────────────────────────────┘
`);
    
    console.log('\n>>> 在 OCR 中的应用');
    console.log(`
边缘检测用于：
1. 检测文字笔画的边界
2. 为连通域分析提供输入
3. 文本区域定位的辅助信息
4. 文档边界检测

接09章时需将白色边缘反相为黑前景；填充字符二值图与边缘图不是同一种区域。
`);
    
    console.log('\n✅ 边缘检测示例完成！');
    console.log('提示：运行 index.html 可以看到更直观的可视化效果。');
}

// 运行主程序
if (require.main === module) main();

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
