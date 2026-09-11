/**
 * 核心模块统一导出
 * 
 * 包含图像处理的基础功能：
 * - MockImageData: 模拟浏览器 ImageData 类
 * - 像素访问: getPixel, setPixel, getGray
 * - 图像数据操作: cloneImageData, createImageData
 * - 像素遍历: forEachPixel, forEachPixelXY
 * - 颜色转换: rgbToHex, hexToRgb, rgbToGray, rgbToHsv
 * - 工具函数: clamp, lerp
 * 
 * 来源：01-02. 数字图像基础 / JavaScript 图像处理基础
 */

const { MockImageData } = require('./MockImageData');
const { getPixel, setPixel, getGray } = require('./pixelAccess');
const { cloneImageData, createImageData } = require('./imageData');
const { forEachPixel, forEachPixelXY } = require('./pixelIterator');
const { rgbToHex, hexToRgb, rgbToGray, rgbToHsv } = require('./colorConversion');
const { clamp, lerp, createSeededRandom } = require('./utils');

module.exports = {
    // 类
    MockImageData,
    
    // 像素访问
    getPixel,
    setPixel,
    getGray,
    
    // 图像数据操作
    cloneImageData,
    createImageData,
    
    // 像素遍历
    forEachPixel,
    forEachPixelXY,
    
    // 颜色转换
    rgbToHex,
    hexToRgb,
    rgbToGray,
    rgbToHsv,
    
    // 工具函数
    clamp,
    lerp,
    createSeededRandom
};
