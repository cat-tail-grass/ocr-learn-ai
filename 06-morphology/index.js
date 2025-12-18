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

// 引入共享工具模块
const {
    MockImageData,
    getPixel,
    setPixel,
    cloneImageData,
    createImageData,
    clamp,
    binarizeFixed,
    grayscaleWeighted
} = require('../shared/imageUtils');

// ==================== 结构元素 ====================

/**
 * 创建结构元素
 * 
 * 原理说明：
 * - 结构元素是形态学操作的"模板"
 * - 定义了操作的形状和大小
 * - 1表示有效区域，0表示忽略
 * 
 * @param {string} shape - 形状类型：'rect'（矩形）、'cross'（十字）、'ellipse'（椭圆）
 * @param {number} size - 结构元素大小（奇数）
 * @returns {number[][]} 二维数组表示的结构元素
 */
function createStructuringElement(shape, size) {
    // 确保是奇数
    if (size % 2 === 0) size = size + 1;
    
    const element = [];
    const center = Math.floor(size / 2);
    
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            let value = 0;
            
            if (shape === 'rect') {
                // 矩形：所有位置都是1
                value = 1;
            } else if (shape === 'cross') {
                // 十字形：只有中心行和中心列是1
                if (x === center || y === center) {
                    value = 1;
                }
            } else if (shape === 'ellipse') {
                // 椭圆形：使用椭圆方程判断
                const dx = x - center;
                const dy = y - center;
                const radius = center + 0.5; // 半径略大于center，使边缘更圆滑
                if (dx * dx + dy * dy <= radius * radius) {
                    value = 1;
                }
            }
            
            row.push(value);
        }
        element.push(row);
    }
    
    return element;
}

/**
 * 打印结构元素（可视化）
 * 
 * @param {number[][]} element - 结构元素
 * @param {string} name - 名称
 */
function printStructuringElement(element, name) {
    console.log(`\n${name} (${element.length}×${element[0].length}):`);
    console.log('┌' + '─'.repeat(element[0].length * 2 + 1) + '┐');
    for (const row of element) {
        console.log('│ ' + row.map(v => v ? '■' : '□').join('') + ' │');
    }
    console.log('└' + '─'.repeat(element[0].length * 2 + 1) + '┘');
}

// ==================== 腐蚀操作 ====================

/**
 * 腐蚀操作 (Erosion)
 * 
 * 原理说明：
 * - 只有当结构元素完全匹配前景时，中心像素才保留为前景
 * - 使用 AND 逻辑：所有对应位置都必须是前景
 * - 效果：缩小前景区域，去除小噪点
 * 
 * 数学表达式：
 * Erosion(A, B) = { z | (B)z ⊆ A }
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number[][]} structuringElement - 结构元素
 * @returns {MockImageData} 腐蚀后的图像数据
 */
function erode(imageData, structuringElement) {
    const { width, height } = imageData;
    const result = createImageData(width, height, 0, 0, 0); // 初始化为黑色
    
    const seSize = structuringElement.length;
    const seCenter = Math.floor(seSize / 2);
    
    // Step 1: 遍历图像每个像素
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let fits = true; // 假设结构元素完全匹配
            
            // Step 2: 检查结构元素覆盖的所有位置
            for (let sy = 0; sy < seSize && fits; sy++) {
                for (let sx = 0; sx < seSize && fits; sx++) {
                    // 只检查结构元素中值为1的位置
                    if (structuringElement[sy][sx] === 1) {
                        // 计算图像中对应的位置
                        const imgX = x + sx - seCenter;
                        const imgY = y + sy - seCenter;
                        
                        // 获取像素值（边界外视为背景/黑色）
                        const pixel = getPixel(imageData, imgX, imgY);
                        
                        // 如果任何一个位置不是前景（不是白色），则不匹配
                        if (pixel.r < 128) { // 假设 < 128 是背景
                            fits = false;
                        }
                    }
                }
            }
            
            // Step 3: 如果完全匹配，中心像素设为前景（白色）
            if (fits) {
                setPixel(result, x, y, 255, 255, 255);
            }
        }
    }
    
    return result;
}

// ==================== 膨胀操作 ====================

/**
 * 膨胀操作 (Dilation)
 * 
 * 原理说明：
 * - 只要结构元素有任意部分与前景重叠，中心像素就变为前景
 * - 使用 OR 逻辑：只要有一个位置是前景
 * - 效果：扩大前景区域，填补空洞
 * 
 * 数学表达式：
 * Dilation(A, B) = { z | (B̂)z ∩ A ≠ ∅ }
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number[][]} structuringElement - 结构元素
 * @returns {MockImageData} 膨胀后的图像数据
 */
function dilate(imageData, structuringElement) {
    const { width, height } = imageData;
    const result = createImageData(width, height, 0, 0, 0); // 初始化为黑色
    
    const seSize = structuringElement.length;
    const seCenter = Math.floor(seSize / 2);
    
    // Step 1: 遍历图像每个像素
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let hits = false; // 假设没有任何重叠
            
            // Step 2: 检查结构元素覆盖的所有位置
            for (let sy = 0; sy < seSize && !hits; sy++) {
                for (let sx = 0; sx < seSize && !hits; sx++) {
                    // 只检查结构元素中值为1的位置
                    if (structuringElement[sy][sx] === 1) {
                        // 计算图像中对应的位置
                        const imgX = x + sx - seCenter;
                        const imgY = y + sy - seCenter;
                        
                        // 获取像素值
                        const pixel = getPixel(imageData, imgX, imgY);
                        
                        // 如果任何一个位置是前景（白色），则有重叠
                        if (pixel.r >= 128) { // 假设 >= 128 是前景
                            hits = true;
                        }
                    }
                }
            }
            
            // Step 3: 如果有任何重叠，中心像素设为前景（白色）
            if (hits) {
                setPixel(result, x, y, 255, 255, 255);
            }
        }
    }
    
    return result;
}

// ==================== 复合操作 ====================

/**
 * 开运算 (Opening)
 * 
 * 原理说明：
 * - 先腐蚀，后膨胀
 * - 效果：去除小于结构元素的噪点，同时保持主体形状
 * 
 * 公式：Opening(A, B) = Dilation(Erosion(A, B), B)
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number[][]} structuringElement - 结构元素
 * @returns {MockImageData} 开运算后的图像数据
 */
function morphOpen(imageData, structuringElement) {
    // Step 1: 先腐蚀 - 去除小噪点
    const eroded = erode(imageData, structuringElement);
    
    // Step 2: 后膨胀 - 恢复主体形状
    const opened = dilate(eroded, structuringElement);
    
    return opened;
}

/**
 * 闭运算 (Closing)
 * 
 * 原理说明：
 * - 先膨胀，后腐蚀
 * - 效果：填补小于结构元素的空洞，同时保持主体形状
 * 
 * 公式：Closing(A, B) = Erosion(Dilation(A, B), B)
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number[][]} structuringElement - 结构元素
 * @returns {MockImageData} 闭运算后的图像数据
 */
function morphClose(imageData, structuringElement) {
    // Step 1: 先膨胀 - 填补空洞
    const dilated = dilate(imageData, structuringElement);
    
    // Step 2: 后腐蚀 - 恢复主体形状
    const closed = erode(dilated, structuringElement);
    
    return closed;
}

/**
 * 形态学梯度 (Morphological Gradient)
 * 
 * 原理说明：
 * - 膨胀结果减去腐蚀结果
 * - 效果：提取前景的边缘轮廓
 * 
 * 公式：Gradient(A, B) = Dilation(A, B) - Erosion(A, B)
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number[][]} structuringElement - 结构元素
 * @returns {MockImageData} 形态学梯度图像
 */
function morphGradient(imageData, structuringElement) {
    const { width, height } = imageData;
    
    // Step 1: 计算膨胀
    const dilated = dilate(imageData, structuringElement);
    
    // Step 2: 计算腐蚀
    const eroded = erode(imageData, structuringElement);
    
    // Step 3: 相减得到梯度
    const result = createImageData(width, height, 0, 0, 0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dilatedPixel = getPixel(dilated, x, y);
            const erodedPixel = getPixel(eroded, x, y);
            
            const gradValue = clamp(dilatedPixel.r - erodedPixel.r, 0, 255);
            setPixel(result, x, y, gradValue, gradValue, gradValue);
        }
    }
    
    return result;
}

/**
 * 顶帽变换 (Top-Hat)
 * 
 * 原理说明：
 * - 原图减去开运算结果
 * - 效果：提取比周围亮的细节（亮点、细纹）
 * 
 * 公式：TopHat(A, B) = A - Opening(A, B)
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number[][]} structuringElement - 结构元素
 * @returns {MockImageData} 顶帽变换结果
 */
function topHat(imageData, structuringElement) {
    const { width, height } = imageData;
    
    // Step 1: 计算开运算
    const opened = morphOpen(imageData, structuringElement);
    
    // Step 2: 原图减去开运算结果
    const result = createImageData(width, height, 0, 0, 0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const originalPixel = getPixel(imageData, x, y);
            const openedPixel = getPixel(opened, x, y);
            
            const value = clamp(originalPixel.r - openedPixel.r, 0, 255);
            setPixel(result, x, y, value, value, value);
        }
    }
    
    return result;
}

/**
 * 黑帽变换 (Black-Hat)
 * 
 * 原理说明：
 * - 闭运算结果减去原图
 * - 效果：提取比周围暗的细节（暗点、裂缝）
 * 
 * 公式：BlackHat(A, B) = Closing(A, B) - A
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number[][]} structuringElement - 结构元素
 * @returns {MockImageData} 黑帽变换结果
 */
function blackHat(imageData, structuringElement) {
    const { width, height } = imageData;
    
    // Step 1: 计算闭运算
    const closed = morphClose(imageData, structuringElement);
    
    // Step 2: 闭运算结果减去原图
    const result = createImageData(width, height, 0, 0, 0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const closedPixel = getPixel(closed, x, y);
            const originalPixel = getPixel(imageData, x, y);
            
            const value = clamp(closedPixel.r - originalPixel.r, 0, 255);
            setPixel(result, x, y, value, value, value);
        }
    }
    
    return result;
}

// ==================== 辅助函数 ====================

/**
 * 创建测试用的二值图像
 * 
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @returns {MockImageData} 测试图像
 */
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
    
    // 10. 总结
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
main();

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
