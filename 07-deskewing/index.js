/**
 * 07. 倾斜校正 (Deskewing / Skew Correction)
 * 
 * 本文件演示倾斜校正的核心算法实现：
 * 1. 投影分析法检测倾斜角度
 * 2. 霍夫变换检测直线（简化版）
 * 3. 仿射变换实现图像旋转
 * 4. 双线性插值处理旋转后的像素值
 * 
 * 运行方式：node index.js
 */

// 核心算法与HTML共用shared实现；下文保留可直接运行的逐步实验。
const { createImageData, cloneImageData } = require('../shared/core/imageData');
const { getPixel, setPixel } = require('../shared/core/pixelAccess');
const { houghTransform, detectSkewAngleByHough, calculateHorizontalProjection, calculateVerticalProjection, calculateProjectionVariance, bilinearInterpolate, rotateImage, detectSkewAngle, deskew } = require('../shared/07-deskewing');
const detectSkewAngleByProjection = detectSkewAngle;

function createTestImage() {
    const width = 200;
    const height = 150;
    const image = createImageData(width, height, 255, 255, 255);
    
    // 创建几行"文字"（用黑色矩形模拟）
    const lines = [
        { y: 30, width: 150 },
        { y: 50, width: 120 },
        { y: 70, width: 160 },
        { y: 90, width: 100 },
        { y: 110, width: 140 }
    ];
    
    // 绘制水平文字行
    for (const line of lines) {
        const startX = (width - line.width) / 2;
        for (let x = startX; x < startX + line.width; x++) {
            for (let dy = 0; dy < 8; dy++) { // 文字行高度8像素
                const y = line.y + dy;
                if (y >= 0 && y < height && x >= 0 && x < width) {
                    setPixel(image, Math.floor(x), y, 0, 0, 0);
                }
            }
        }
    }
    
    return image;
}

/**
 * 演示主函数
 */
function demo() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          07. 倾斜校正 (Deskewing) - Node.js 演示           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 1. 创建测试图像
    console.log('【步骤1】创建测试图像');
    const original = createTestImage();
    console.log(`创建了 ${original.width}×${original.height} 的测试图像（模拟文档）\n`);
    
    // 2. 模拟倾斜
    const skewAngle = 5; // 5度倾斜
    console.log(`【步骤2】模拟 ${skewAngle}° 倾斜`);
    const skewed = rotateImage(original, skewAngle);
    console.log('图像已旋转，模拟倾斜效果\n');
    
    // 3. 计算原始图像的投影方差
    console.log('【步骤3】分析原始图像的水平投影');
    const originalProjection = calculateHorizontalProjection(original);
    const originalVariance = calculateProjectionVariance(originalProjection);
    console.log(`原始图像投影方差: ${originalVariance.toFixed(2)}`);
    
    // 4. 计算倾斜图像的投影方差
    console.log('\n【步骤4】分析倾斜图像的水平投影');
    const skewedProjection = calculateHorizontalProjection(skewed);
    const skewedVariance = calculateProjectionVariance(skewedProjection);
    console.log(`倾斜图像投影方差: ${skewedVariance.toFixed(2)}`);
    console.log(`方差变化: ${((skewedVariance / originalVariance) * 100).toFixed(1)}%`);
    console.log('（方差减小说明峰谷变模糊，这是倾斜的特征）\n');
    
    // 5. 检测倾斜角度
    console.log('【步骤5】使用投影分析法检测倾斜角度');
    const detection = detectSkewAngleByProjection(skewed, {
        minAngle: -10,
        maxAngle: 10,
        step: 1,
        refine: true,
        refineStep: 0.1
    });
    console.log(`\n检测校正角: ${detection.angle.toFixed(2)}°`);
    console.log(`实际倾斜: ${skewAngle}°`);
    console.log(`误差: ${Math.abs(detection.angle + skewAngle).toFixed(2)}°\n`);
    
    // 6. 执行倾斜校正
    console.log('【步骤6】执行倾斜校正');
    const corrected = deskew(skewed, {
        method: 'projection',
        interpolation: 'bilinear',
        minAngle: -10,
        maxAngle: 10,
        step: 1,
        refine: true
    });
    
    // 7. 验证校正效果
    console.log('【步骤7】验证校正效果');
    const correctedProjection = calculateHorizontalProjection(corrected.imageData);
    const correctedVariance = calculateProjectionVariance(correctedProjection);
    console.log(`校正后投影方差: ${correctedVariance.toFixed(2)}`);
    console.log(`相比倾斜图像改善: ${((correctedVariance / skewedVariance - 1) * 100).toFixed(1)}%\n`);
    
    // 8. 演示插值方法对比
    console.log('【步骤8】插值方法对比');
    console.log('最近邻插值：速度快，但有锯齿');
    console.log('双线性插值：结果平滑，会引入灰度，后续可再二值化');
    
    const startNearest = Date.now();
    rotateImage(skewed, 5, 'nearest');
    const timeNearest = Date.now() - startNearest;
    
    const startBilinear = Date.now();
    rotateImage(skewed, 5, 'bilinear');
    const timeBilinear = Date.now() - startBilinear;
    
    console.log(`最近邻插值耗时: ${timeNearest}ms`);
    console.log(`双线性插值耗时: ${timeBilinear}ms\n`);
    
    console.log('【步骤9】霍夫投票对照');
    const hough = houghTransform(skewed);
    const sums = [80, 90, 100].map(i => hough.accumulator[i].reduce((a,b) => a+b,0));
    console.log('theta=80/90/100°的总票数（应相同，不能据此判方向）：', sums);
    const byHough = detectSkewAngleByHough(skewed, {minAngle:-10,maxAngle:10});
    console.log('霍夫峰值法：', {correctionAngle:byHough.angle,skewAngle:byHough.skewAngle,normalAngle:byHough.detectedTheta,peak:byHough.peak});
    console.log('双线性算例Q=[0,100;200,240],u=.25,v=.5 → 118；边界按常量背景采样。');
    const onePixel = createImageData(1,1,0,0,0);
    console.log('【步骤10】1×1黑图零角旋转仍为黑色：', getPixel(rotateImage(onePixel,0),0,0).r);

    // 11. 总结
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                        算法总结                             ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 1. 投影分析法：适合规整文档，计算简单，精度高               ║');
    console.log('║ 2. 霍夫变换：适合有明显直线特征的图像，较复杂               ║');
    console.log('║ 3. 图像旋转：使用逆变换；双线性更平滑，最近邻保二值               ║');
    console.log('║ 4. OCR预处理：倾斜校正是提高识别率的重要步骤               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
}

// 运行演示
if (require.main === module) demo();

// 导出函数供其他模块使用
module.exports = {
    calculateHorizontalProjection,
    calculateProjectionVariance,
    detectSkewAngleByProjection,
    rotateImage,
    bilinearInterpolate,
    houghTransform,
    detectSkewAngleByHough,
    deskew
};

