/**
 * 形态学操作模块
 * 
 * 二值形态学：默认白前景，可显式传{foreground: 'black'}操作黑字。
 * 图外背景；闭运算中间扩边；梯度/顶帽/黑帽输出白色残差。
 * topHat/blackHat按亮度定义，只支持二值残差，不是灰度光照校正器。
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
    if (!Number.isInteger(size) || size <= 0) throw new RangeError('结构元素大小必须为正整数');
    if (!['rect', 'cross', 'ellipse'].includes(shape)) throw new RangeError('未知结构元素形状');
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
                const radius = center; // 像素中心采样圆盘；3×3 时为十字形
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

// 结构元素为奇数高×奇数宽的0/1矩阵，中心锚点须属于B。
// 用中心偏移表示B：腐蚀查z+b，膨胀查z-b（反射B）。
function structuringOffsets(element) {
    const height = element.length;
    const width = element[0]?.length;
    if (!height || !width || height % 2 === 0 || width % 2 === 0 ||
        element.some(row => row.length !== width || row.some(v => v !== 0 && v !== 1)) ||
        element[Math.floor(height / 2)][Math.floor(width / 2)] !== 1) {
        throw new RangeError('结构元素必须为奇数高宽的0/1矩阵，且中心为1');
    }
    const offsets = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (element[y][x]) offsets.push([x - Math.floor(width / 2), y - Math.floor(height / 2)]);
        }
    }
    return offsets;
}

function foregroundColors(options = {}) {
    const foreground = options.foreground ?? 'white';
    if (foreground !== 'white' && foreground !== 'black') throw new RangeError('foreground须为white或black');
    return foreground === 'black' ? { fg: 0, bg: 255 } : { fg: 255, bg: 0 };
}

function binaryMorphology(imageData, element, options, erosion) {
    const { width, height } = imageData;
    const { fg, bg } = foregroundColors(options);
    const offsets = structuringOffsets(element);
    const result = createImageData(width, height, bg, bg, bg);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let selected = erosion;
            for (const [dx, dy] of offsets) {
                const sx = x + (erosion ? dx : -dx);
                const sy = y + (erosion ? dy : -dy);
                // 图像外始终是背景，不能让getPixel的黑色默认值冒充黑前景。
                const inside = sx >= 0 && sx < width && sy >= 0 && sy < height;
                const value = inside ? imageData.data[(sy * width + sx) * 4] : bg;
                const isForeground = inside && (fg === 0 ? value < 128 : value >= 128);
                if (erosion ? !isForeground : isForeground) {
                    selected = !erosion;
                    break;
                }
            }
            if (selected) setPixel(result, x, y, fg, fg, fg);
        }
    }
    return result;
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
function erode(imageData, structuringElement, options = {}) {
    return binaryMorphology(imageData, structuringElement, options, true);
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
function dilate(imageData, structuringElement, options = {}) {
    return binaryMorphology(imageData, structuringElement, options, false);
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
function morphOpen(imageData, structuringElement, options = {}) {
    return dilate(erode(imageData, structuringElement, options), structuringElement, options);
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
function morphClose(imageData, structuringElement, options = {}) {
    structuringOffsets(structuringElement);
    const { fg, bg } = foregroundColors(options);
    const px = Math.floor(structuringElement[0].length / 2);
    const py = Math.floor(structuringElement.length / 2);
    const { width, height } = imageData;
    // 先扩边再复合，保留第一步膨胀到原图外的像素，最后才裁剪。
    // 否则贴边物体会在第二步腐蚀时消失，违反A⊆A•B。
    const padded = createImageData(width + 2 * px, height + 2 * py, bg, bg, bg);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const value = imageData.data[(y * width + x) * 4];
            const binary = (fg === 0 ? value < 128 : value >= 128) ? fg : bg;
            setPixel(padded, x + px, y + py, binary, binary, binary);
        }
    }
    const closed = erode(dilate(padded, structuringElement, options), structuringElement, options);
    const result = createImageData(width, height, bg, bg, bg);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const value = getPixel(closed, x + px, y + py).r;
            setPixel(result, x, y, value, value, value);
        }
    }
    return result;
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
function morphGradient(imageData, structuringElement, options = {}) {
    const { width, height } = imageData;
    
    // Step 1: 计算膨胀
    const dilated = dilate(imageData, structuringElement, options);
    
    // Step 2: 计算腐蚀
    const eroded = erode(imageData, structuringElement, options);
    
    // Step 3: 相减得到梯度
    const result = createImageData(width, height, 0, 0, 0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dilatedPixel = getPixel(dilated, x, y);
            const erodedPixel = getPixel(eroded, x, y);
            
            const gradValue = Math.abs(dilatedPixel.r - erodedPixel.r);
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
 * - 灰度顶帽可用于光照校正；这里仅实现二值残差，不支持灰度光照估计
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
            
            const binaryValue = originalPixel.r >= 128 ? 255 : 0;
            const value = clamp(binaryValue - openedPixel.r, 0, 255);
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
            
            const binaryValue = originalPixel.r >= 128 ? 255 : 0;
            const value = clamp(closedPixel.r - binaryValue, 0, 255);
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
