/**
 * 模拟 ImageData 类模块
 * 
 * 提供 8-bit RGBA 数据容器；并非浏览器 ImageData 的完整实现
 * 
 * 来源：02. JavaScript 图像处理基础
 */

/**
 * 模拟浏览器的 ImageData 类
 * 
 * 原理说明：
 * - 真正的 ImageData 是浏览器 API
 * - 这里模拟其结构以便在 Node.js 环境中使用
 * - 包含 width, height, data 三个属性
 * - data 是 Uint8ClampedArray，存储 RGBA 像素值
 * 
 * @class
 */
class MockImageData {
    /**
     * 创建 ImageData 对象
     * 
     * 支持两种创建方式：
     * 1. new MockImageData(width, height) - 创建空白图像
     * 2. new MockImageData(data, width, height) - 从现有数据创建
     * 
     * @param {number|Uint8ClampedArray} widthOrData - 宽度或数据数组
     * @param {number} height - 高度（或当第一个参数是数据时为宽度）
     * @param {number} [width] - 当第一个参数是数据时，需要提供高度
     */
    constructor(widthOrData, height, width) {
        if (widthOrData instanceof Uint8ClampedArray) {
            // 从现有数据创建
            this.data = widthOrData;
            this.width = height;
            this.height = width;
        } else {
            // 创建空白图像
            this.width = widthOrData;
            this.height = height;
            this.data = new Uint8ClampedArray(widthOrData * height * 4);
            
            // 课程约定填充白色不透明；原生 new ImageData(w,h) 则是透明黑
            for (let i = 0; i < this.data.length; i += 4) {
                this.data[i] = 255;     // R
                this.data[i + 1] = 255; // G
                this.data[i + 2] = 255; // B
                this.data[i + 3] = 255; // A
            }
        }
    }
}

module.exports = {
    MockImageData
};
