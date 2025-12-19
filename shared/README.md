# 共享工具模块 (Shared Utilities)

本目录包含可复用的图像处理工具函数，供所有章节使用。这些模块最终将整合到 `25-ocr-engine` 中。

## 目录结构

```
shared/
├── index.js                    # 统一入口（主导出）
├── imageUtils.js               # 兼容层（重新导出 index.js）
├── core/                       # 核心基础模块（01-02章节）
│   ├── index.js                # 核心模块统一导出
│   ├── MockImageData.js        # 模拟 ImageData 类
│   ├── pixelAccess.js          # getPixel, setPixel, getGray
│   ├── imageData.js            # cloneImageData, createImageData
│   ├── pixelIterator.js        # forEachPixel, forEachPixelXY
│   ├── colorConversion.js      # rgbToHex, hexToRgb, rgbToGray, rgbToHsv
│   └── utils.js                # clamp, lerp
├── 03-grayscale/               # 灰度化模块
│   └── index.js
├── 04-binarization/            # 二值化模块
│   └── index.js
├── 05-denoising/               # 去噪模块
│   └── index.js
├── 06-morphology/              # 形态学操作模块
│   └── index.js
├── 07-deskewing/               # 倾斜校正模块
│   └── index.js
├── 08-edge-detection/          # 边缘检测模块
│   └── index.js
└── __tests__/                  # Jest 单元测试
    ├── core.test.js
    ├── grayscale.test.js
    ├── binarization.test.js
    ├── denoising.test.js
    ├── morphology.test.js
    ├── deskewing.test.js
    └── edgeDetection.test.js
```

## 模块列表

### core/ - 核心模块（01-02章节）

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

### 03-grayscale/ - 灰度化模块

| 函数 | 说明 |
|------|------|
| `grayscaleWeighted(imageData)` | 加权平均法灰度化（推荐） |
| `grayscaleAverage(imageData)` | 平均值法灰度化 |
| `grayscaleMax(imageData)` | 最大值法灰度化 |
| `grayscaleMin(imageData)` | 最小值法灰度化 |
| `grayscaleSingleChannel(imageData, channel)` | 单通道灰度化 |
| `calculateHistogram(imageData)` | 计算灰度直方图 |
| `calculateHistogramStats(histogram, totalPixels)` | 计算直方图统计信息 |

### 04-binarization/ - 二值化模块

| 函数 | 说明 |
|------|------|
| `binarizeFixed(imageData, threshold)` | 固定阈值二值化 |
| `calculateOtsuThreshold(histogram)` | 计算 Otsu 阈值 |
| `binarizeOtsu(imageData)` | Otsu 自动二值化 |
| `binarizeAdaptive(imageData, blockSize, C)` | 自适应阈值二值化 |

### 05-denoising/ - 去噪模块

| 函数 | 说明 |
|------|------|
| `createMeanKernel(size)` | 创建均值滤波核 |
| `createGaussianKernel(size, sigma)` | 创建高斯滤波核 |
| `convolve(imageData, kernel)` | 卷积操作 |
| `meanFilter(imageData, size)` | 均值滤波 |
| `gaussianFilter(imageData, size, sigma)` | 高斯滤波 |
| `medianFilter(imageData, size)` | 中值滤波 |
| `addGaussianNoise(imageData, sigma)` | 添加高斯噪声 |
| `addSaltPepperNoise(imageData, density)` | 添加椒盐噪声 |

### 06-morphology/ - 形态学操作模块

| 函数 | 说明 |
|------|------|
| `createStructuringElement(shape, size)` | 创建结构元素 |
| `erode(imageData, se)` | 腐蚀操作 |
| `dilate(imageData, se)` | 膨胀操作 |
| `morphOpen(imageData, se)` | 开运算 |
| `morphClose(imageData, se)` | 闭运算 |
| `morphGradient(imageData, se)` | 形态学梯度 |
| `topHat(imageData, se)` | 顶帽变换 |
| `blackHat(imageData, se)` | 黑帽变换 |

### 07-deskewing/ - 倾斜校正模块

| 函数 | 说明 |
|------|------|
| `calculateHorizontalProjection(imageData)` | 水平投影直方图 |
| `calculateVerticalProjection(imageData)` | 垂直投影直方图 |
| `calculateProjectionVariance(projection)` | 投影方差 |
| `bilinearInterpolate(imageData, x, y)` | 双线性插值 |
| `rotateImage(imageData, angle, interpolation)` | 旋转图像 |
| `detectSkewAngle(imageData, options)` | 检测倾斜角度 |
| `deskew(imageData, options)` | 执行倾斜校正 |

### 08-edge-detection/ - 边缘检测模块

| 函数 | 说明 |
|------|------|
| `createSobelKernelX/Y()` | Sobel 卷积核 |
| `createPrewittKernelX/Y()` | Prewitt 卷积核 |
| `computeGradient(imageData, kernelX, kernelY)` | 计算梯度 |
| `sobelEdgeDetection(imageData, normalize)` | Sobel 边缘检测 |
| `prewittEdgeDetection(imageData, normalize)` | Prewitt 边缘检测 |
| `nonMaxSuppression(magnitude, direction, w, h)` | 非极大值抑制 |
| `doubleThreshold(magnitude, low, high, w, h)` | 双阈值检测 |
| `hysteresisTracking(strong, weak, w, h)` | 边缘连接 |
| `cannyEdgeDetection(imageData, options)` | Canny 边缘检测 |

## 使用方式

### 方式1：向后兼容（导入所有函数）

```javascript
const { 
    getPixel, 
    setPixel, 
    grayscaleWeighted,
    binarizeOtsu,
    cannyEdgeDetection
} = require('../shared/imageUtils');
// 或
const imageUtils = require('../shared');
```

### 方式2：按模块导入（推荐）

```javascript
// 导入核心模块
const { MockImageData, getPixel, setPixel } = require('../shared/core');

// 导入特定章节模块
const { grayscaleWeighted } = require('../shared/03-grayscale');
const { binarizeOtsu } = require('../shared/04-binarization');
const { cannyEdgeDetection } = require('../shared/08-edge-detection');
```

### 代码示例

```javascript
const { MockImageData, setPixel, getPixel } = require('../shared/core');
const { grayscaleWeighted, calculateHistogram } = require('../shared/03-grayscale');
const { binarizeOtsu } = require('../shared/04-binarization');

// 创建图像
const imageData = new MockImageData(100, 100);

// 设置像素
setPixel(imageData, 10, 10, 255, 0, 0);

// 灰度化
const grayImage = grayscaleWeighted(imageData);

// 计算直方图
const histogram = calculateHistogram(grayImage);

// Otsu 二值化
const { imageData: binaryImage, threshold } = binarizeOtsu(grayImage);
console.log(`Otsu 阈值: ${threshold}`);
```

## 运行测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 设计原则

1. **函数式编程**：尽量使用纯函数，不修改输入参数
2. **边界检查**：所有像素访问函数都包含边界检查
3. **类型兼容**：同时支持浏览器 ImageData 和模拟的 MockImageData
4. **详细注释**：每个函数都有完整的 JSDoc 注释
5. **模块化设计**：按章节组织，便于维护和复用
6. **单元测试**：每个模块都有完整的单元测试

## 模块更新记录

| 日期 | 章节 | 内容 |
|------|------|------|
| 2024-12-18 | 01-02 | 核心模块：MockImageData, 像素访问, 颜色转换 |
| 2024-12-18 | 03 | 灰度化：多种灰度化算法, 直方图 |
| 2024-12-18 | 04 | 二值化：固定阈值, Otsu, 自适应 |
| 2024-12-18 | 05 | 去噪：均值滤波, 高斯滤波, 中值滤波 |
| 2024-12-18 | 06 | 形态学：腐蚀, 膨胀, 开闭运算, 顶帽黑帽 |
| 2024-12-18 | 07 | 倾斜校正：投影分析, 图像旋转, 角度检测 |
| 2024-12-18 | 08 | 边缘检测：Sobel, Prewitt, Canny |
