# 02. JavaScript 图像处理基础 (Canvas API / ImageData Manipulation)

## 学习目标

本章将教你如何在 JavaScript 环境中实际操作图像数据。你将掌握：

1. **Canvas API 基础** - 创建画布、获取上下文
2. **图像加载** - 将图片绘制到 Canvas 上
3. **ImageData 操作** - 获取和修改像素数据
4. **像素遍历** - 高效遍历所有像素
5. **图像导出** - 将处理结果保存为图片

---

## 前置知识

| 知识点 | 状态 | 说明 |
|--------|------|------|
| 01. 数字图像基础 | ✅ 已完成 | 像素、RGB、矩阵表示、索引计算 |

---

## 核心概念

### 1. Canvas 元素

Canvas（画布）是 HTML5 提供的绘图容器，可以通过 JavaScript 动态绘制图形和处理图像。

```html
<!-- 创建 Canvas 元素 -->
<canvas id="myCanvas" width="400" height="300"></canvas>
```

```javascript
// 获取 Canvas 和 2D 上下文
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
```

### 2. CanvasRenderingContext2D

2D 渲染上下文是 Canvas 的核心 API，提供了所有绘图和图像操作方法。

| 方法 | 作用 |
|------|------|
| `drawImage()` | 将图片绘制到画布上 |
| `getImageData()` | 获取指定区域的像素数据 |
| `putImageData()` | 将像素数据写回画布 |
| `createImageData()` | 创建新的空白 ImageData |

### 3. ImageData 对象

ImageData 是像素数据的容器，本课程使用默认 8-bit RGBA，主要读取以下三个属性（不是完整 API 列表）：

```javascript
const imageData = ctx.getImageData(0, 0, width, height);

console.log(imageData.width);  // 图像宽度
console.log(imageData.height); // 图像高度
console.log(imageData.data);   // Uint8ClampedArray，存储 RGBA 值
```

**data 数组结构：**
```
[R₀, G₀, B₀, A₀, R₁, G₁, B₁, A₁, R₂, G₂, B₂, A₂, ...]
 ←─ 像素0 ─→   ←─ 像素1 ─→   ←─ 像素2 ─→
```

### 4. Uint8ClampedArray

本章默认 rgba-unorm8 的 ImageData.data 是一个类型数组：
- **Uint8** = 无符号8位整数（0-255）
- **Clamped** = 饱和限幅，超出范围会被限制（-10 → 0，300 → 255）

```javascript
const arr = new Uint8ClampedArray(4);
arr[0] = 300;  // 实际存储 255（自动截断）
arr[1] = -10;  // 实际存储 0（自动截断）
arr[2] = 128.5; // 舍入至 128：恰好 .5 时取相邻偶数
arr[3] = 129.5; // 舍入至 130，不是向下取整
```

小数按最近整数舍入，平局取偶数；`Math.round(128.5)` 则为 129。限幅处理颜色数值，不会替你检查坐标、图像尺寸和邻域边界。

### 5. 像素遍历模式

遍历图像像素有两种常用模式：

**模式一：按像素索引遍历**
```javascript
const data = imageData.data;
const pixelCount = imageData.width * imageData.height;

for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    
    // 处理像素...
}
```

**模式二：按坐标遍历**
```javascript
const { width, height, data } = imageData;

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 处理像素...
    }
}
```

### 6. 图像加载流程

```javascript
// 完整的图像加载和处理流程
function loadAndProcessImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            // 1. 创建 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            // 2. 获取上下文并绘制图片
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // 3. 获取像素数据
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            
            resolve({ canvas, ctx, imageData });
        };
        
        img.onerror = reject;
        img.src = src;
    });
}
```

---

## 代码示例

### 文件说明

| 文件 | 说明 | 运行环境 |
|------|------|---------|
| `index.html` | 浏览器交互演示，包含多个实践示例 | 浏览器 |
| `index.js` | Node.js 示例（概念讲解） | Node.js |

### 运行方式

**浏览器演示（推荐）：**
```bash
open 02-js-image-basics/index.html
```

**Node.js 示例：**
```bash
cd 02-js-image-basics
node index.js
```

---

## 与 OCR 的关联

Canvas API 是我们 OCR 引擎的基础设施：

| 功能 | OCR 应用 |
|------|---------|
| 图像加载 | 读取待识别的图片 |
| getImageData | 获取像素用于预处理 |
| 像素遍历 | 执行灰度化、二值化等操作 |
| putImageData | 显示处理结果 |
| toDataURL | 导出处理后的图片 |

---

## 可复用模块

共享实现位于 `shared/core`，`shared/imageUtils.js` 是兼容入口。实际提供 `MockImageData`、`getPixel`、`setPixel`、`cloneImageData`、`forEachPixel`、`forEachPixelXY`；本项目没有 `ImageLoader` 或 `PixelProcessor` 类。

- `forEachPixel(image, (pixel, index) => patch)` 的 index 是 RGBA 数组起点（0、4、8…）。
- `forEachPixelXY(image, (pixel, x, y, index) => patch)` 额外给出坐标；返回新图像，未返回的通道保持原值。
- `getPixel` 对非整数/越界坐标返回透明黑；`setPixel` 忽略这类写入，不会把 `(width,0)` 误当作下一行首像素。
- `cloneImageData` 深拷贝数据；`new MockImageData(data,w,h)` 则引用传入的数组，不自动深拷贝。

### Canvas 边界与 Alpha

新建 Canvas / 原生 ImageData 为透明黑 `(0,0,0,0)`。Node 模拟容器默认白色不透明，是课程约定。ImageData 的 RGB 是非预乘通道；保留 alpha 的反色或通道操作不会让透明背景变成不透明背景。本章保留上传图的透明度，03–05 的 OCR 演示则先画白底再加载图像。

`putImageData` 按像素写入，不使用当前变换、`globalAlpha` 或合成运算；`drawImage` 才按绘制状态合成。CSS 调整 canvas 的显示大小不会改变其像素矩阵，鼠标坐标必须按显示尺寸换算；重设 canvas 的 width/height 会清空图像和绘制状态。

远程图片需要服务器允许 CORS，并在设置 src 前设置 `img.crossOrigin='anonymous'`，否则画入后可能无法 getImageData / 导出。上传文件和内置样例不依赖跨域服务。PNG 保留透明度，JPEG 不支持 alpha，应明确背景后导出。

---

## 自测问题

学完本章后，你应该能回答以下问题：

1. 如何获取 Canvas 元素的 2D 渲染上下文？
2. ImageData.data 数组中，编号 100 的像素（从 0 开始）的蓝色通道在哪个索引位置？
3. Uint8ClampedArray 和普通数组有什么区别？
4. 如何将处理后的 Canvas 导出为 PNG 图片？

<details>
<summary>点击查看答案</summary>

1. `canvas.getContext('2d')`
2. 索引 = 100 × 4 + 2 = 402
3. 固定长度、每元素一字节，饱和限幅到 0–255；小数按最近整数舍入，平局取偶数。
4. `canvas.toDataURL('image/png')` 或 `canvas.toBlob()`

</details>

---

## 下一步

学完本章后，继续学习 **03. 灰度化**，开始第一个实际的图像预处理操作！


## 三种产物对应与依赖

| 知识点 | 文档位置 | HTML 实验 | Node 实验/函数 |
|---|---|---|---|
| ImageData/舍入 | 核心概念3/4 | 内置样例、像素读数 | 演示1/2 |
| 遍历/通道/修改 | 核心概念5、可复用模块 | 通道、反色、亮度、恢复 | 演示3–5/7 |
| 加载/导出/alpha | 核心概念6、Canvas边界 | 上传/拖放、导出 | 演示6（API说明） |

在项目根目录首次运行 `npm install`。Node 示例直接运行 `node 02-js-image-basics/index.js`，不触发模型训练。浏览器可运行 `npm run build` 后 `npm start`，访问 `http://127.0.0.1:4173/02-js-image-basics/`；已构建的页面也可本地打开。

02–05 的 `browser.js` 调用共享模块，构建为同目录 `bundle.js`；HTML 只保留交互和展示，算法步骤请对照共享源文件。

## 参考来源

- [WHATWG Canvas 像素操作](https://html.spec.whatwg.org/multipage/canvas.html#pixel-manipulation)
- [ECMAScript ToUint8Clamp](https://tc39.es/ecma262/2023/multipage/abstract-operations.html#sec-touint8clamp)
