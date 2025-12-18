# OCR 学习进度追踪

## 当前状态

| 项目 | 状态 |
|------|------|
| 当前阶段 | 第一阶段：基础准备（已完成 ✅） |
| 已完成知识点 | 2/26 |
| 当前知识点 | 02. JavaScript 图像处理基础 ✅ |
| 完成度 | 8% |

---

## 已完成知识点列表

### 01. 数字图像基础 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. 理解像素（Pixel）是图像的最小组成单位
  2. 掌握 RGB 色彩空间，每个像素由 R、G、B 三个通道组成（0-255）
  3. 理解图像的矩阵表示和内存布局（ImageData.data 一维数组结构）
  4. 掌握像素索引计算公式：`index = (y * width + x) * 4`
  5. 了解位深度对颜色表示能力的影响
  6. 理解灰度转换的加权公式：`Gray = 0.299R + 0.587G + 0.114B`
- 关键代码文件：
  - `01-image-fundamentals/README.md` - 知识点说明文档
  - `01-image-fundamentals/index.html` - 浏览器交互演示
  - `01-image-fundamentals/index.js` - Node.js 代码示例
- 可复用模块：
  - `rgbToHex()` - RGB 转十六进制颜色
  - `rgbToGray()` - RGB 转灰度值（标准加权法）
  - `createImageData()` - 模拟 ImageData 数据结构
- 与下一知识点的关联：
  - 本章建立了图像数据结构的理论基础
  - 下一章将学习如何用 JavaScript/Canvas API 实际操作这些数据

---

### 02. JavaScript 图像处理基础 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. 掌握 Canvas API 的核心用法（getContext、drawImage）
  2. 理解 ImageData 对象结构（width、height、data）
  3. 掌握 Uint8ClampedArray 的自动截断特性（0-255 范围）
  4. 学会使用 getImageData() 获取像素数据
  5. 学会使用 putImageData() 写回像素数据
  6. 掌握两种像素遍历方式：按索引（快）和按坐标（直观）
  7. 学会使用 toDataURL() 导出图片
- 关键代码文件：
  - `02-js-image-basics/README.md` - 知识点说明文档
  - `02-js-image-basics/index.html` - 浏览器交互演示（通道分离、颜色反转、亮度调整）
  - `02-js-image-basics/index.js` - Node.js 概念讲解
- 可复用模块（已放入 shared/）：
  - `MockImageData` - 模拟 ImageData 类（Node.js 环境）
  - `getPixel(imageData, x, y)` - 获取像素值
  - `setPixel(imageData, x, y, r, g, b, a)` - 设置像素值
  - `cloneImageData(imageData)` - 克隆图像数据
  - `forEachPixel(imageData, callback)` - 像素遍历
  - `forEachPixelXY(imageData, callback)` - 按坐标遍历
- 与下一知识点的关联：
  - 本章提供了像素操作的能力
  - 下一章将使用这些工具实现灰度化算法

---

## 下一步学习

### 下一个知识点：03. 灰度化

| 属性 | 内容 |
|------|------|
| **学术名称** | Grayscale Conversion |
| **学习目的** | 将彩色图像转为灰度图，降低计算复杂度，为后续二值化做准备 |
| **前置知识** | 01. 数字图像基础 ✅、02. JS图像处理基础 ✅ |

**学习建议：**

1. 理解灰度化的意义（简化图像，去除颜色干扰）
2. 学习多种灰度化算法（平均值法、加权法、最大值法）
3. 理解加权公式的原理（人眼对绿色最敏感）
4. 使用 shared/ 中的工具函数实现灰度化

**核心概念预览：**

- **灰度值**：单一通道表示亮度（0=黑，255=白）
- **加权公式**：`Gray = 0.299R + 0.587G + 0.114B`
- **灰度直方图**：统计各灰度值出现的频率

**学完后你将能够：**

- 将任意彩色图片转换为灰度图
- 理解不同灰度化方法的差异
- 生成灰度直方图
- 为下一章的二值化操作做好准备

---

## 知识点依赖关系

```
01.数字图像基础 ✅
    ↓ （提供图像数据结构的理解）
02.JS图像处理基础 ✅
    ↓ （提供像素操作能力）
03.灰度化 ← 当前目标
    ↓ （简化图像为单通道）
04.二值化
    ↓ ...后续知识点
```

---

## 共享模块更新记录

| 日期 | 章节 | 新增模块 |
|------|------|----------|
| 2024-12-18 | 01-02 | `shared/imageUtils.js` - 图像处理基础工具 |

### shared/imageUtils.js 函数列表

| 函数 | 说明 |
|------|------|
| `MockImageData` | 模拟 ImageData 类 |
| `getPixel` | 获取像素值 |
| `setPixel` | 设置像素值 |
| `getGray` | 获取灰度值 |
| `cloneImageData` | 克隆图像数据 |
| `createImageData` | 创建空白图像 |
| `forEachPixel` | 按索引遍历像素 |
| `forEachPixelXY` | 按坐标遍历像素 |
| `rgbToHex` | RGB 转十六进制 |
| `hexToRgb` | 十六进制转 RGB |
| `rgbToGray` | RGB 转灰度值 |
| `rgbToHsv` | RGB 转 HSV |
| `clamp` | 限制值在范围内 |
| `lerp` | 线性插值 |

---

## 统计信息

| 阶段 | 知识点范围 | 状态 |
|------|-----------|------|
| 第一阶段：基础准备 | 01-02 | ✅ 已完成 (2/2) |
| 第二阶段：图像预处理 | 03-07 | 未开始 |
| 第三阶段：文本检测 | 08-10 | 未开始 |
| 第四阶段：传统识别 | 11-13 | 未开始 |
| 第五阶段：深度学习基础 | 14-16 | 未开始 |
| 第六阶段：深度学习OCR | 17-21 | 未开始 |
| 第七阶段：现代OCR | 22-23 | 未开始 |
| 第八阶段：自主OCR引擎开发与验证 | 24-26 | 未开始 |
