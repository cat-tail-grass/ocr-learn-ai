/**
 * 像素遍历模块
 * 
 * 提供图像像素的遍历和批量处理功能
 * 
 * 来源：02. JavaScript 图像处理基础
 */

const { cloneImageData } = require('./imageData');

/**
 * 遍历图像的所有像素（按索引方式）
 * 
 * 原理说明：
 * - 提供统一的像素遍历接口
 * - 回调函数接收像素信息和索引
 * - 返回新的像素值即可修改
 * - 不返回值则保持原像素不变
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {Function} callback - 回调函数 (pixel, index) => newPixel | undefined
 * @returns {MockImageData} 处理后的图像数据
 */
function forEachPixel(imageData, callback) {
    const result = cloneImageData(imageData);
    const data = result.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const pixel = {
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
            a: data[i + 3]
        };
        
        const newPixel = callback(pixel, i);
        
        if (newPixel) {
            data[i] = newPixel.r !== undefined ? newPixel.r : pixel.r;
            data[i + 1] = newPixel.g !== undefined ? newPixel.g : pixel.g;
            data[i + 2] = newPixel.b !== undefined ? newPixel.b : pixel.b;
            data[i + 3] = newPixel.a !== undefined ? newPixel.a : pixel.a;
        }
    }
    
    return result;
}

/**
 * 遍历图像的所有像素（按坐标方式）
 * 
 * 原理说明：
 * - 使用双层循环遍历
 * - 回调函数接收像素信息、坐标和索引
 * - 适合需要坐标信息的操作（如滤波、形态学等）
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {Function} callback - 回调函数 (pixel, x, y, index) => newPixel | undefined
 * @returns {MockImageData} 处理后的图像数据
 */
function forEachPixelXY(imageData, callback) {
    const result = cloneImageData(imageData);
    const { width, height, data } = result;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const pixel = {
                r: data[index],
                g: data[index + 1],
                b: data[index + 2],
                a: data[index + 3]
            };
            
            const newPixel = callback(pixel, x, y, index);
            
            if (newPixel) {
                data[index] = newPixel.r !== undefined ? newPixel.r : pixel.r;
                data[index + 1] = newPixel.g !== undefined ? newPixel.g : pixel.g;
                data[index + 2] = newPixel.b !== undefined ? newPixel.b : pixel.b;
                data[index + 3] = newPixel.a !== undefined ? newPixel.a : pixel.a;
            }
        }
    }
    
    return result;
}

module.exports = {
    forEachPixel,
    forEachPixelXY
};
