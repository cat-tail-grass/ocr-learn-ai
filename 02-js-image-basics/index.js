/**
 * 02. JavaScript 图像处理基础 (Canvas API / ImageData Manipulation)
 * 
 * 本文件演示 Canvas API 的核心概念和用法，帮助你理解：
 * 1. Canvas 基本原理
 * 2. ImageData 数据结构
 * 3. 像素遍历方法
 * 4. 常用图像处理操作
 * 
 * 注意：由于 Node.js 没有原生 Canvas，本文件主要演示概念
 * 实际操作请使用浏览器环境运行 index.html
 * 
 * 前置知识：01. 数字图像基础（已完成 ✅）
 * 
 * 运行方式：node index.js
 */

// ==================== 模拟 ImageData 结构 ====================

/**
 * 模拟浏览器的 ImageData 类
 * 
 * 原理说明：
 * - 真正的 ImageData 是浏览器 API
 * - 这里模拟其结构以便理解
 * - 包含 width, height, data 三个属性
 * 
 * @class
 */
class MockImageData {
    /**
     * 创建 ImageData 对象
     * @param {number|Uint8ClampedArray} widthOrData - 宽度或数据数组
     * @param {number} height - 高度
     * @param {number} [width] - 当第一个参数是数据时，需要提供宽度
     */
    constructor(widthOrData, height, width) {
        if (widthOrData instanceof Uint8ClampedArray) {
            // 从现有数据创建
            this.data = widthOrData;
            this.width = height; // 第二个参数是宽度
            this.height = width; // 第三个参数是高度
        } else {
            // 创建空白图像
            this.width = widthOrData;
            this.height = height;
            this.data = new Uint8ClampedArray(widthOrData * height * 4);
            
            // 默认填充白色不透明
            for (let i = 0; i < this.data.length; i += 4) {
                this.data[i] = 255;     // R
                this.data[i + 1] = 255; // G
                this.data[i + 2] = 255; // B
                this.data[i + 3] = 255; // A
            }
        }
    }
}

// ==================== 核心工具函数 ====================

/**
 * 获取指定位置的像素值
 * 
 * 原理说明：
 * - 使用第01章学到的索引计算公式
 * - index = (y * width + x) * 4
 * 
 * 这个函数将被放入 shared/ 目录供后续章节使用
 * 
 * @param {MockImageData} imageData - 图像数据
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
 * @param {MockImageData} imageData - 图像数据
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
 * 克隆 ImageData 对象
 * 
 * 原理说明：
 * - 创建数据的深拷贝
 * - 避免修改原始图像
 * 
 * @param {MockImageData} imageData - 要克隆的图像数据
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
 * 遍历图像的所有像素
 * 
 * 原理说明：
 * - 提供统一的像素遍历接口
 * - 回调函数接收像素信息和坐标
 * 
 * @param {MockImageData} imageData - 图像数据
 * @param {Function} callback - 回调函数 (pixel, x, y, index) => newPixel
 * @returns {MockImageData} 处理后的图像数据
 */
function forEachPixel(imageData, callback) {
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
            
            // 调用回调函数
            const newPixel = callback(pixel, x, y, index);
            
            // 如果回调返回了新像素值，则更新
            if (newPixel) {
                data[index] = newPixel.r;
                data[index + 1] = newPixel.g;
                data[index + 2] = newPixel.b;
                data[index + 3] = newPixel.a !== undefined ? newPixel.a : pixel.a;
            }
        }
    }
    
    return result;
}

// ==================== 演示函数 ====================

/**
 * 演示 1：ImageData 结构
 */
function demonstrateImageData() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 演示 1：ImageData 数据结构');
    console.log('='.repeat(60));
    
    console.log(`
【ImageData 对象】

ImageData 是 Canvas API 中存储像素数据的核心对象。

属性：
┌───────────────┬────────────────────────────────────────┐
│ 属性          │ 说明                                   │
├───────────────┼────────────────────────────────────────┤
│ width         │ 图像宽度（像素）                       │
│ height        │ 图像高度（像素）                       │
│ data          │ Uint8ClampedArray，存储 RGBA 值        │
└───────────────┴────────────────────────────────────────┘

data 数组结构：
[R₀, G₀, B₀, A₀, R₁, G₁, B₁, A₁, R₂, G₂, B₂, A₂, ...]
 ←── 像素0 ──→   ←── 像素1 ──→   ←── 像素2 ──→

数组长度 = width × height × 4
`);
    
    // 创建示例
    const imageData = new MockImageData(4, 3);
    
    console.log('示例：创建一个 4×3 的图像');
    console.log(`  width: ${imageData.width}`);
    console.log(`  height: ${imageData.height}`);
    console.log(`  data.length: ${imageData.data.length}`);
    console.log(`  像素总数: ${imageData.width * imageData.height}`);
    console.log(`  验证: ${imageData.width} × ${imageData.height} × 4 = ${imageData.width * imageData.height * 4}`);
}

/**
 * 演示 2：Uint8ClampedArray 特性
 */
function demonstrateUint8ClampedArray() {
    console.log('\n' + '='.repeat(60));
    console.log('🔢 演示 2：Uint8ClampedArray 特性');
    console.log('='.repeat(60));
    
    console.log(`
【Uint8ClampedArray 是什么？】

- Uint8: 无符号 8 位整数，范围 0-255
- Clamped: 自动截断，超出范围的值会被限制

这个特性对图像处理非常有用：
- 不需要手动检查边界
- 不会出现颜色溢出问题
`);
    
    // 演示自动截断
    const arr = new Uint8ClampedArray(5);
    
    console.log('【自动截断演示】\n');
    
    const tests = [
        { input: 300, expected: 255, desc: '超过255' },
        { input: -50, expected: 0, desc: '负数' },
        { input: 128, expected: 128, desc: '正常值' },
        { input: 255.9, expected: 255, desc: '小数（向下取整到255后截断）' },
        { input: 0.1, expected: 0, desc: '小数（向下取整到0）' }
    ];
    
    tests.forEach((test, i) => {
        arr[i] = test.input;
        console.log(`  输入: ${String(test.input).padStart(6)} → 实际存储: ${arr[i]} (${test.desc})`);
    });
    
    console.log(`
【与普通数组的对比】

普通数组:
  arr[0] = 300;  // 存储 300
  arr[1] = -50;  // 存储 -50

Uint8ClampedArray:
  arr[0] = 300;  // 存储 255（自动截断）
  arr[1] = -50;  // 存储 0（自动截断）

这意味着在图像处理中，你可以直接进行加减运算，
不用担心值溢出：
  data[i] += 100;  // 如果原值是 200，结果自动变为 255
`);
}

/**
 * 演示 3：像素访问
 */
function demonstratePixelAccess() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 演示 3：像素访问');
    console.log('='.repeat(60));
    
    // 创建 3×3 的测试图像
    const imageData = new MockImageData(3, 3);
    
    // 设置一些像素
    setPixel(imageData, 0, 0, 255, 0, 0);     // 红
    setPixel(imageData, 1, 0, 0, 255, 0);     // 绿
    setPixel(imageData, 2, 0, 0, 0, 255);     // 蓝
    setPixel(imageData, 1, 1, 128, 128, 128); // 灰
    
    console.log(`
【getPixel 和 setPixel 函数】

这两个函数封装了像素访问的索引计算，使用起来更直观。
`);
    
    console.log('示例：3×3 图像的像素读取\n');
    
    console.log('  图像布局:');
    console.log('  ┌───────┬───────┬───────┐');
    console.log('  │  红   │  绿   │  蓝   │');
    console.log('  ├───────┼───────┼───────┤');
    console.log('  │  白   │  灰   │  白   │');
    console.log('  ├───────┼───────┼───────┤');
    console.log('  │  白   │  白   │  白   │');
    console.log('  └───────┴───────┴───────┘\n');
    
    // 读取并显示像素
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const pixel = getPixel(imageData, x, y);
            const colorName = getColorName(pixel.r, pixel.g, pixel.b);
            console.log(`  位置(${x}, ${y}): RGB(${String(pixel.r).padStart(3)}, ${String(pixel.g).padStart(3)}, ${String(pixel.b).padStart(3)}) - ${colorName}`);
        }
    }
}

/**
 * 根据 RGB 值返回颜色名称（辅助函数）
 */
function getColorName(r, g, b) {
    if (r === 255 && g === 0 && b === 0) return '红色';
    if (r === 0 && g === 255 && b === 0) return '绿色';
    if (r === 0 && g === 0 && b === 255) return '蓝色';
    if (r === 255 && g === 255 && b === 255) return '白色';
    if (r === 0 && g === 0 && b === 0) return '黑色';
    if (r === g && g === b) return '灰色';
    return '其他';
}

/**
 * 演示 4：像素遍历方法
 */
function demonstratePixelTraversal() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 演示 4：像素遍历方法');
    console.log('='.repeat(60));
    
    console.log(`
【两种遍历方式】

方式一：按索引遍历（更快）
────────────────────────────
for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // 处理像素...
}

优点：速度快，循环次数少
缺点：无法直接知道像素坐标


方式二：按坐标遍历（更直观）
────────────────────────────
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        // ...
    }
}

优点：可以使用坐标进行空间运算
缺点：多一层循环，稍慢


【如何选择？】

- 简单的全局操作（亮度、对比度）→ 方式一
- 需要坐标的操作（滤波、边缘检测）→ 方式二
`);
    
    // 性能对比演示
    const imageData = new MockImageData(100, 100);
    
    console.log('【性能对比】\n');
    console.log('  测试图像: 100×100 (10,000 像素)\n');
    
    // 方式一
    let start = performance.now();
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
    }
    const time1 = performance.now() - start;
    
    // 方式二
    start = performance.now();
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const index = (y * imageData.width + x) * 4;
            const r = imageData.data[index];
            const g = imageData.data[index + 1];
            const b = imageData.data[index + 2];
        }
    }
    const time2 = performance.now() - start;
    
    console.log(`  方式一（按索引）: ${time1.toFixed(3)} ms`);
    console.log(`  方式二（按坐标）: ${time2.toFixed(3)} ms`);
}

/**
 * 演示 5：常用图像操作
 */
function demonstrateImageOperations() {
    console.log('\n' + '='.repeat(60));
    console.log('🎨 演示 5：常用图像操作');
    console.log('='.repeat(60));
    
    // 创建测试图像
    const imageData = new MockImageData(4, 4);
    
    // 填充一些颜色
    setPixel(imageData, 0, 0, 255, 100, 50);
    setPixel(imageData, 1, 0, 100, 200, 150);
    setPixel(imageData, 2, 0, 50, 100, 255);
    setPixel(imageData, 3, 0, 200, 200, 200);
    
    console.log(`
【操作 1：颜色反转】

原理：新值 = 255 - 原值
效果：产生底片效果
`);
    
    // 颜色反转示例
    const pixel = getPixel(imageData, 0, 0);
    const inverted = {
        r: 255 - pixel.r,
        g: 255 - pixel.g,
        b: 255 - pixel.b
    };
    console.log(`  原始: RGB(${pixel.r}, ${pixel.g}, ${pixel.b})`);
    console.log(`  反转: RGB(${inverted.r}, ${inverted.g}, ${inverted.b})`);
    
    console.log(`

【操作 2：亮度调整】

原理：每个通道值加上亮度偏移量
注意：Uint8ClampedArray 自动处理溢出
`);
    
    const brightness = 50;
    const pixel2 = getPixel(imageData, 3, 0);
    console.log(`  原始: RGB(${pixel2.r}, ${pixel2.g}, ${pixel2.b})`);
    console.log(`  亮度 +${brightness}: RGB(${Math.min(255, pixel2.r + brightness)}, ${Math.min(255, pixel2.g + brightness)}, ${Math.min(255, pixel2.b + brightness)})`);
    
    console.log(`

【操作 3：通道分离】

原理：只保留一个通道，其他通道设为 0
用途：分析颜色组成
`);
    
    const pixel3 = getPixel(imageData, 1, 0);
    console.log(`  原始: RGB(${pixel3.r}, ${pixel3.g}, ${pixel3.b})`);
    console.log(`  红色通道: RGB(${pixel3.r}, 0, 0)`);
    console.log(`  绿色通道: RGB(0, ${pixel3.g}, 0)`);
    console.log(`  蓝色通道: RGB(0, 0, ${pixel3.b})`);
    
    console.log(`

【操作 4：灰度化预览】

原理：Gray = 0.299R + 0.587G + 0.114B
这将在下一章详细学习
`);
    
    const pixel4 = getPixel(imageData, 2, 0);
    const gray = Math.round(0.299 * pixel4.r + 0.587 * pixel4.g + 0.114 * pixel4.b);
    console.log(`  原始: RGB(${pixel4.r}, ${pixel4.g}, ${pixel4.b})`);
    console.log(`  灰度: RGB(${gray}, ${gray}, ${gray})`);
}

/**
 * 演示 6：Canvas API 概览（仅限浏览器）
 */
function demonstrateCanvasAPI() {
    console.log('\n' + '='.repeat(60));
    console.log('🖼️ 演示 6：Canvas API 概览');
    console.log('='.repeat(60));
    
    console.log(`
【Canvas API 核心方法】

以下方法只能在浏览器环境中使用：

1. 获取画布和上下文
───────────────────
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');


2. 绑制图片
───────────
const img = new Image();
img.onload = () => {
    ctx.drawImage(img, 0, 0);           // 原始尺寸
    ctx.drawImage(img, 0, 0, 200, 100); // 缩放到 200×100
};
img.src = 'image.jpg';


3. 获取像素数据
───────────────
const imageData = ctx.getImageData(x, y, width, height);
// imageData.data 就是像素数组


4. 写入像素数据
───────────────
ctx.putImageData(imageData, x, y);


5. 导出图片
───────────
const dataURL = canvas.toDataURL('image/png');
// dataURL 可以直接作为 <img> 的 src


6. 创建空白 ImageData
─────────────────────
const newImageData = ctx.createImageData(width, height);
// 或者
const newImageData = new ImageData(width, height);


【在 Node.js 中使用 Canvas】

Node.js 需要安装 canvas 包：
npm install canvas

const { createCanvas, loadImage } = require('canvas');
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');
`);
}

/**
 * 演示 forEachPixel 高阶函数
 */
function demonstrateForEachPixel() {
    console.log('\n' + '='.repeat(60));
    console.log('⚡ 演示 7：forEachPixel 高阶函数');
    console.log('='.repeat(60));
    
    console.log(`
【forEachPixel 函数】

为了简化像素处理，我们创建了 forEachPixel 高阶函数。
它封装了遍历逻辑，你只需要关注单个像素的处理。
`);
    
    // 创建测试图像
    const imageData = new MockImageData(3, 2);
    setPixel(imageData, 0, 0, 100, 50, 25);
    setPixel(imageData, 1, 0, 200, 100, 50);
    setPixel(imageData, 2, 0, 150, 150, 150);
    
    console.log('原始像素:');
    for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 3; x++) {
            const p = getPixel(imageData, x, y);
            console.log(`  (${x}, ${y}): RGB(${p.r}, ${p.g}, ${p.b})`);
        }
    }
    
    // 使用 forEachPixel 进行颜色反转
    const inverted = forEachPixel(imageData, (pixel, x, y) => {
        return {
            r: 255 - pixel.r,
            g: 255 - pixel.g,
            b: 255 - pixel.b
        };
    });
    
    console.log('\n颜色反转后:');
    for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 3; x++) {
            const p = getPixel(inverted, x, y);
            console.log(`  (${x}, ${y}): RGB(${p.r}, ${p.g}, ${p.b})`);
        }
    }
    
    console.log(`

使用方法：
─────────
const result = forEachPixel(imageData, (pixel, x, y, index) => {
    // pixel: { r, g, b, a }
    // x, y: 当前坐标
    // index: 在 data 数组中的起始索引
    
    return {
        r: /* 新的红色值 */,
        g: /* 新的绿色值 */,
        b: /* 新的蓝色值 */
    };
});
`);
}

// ==================== 主程序 ====================

/**
 * 主函数：运行所有演示
 */
function main() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   02. JavaScript 图像处理基础 (Canvas API / ImageData)         ║');
    console.log('║                    OCR 学习项目 - 第二章                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n前置知识：01. 数字图像基础 ✅\n');
    
    // 运行所有演示
    demonstrateImageData();
    demonstrateUint8ClampedArray();
    demonstratePixelAccess();
    demonstratePixelTraversal();
    demonstrateImageOperations();
    demonstrateCanvasAPI();
    demonstrateForEachPixel();
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📚 本章总结');
    console.log('='.repeat(60));
    console.log(`
【核心知识点回顾】

1. Canvas 是 HTML5 的绑图容器，通过 ctx = canvas.getContext('2d') 获取上下文
2. ImageData 包含 width、height 和 data（Uint8ClampedArray）
3. Uint8ClampedArray 自动将值限制在 0-255，避免颜色溢出
4. getImageData() 获取像素数据，putImageData() 写回像素数据
5. 像素遍历有两种方式：按索引（快）和按坐标（直观）
6. toDataURL() 可以将 Canvas 导出为图片

【可复用模块】

本章创建的以下函数已放入 shared/ 目录：
- getPixel(imageData, x, y) - 获取像素值
- setPixel(imageData, x, y, r, g, b, a) - 设置像素值
- cloneImageData(imageData) - 克隆图像数据
- forEachPixel(imageData, callback) - 遍历处理像素

【与 OCR 的关联】

Canvas API 是 OCR 引擎的基础设施：
- 加载待识别的图片
- 执行预处理操作（灰度化、二值化等）
- 显示和导出处理结果

【下一步学习】

继续学习 03. 灰度化，开始第一个实际的图像预处理操作！
使用本章的工具函数，将彩色图像转换为灰度图像。
`);
}

// 运行主程序
main();

// ==================== 导出模块（供其他章节使用）====================

module.exports = {
    MockImageData,
    getPixel,
    setPixel,
    cloneImageData,
    forEachPixel
};
