/**
 * 形态学操作模块
 * 
 * 提供基于结构元素的形态学变换
 * 
 * 来源：06. 形态学操作
 */

const { createImageData } = require('../core/imageData');
const { getPixel, setPixel } = require('../core/pixelAccess');
const { clamp } = require('../core/utils');

/**
 * 创建结构元素
 * 
 * 原理说明：
 * - 结构元素是形态学操作的"模板"
 * - 定义了操作的形状和大小
 * - 1表示有效区域，0表示忽略
 * - 不同形状适合不同场景
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

/**
 * 开运算 (Opening)
 * 
 * 原理说明：
 * - 先腐蚀，后膨胀
 * - 效果：去除小于结构元素的噪点，同时保持主体形状
 * - 适合去除小的白色噪点
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
 * - 适合填补小的黑色空洞
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
 * - 边缘宽度由结构元素大小决定
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
 * - 常用于不均匀光照校正
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
 * - 常用于检测暗色缺陷
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
