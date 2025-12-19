/**
 * 像素访问模块
 * 
 * 提供图像像素的读取和设置功能
 * 
 * 来源：01. 数字图像基础（索引计算）
 *       02. JavaScript 图像处理基础（函数封装）
 */

/**
 * 获取指定位置的像素值
 * 
 * 原理说明：
 * - 使用公式 index = (y * width + x) * 4 计算一维数组索引
 * - 返回 RGBA 对象
 * - 边界外返回黑色透明像素
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @returns {{r: number, g: number, b: number, a: number}} RGBA 值
 */
function getPixel(imageData, x, y) {
    // 边界检查
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return { r: 0, g: 0, b: 0, a: 0 };
    }
    
    // 计算一维数组索引
    const index = (y * imageData.width + x) * 4;
    
    return {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2],
        a: imageData.data[index + 3]
    };
}

/**
 * 设置指定位置的像素值
 * 
 * 原理说明：
 * - 使用相同的索引计算公式
 * - Uint8ClampedArray 会自动将值限制在 0-255
 * - 边界外的设置会被忽略
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @param {number} [a=255] - 透明度 (0-255)
 */
function setPixel(imageData, x, y, r, g, b, a = 255) {
    // 边界检查
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) {
        return;
    }
    
    const index = (y * imageData.width + x) * 4;
    
    // Uint8ClampedArray 会自动将值限制在 0-255
    imageData.data[index] = r;
    imageData.data[index + 1] = g;
    imageData.data[index + 2] = b;
    imageData.data[index + 3] = a;
}

/**
 * 获取指定位置的灰度值
 * 
 * 原理说明：
 * - 使用加权公式将 RGB 转换为灰度值
 * - Gray = 0.299R + 0.587G + 0.114B
 * - 权重基于人眼对不同颜色的敏感度（ITU-R BT.601 标准）
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @returns {number} 灰度值 (0-255)
 */
function getGray(imageData, x, y) {
    const pixel = getPixel(imageData, x, y);
    return Math.round(0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b);
}

module.exports = {
    getPixel,
    setPixel,
    getGray
};
