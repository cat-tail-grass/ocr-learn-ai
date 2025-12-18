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

Canvas（画布）是 HTML5 提供的绑图容器，可以通过 JavaScript 动态绑制图形和处理图像。

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

2D 渲染上下文是 Canvas 的核心 API，提供了所有绑图和图像操作方法。

| 方法 | 作用 |
|------|------|
| `drawImage()` | 将图片绘制到画布上 |
| `getImageData()` | 获取指定区域的像素数据 |
| `putImageData()` | 将像素数据写回画布 |
| `createImageData()` | 创建新的空白 ImageData |

### 3. ImageData 对象

ImageData 是像素数据的容器，包含三个属性：

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

ImageData.data 是一个特殊的类型数组：
- **Uint8** = 无符号8位整数（0-255）
- **Clamped** = 自动截断，超出范围会被限制（-10 → 0，300 → 255）

```javascript
const arr = new Uint8ClampedArray(4);
arr[0] = 300;  // 实际存储 255（自动截断）
arr[1] = -10;  // 实际存储 0（自动截断）
arr[2] = 128;  // 正常存储 128
```

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

本章将创建以下可复用模块，放入 `shared/` 目录：

1. **ImageLoader** - 图像加载工具类
2. **PixelProcessor** - 像素处理基础类
3. **常用工具函数** - getPixel、setPixel、cloneImageData 等

---

## 自测问题

学完本章后，你应该能回答以下问题：

1. 如何获取 Canvas 元素的 2D 渲染上下文？
2. ImageData.data 数组中，第 100 个像素的蓝色通道在哪个索引位置？
3. Uint8ClampedArray 和普通数组有什么区别？
4. 如何将处理后的 Canvas 导出为 PNG 图片？

<details>
<summary>点击查看答案</summary>

1. `canvas.getContext('2d')`
2. 索引 = 100 × 4 + 2 = 402
3. Uint8ClampedArray 会自动将值限制在 0-255 范围内
4. `canvas.toDataURL('image/png')` 或 `canvas.toBlob()`

</details>

---

## 下一步

学完本章后，继续学习 **03. 灰度化**，开始第一个实际的图像预处理操作！
