# 共享工具模块 (Shared Utilities)

本目录包含可复用的工具函数，供所有章节使用。这些模块最终将整合到 `25-ocr-engine` 中。

## 模块列表

### imageUtils.js

图像处理基础工具，包含：

| 分类 | 函数 | 说明 |
|------|------|------|
| **类** | `MockImageData` | 模拟浏览器的 ImageData 类 |
| **像素访问** | `getPixel(imageData, x, y)` | 获取指定位置的像素值 |
| | `setPixel(imageData, x, y, r, g, b, a)` | 设置指定位置的像素值 |
| | `getGray(imageData, x, y)` | 获取指定位置的灰度值 |
| **图像操作** | `cloneImageData(imageData)` | 克隆图像数据 |
| | `createImageData(width, height, r, g, b, a)` | 创建空白图像 |
| **像素遍历** | `forEachPixel(imageData, callback)` | 按索引遍历像素 |
| | `forEachPixelXY(imageData, callback)` | 按坐标遍历像素 |
| **颜色转换** | `rgbToHex(r, g, b)` | RGB 转十六进制 |
| | `hexToRgb(hex)` | 十六进制转 RGB |
| | `rgbToGray(r, g, b)` | RGB 转灰度值 |
| | `rgbToHsv(r, g, b)` | RGB 转 HSV |
| **工具函数** | `clamp(value, min, max)` | 限制值在范围内 |
| | `lerp(a, b, t)` | 线性插值 |

## 使用方式

### Node.js 环境

```javascript
const { 
    getPixel, 
    setPixel, 
    cloneImageData,
    forEachPixel,
    rgbToGray 
} = require('../shared/imageUtils');

// 创建图像
const imageData = new MockImageData(100, 100);

// 设置像素
setPixel(imageData, 10, 10, 255, 0, 0);

// 获取像素
const pixel = getPixel(imageData, 10, 10);
console.log(pixel); // { r: 255, g: 0, b: 0, a: 255 }

// 遍历处理
const result = forEachPixel(imageData, (pixel) => {
    const gray = rgbToGray(pixel.r, pixel.g, pixel.b);
    return { r: gray, g: gray, b: gray };
});
```

### 浏览器环境

```javascript
// 在浏览器中使用真正的 ImageData
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, 100, 100);

// 工具函数同样适用于真正的 ImageData
const pixel = getPixel(imageData, 10, 10);
```

## 模块更新记录

| 日期 | 章节 | 新增内容 |
|------|------|----------|
| 2024-12-18 | 01. 数字图像基础 | `rgbToHex`, `rgbToGray` |
| 2024-12-18 | 02. JS图像处理基础 | `MockImageData`, `getPixel`, `setPixel`, `cloneImageData`, `forEachPixel` 等 |

## 设计原则

1. **函数式编程**：尽量使用纯函数，不修改输入参数
2. **边界检查**：所有像素访问函数都包含边界检查
3. **类型兼容**：同时支持浏览器 ImageData 和模拟的 MockImageData
4. **详细注释**：每个函数都有完整的 JSDoc 注释
