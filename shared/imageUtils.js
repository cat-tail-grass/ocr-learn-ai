/**
 * 共享图像处理工具模块 - 兼容层
 * 
 * 本文件保持向后兼容性，重新导出所有模块。
 * 
 * 使用方式（向后兼容）：
 * const { getPixel, setPixel, ... } = require('../shared/imageUtils');
 * 
 * 推荐使用新方式（按模块导入）：
 * const { getPixel, setPixel } = require('../shared/core');
 * const { grayscaleWeighted } = require('../shared/03-grayscale');
 * 
 * 或使用统一入口：
 * const { getPixel, grayscaleWeighted } = require('../shared');
 */

module.exports = require('./index');
