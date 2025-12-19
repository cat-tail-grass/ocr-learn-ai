/**
 * 图像数据操作模块
 * 
 * 提供图像数据的创建和克隆功能
 * 
 * 来源：02. JavaScript 图像处理基础
 */

const { MockImageData } = require('./MockImageData');

/**
 * 克隆 ImageData 对象
 * 
 * 原理说明：
 * - 创建数据的深拷贝
 * - 避免修改原始图像
 * - 新图像与原图像完全独立
 * 
 * @param {ImageData|MockImageData} imageData - 要克隆的图像数据
 * @returns {MockImageData} 克隆的副本
 */
function cloneImageData(imageData) {
    return new MockImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
    );
}

/**
 * 创建指定尺寸的空白图像数据
 * 
 * 原理说明：
 * - 创建新的 ImageData 对象
 * - 可指定默认填充颜色
 * - 默认为白色不透明
 * 
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number} [r=255] - 默认红色值
 * @param {number} [g=255] - 默认绿色值
 * @param {number} [b=255] - 默认蓝色值
 * @param {number} [a=255] - 默认透明度
 * @returns {MockImageData} 新的图像数据
 */
function createImageData(width, height, r = 255, g = 255, b = 255, a = 255) {
    const imageData = new MockImageData(width, height);
    
    // 填充指定颜色
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
        imageData.data[i + 3] = a;
    }
    
    return imageData;
}

module.exports = {
    cloneImageData,
    createImageData
};
