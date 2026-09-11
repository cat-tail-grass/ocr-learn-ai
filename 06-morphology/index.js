/**
 * 06. 形态学操作 (Morphological Operations)
 * 
 * 本文件演示形态学操作的核心概念和实现：
 * - 结构元素的创建
 * - 腐蚀（Erosion）
 * - 膨胀（Dilation）
 * - 开运算（Opening）
 * - 闭运算（Closing）
 * - 形态学梯度（Gradient）
 * - 顶帽与黑帽变换
 * 
 * 运行方式: node index.js
 * 
 * 前置知识：
 * - 05. 图像去噪（卷积操作）
 * - 04. 二值化（二值图像）
 */

// 核心算法与HTML共用shared实现；下文保留可直接运行的逐步实验。
const { createImageData, cloneImageData } = require('../shared/core/imageData');
const { getPixel, setPixel } = require('../shared/core/pixelAccess');
const { createStructuringElement, erode, dilate, morphOpen, morphClose, morphGradient, topHat, blackHat } = require('../shared/06-morphology');

function printStructuringElement(element, name) {
    console.log(`\n${name} (${element.length}×${element[0].length}):`);
    console.log('┌' + '─'.repeat(element[0].length * 2 + 1) + '┐');
    for (const row of element) {
        console.log('│ ' + row.map(v => v ? '■' : '□').join('') + ' │');
    }
    console.log('└' + '─'.repeat(element[0].length * 2 + 1) + '┘');
}

function createTestImage(width, height) {
    // 创建黑色背景
    const imageData = createImageData(width, height, 0, 0, 0);
    
    // 绘制一个白色矩形（主体）
    for (let y = 4; y < height - 4; y++) {
        for (let x = 4; x < width - 4; x++) {
            setPixel(imageData, x, y, 255, 255, 255);
        }
    }
    
    // 在主体内添加一个小空洞
    setPixel(imageData, 7, 7, 0, 0, 0);
    setPixel(imageData, 8, 7, 0, 0, 0);
    setPixel(imageData, 7, 8, 0, 0, 0);
    
    // 在主体外添加一些噪点
    setPixel(imageData, 1, 1, 255, 255, 255);
    setPixel(imageData, 2, 2, 255, 255, 255);
    setPixel(imageData, width - 2, height - 2, 255, 255, 255);
    
    return imageData;
}

/**
 * 打印图像（可视化）
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {string} title - 标题
 */
function printImage(imageData, title) {
    const { width, height } = imageData;
    
    console.log(`\n${title} (${width}×${height}):`);
    console.log('┌' + '─'.repeat(width) + '┐');
    
    for (let y = 0; y < height; y++) {
        let row = '│';
        for (let x = 0; x < width; x++) {
            const pixel = getPixel(imageData, x, y);
            // 白色用 ■ 表示，黑色用空格表示
            row += pixel.r >= 128 ? '█' : ' ';
        }
        row += '│';
        console.log(row);
    }
    
    console.log('└' + '─'.repeat(width) + '┘');
}

/**
 * 统计图像中的前景像素数
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @returns {number} 前景像素数
 */
function countForegroundPixels(imageData) {
    let count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i] >= 128) count++;
    }
    return count;
}

// ==================== 演示程序 ====================

function main() {
    console.log('='.repeat(60));
    console.log('         06. 形态学操作 (Morphological Operations)');
    console.log('='.repeat(60));
    
    // 1. 演示结构元素
    console.log('\n' + '─'.repeat(60));
    console.log('【1. 结构元素 (Structuring Element)】');
    console.log('─'.repeat(60));
    console.log('结构元素是形态学操作的"模板"，定义了操作的形状');
    
    const rectSE = createStructuringElement('rect', 3);
    const crossSE = createStructuringElement('cross', 3);
    const ellipseSE = createStructuringElement('ellipse', 5);
    
    printStructuringElement(rectSE, '矩形结构元素 (3×3)');
    printStructuringElement(crossSE, '十字形结构元素 (3×3)');
    printStructuringElement(ellipseSE, '椭圆形结构元素 (5×5)');
    
    // 2. 创建测试图像
    console.log('\n' + '─'.repeat(60));
    console.log('【2. 测试图像】');
    console.log('─'.repeat(60));
    console.log('创建一个带有噪点和空洞的测试图像');
    
    const testImage = createTestImage(15, 15);
    printImage(testImage, '原始测试图像');
    console.log(`前景像素数: ${countForegroundPixels(testImage)}`);
    
    // 3. 腐蚀操作
    console.log('\n' + '─'.repeat(60));
    console.log('【3. 腐蚀操作 (Erosion)】');
    console.log('─'.repeat(60));
    console.log('效果：缩小前景区域，只保留完全匹配的部分');
    console.log('应用：去除小噪点，分离粘连区域');
    
    const erodedImage = erode(testImage, rectSE);
    printImage(erodedImage, '腐蚀后');
    console.log(`前景像素数: ${countForegroundPixels(erodedImage)} (原: ${countForegroundPixels(testImage)})`);
    console.log('→ 边缘被侵蚀，噪点消失');
    
    // 4. 膨胀操作
    console.log('\n' + '─'.repeat(60));
    console.log('【4. 膨胀操作 (Dilation)】');
    console.log('─'.repeat(60));
    console.log('效果：扩大前景区域，只要有任意重叠就扩展');
    console.log('应用：填补空洞，连接断裂区域');
    
    const dilatedImage = dilate(testImage, rectSE);
    printImage(dilatedImage, '膨胀后');
    console.log(`前景像素数: ${countForegroundPixels(dilatedImage)} (原: ${countForegroundPixels(testImage)})`);
    console.log('→ 区域扩张，噪点也变大了');
    
    // 5. 开运算
    console.log('\n' + '─'.repeat(60));
    console.log('【5. 开运算 (Opening) = 先腐蚀后膨胀】');
    console.log('─'.repeat(60));
    console.log('效果：去除小噪点，同时保持主体形状');
    console.log('应用：OCR预处理中去除背景噪点');
    
    const openedImage = morphOpen(testImage, rectSE);
    printImage(openedImage, '开运算后');
    console.log(`前景像素数: ${countForegroundPixels(openedImage)} (原: ${countForegroundPixels(testImage)})`);
    console.log('→ 噪点被去除，主体形状基本保持');
    
    // 6. 闭运算
    console.log('\n' + '─'.repeat(60));
    console.log('【6. 闭运算 (Closing) = 先膨胀后腐蚀】');
    console.log('─'.repeat(60));
    console.log('效果：填补小空洞，同时保持主体形状');
    console.log('应用：OCR预处理中连接断裂的笔画');
    
    const closedImage = morphClose(testImage, rectSE);
    printImage(closedImage, '闭运算后');
    console.log(`前景像素数: ${countForegroundPixels(closedImage)} (原: ${countForegroundPixels(testImage)})`);
    console.log('→ 空洞被填补，主体形状基本保持');
    
    // 7. 形态学梯度
    console.log('\n' + '─'.repeat(60));
    console.log('【7. 形态学梯度 (Gradient) = 膨胀 - 腐蚀】');
    console.log('─'.repeat(60));
    console.log('效果：提取边缘轮廓');
    console.log('应用：文字边缘提取');
    
    const gradientImage = morphGradient(testImage, rectSE);
    printImage(gradientImage, '形态学梯度');
    console.log('→ 只保留边缘轮廓');
    
    // 8. 组合应用示例
    console.log('\n' + '─'.repeat(60));
    console.log('【8. 组合应用：先开运算去噪，再闭运算填洞】');
    console.log('─'.repeat(60));
    console.log('这是OCR预处理中常用的组合操作');
    
    const step1 = morphOpen(testImage, rectSE);
    const step2 = morphClose(step1, rectSE);
    
    printImage(testImage, '原图');
    printImage(step1, 'Step 1: 开运算后');
    printImage(step2, 'Step 2: 闭运算后');
    console.log('→ 既去除了噪点，又填补了空洞');
    
    // 9. 结构元素大小的影响
    console.log('\n' + '─'.repeat(60));
    console.log('【9. 结构元素大小的影响】');
    console.log('─'.repeat(60));
    console.log('结构元素越大，效果越强，但可能损失细节');
    
    const se3 = createStructuringElement('rect', 3);
    const se5 = createStructuringElement('rect', 5);
    
    const eroded3 = erode(testImage, se3);
    const eroded5 = erode(testImage, se5);
    
    printImage(testImage, '原图');
    printImage(eroded3, '3×3 腐蚀');
    printImage(eroded5, '5×5 腐蚀');
    console.log('→ 5×5 腐蚀效果更强，区域缩小更多');
    
    // 10. 黑字极性与帽变换的亮度定义
    console.log('【10. 黑字极性：5×5内单黑点，3×3结构元素】');
    const blackDot = createImageData(5, 5, 255, 255, 255);
    setPixel(blackDot, 2, 2, 0, 0, 0);
    const blackCount = image => image.width * image.height - countForegroundPixels(image);
    console.log('黑前景腐蚀/膨胀像素数：', blackCount(erode(blackDot, rectSE, {foreground: 'black'})), blackCount(dilate(blackDot, rectSE, {foreground: 'black'})));
    console.log('黑帽白色残差像素数（暗细节）：', countForegroundPixels(blackHat(blackDot, rectSE)));
    const whiteDot = createImageData(5, 5, 0, 0, 0);
    setPixel(whiteDot, 2, 2, 255, 255, 255);
    console.log('白顶帽白色残差像素数（亮细节）：', countForegroundPixels(topHat(whiteDot, rectSE)));
    const rightSE = [[0,0,0],[0,1,1],[0,0,0]];
    printImage(dilate(whiteDot, rightSE), '非对称B={(0,0),(1,0)}：向右扩张');
    console.log('帽变换固定按亮度定义；本章是二值残差，未实现灰度光照校正。');

    // 11. 总结
    console.log('\n' + '='.repeat(60));
    console.log('形态学操作总结');
    console.log('='.repeat(60));
    console.log(`
┌────────────────┬─────────────────────────────────────┐
│ 操作           │ 效果                                │
├────────────────┼─────────────────────────────────────┤
│ 腐蚀 (Erosion) │ 缩小前景，去除噪点，分离粘连        │
│ 膨胀 (Dilation)│ 扩大前景，填补空洞，连接断裂        │
│ 开运算 (Open)  │ 先腐蚀后膨胀，去噪保形              │
│ 闭运算 (Close) │ 先膨胀后腐蚀，填洞保形              │
│ 梯度 (Gradient)│ 膨胀-腐蚀，提取边缘                 │
└────────────────┴─────────────────────────────────────┘

OCR 预处理建议：
1. 如果有小噪点 → 开运算
2. 如果笔画断裂 → 闭运算
3. 如果需要分离粘连字符 → 腐蚀
4. 如果需要提取轮廓 → 形态学梯度

可复用模块（已添加到 shared/imageUtils.js）：
- createStructuringElement(shape, size) - 创建结构元素
- erode(imageData, structuringElement) - 腐蚀
- dilate(imageData, structuringElement) - 膨胀
- morphOpen(imageData, structuringElement) - 开运算
- morphClose(imageData, structuringElement) - 闭运算
- morphGradient(imageData, structuringElement) - 形态学梯度
- topHat(imageData, structuringElement) - 顶帽变换
- blackHat(imageData, structuringElement) - 黑帽变换
`);
    
    console.log('\n下一步学习: 07. 倾斜校正 (Deskewing)');
    console.log('处理因拍摄角度导致的文字倾斜问题');
}

// 运行演示
if (require.main === module) main();

// 导出函数供其他模块使用
module.exports = {
    createStructuringElement,
    erode,
    dilate,
    morphOpen,
    morphClose,
    morphGradient,
    topHat,
    blackHat
};
