# 共享工具模块 (Shared Utilities)

本目录包含各章可复用的算法，浏览器与 Node.js 调用同一实现。第 25 章已组合预处理、分割和自主训练模型，第 26 章复用第 24 章评分。

## 第 09–26 章模块导航

以下目录补全早期目录图之后的课程。统一入口保留已有平铺导出，第 14–26 章增加主题命名空间以避免同名函数相互覆盖；直接按目录导入仍是推荐方式。

| 目录 | 内容 | 第 14 章以后的统一入口名称 |
|---|---|---|
| `09-connected-components` | 连通域、区域属性 | 既有平铺导出 |
| `10-text-localization` | 文本行定位与分割 | 既有平铺导出 |
| `11-feature-extraction` | 特征、距离与归一化 | 既有平铺导出 |
| `12-template-matching` | 模板与拒识 | 既有平铺导出 |
| `13-knn-classifier` | 邻居搜索与投票 | 既有平铺导出 |
| `14-neural-network-basics` | MLP 前向、反向和梯度检查 | `neuralNetwork` |
| `15-cnn-basics` | 多通道卷积、池化和导数 | `cnn` |
| `16-tensorflowjs-intro` | 张量、训练、序列化与资源 | `tensorflowjsIntro` |
| `17-cnn-classifier` | CNN、共享输入规范与特征图 | `digitClassifier` |
| `18-rnn-basics` | RNN、LSTM、双向状态 | `rnn` |
| `19-ctc-loss` | 路径折叠、动态规划与解码 | `ctc` |
| `20-crnn` | CNN + BiLSTM + 可微 CTC | `crnn` |
| `21-attention` | Q/K/V、遮罩与梯度 | `attention` |
| `22-text-detection-networks` | DB 运算、几何与区域后处理 | `textDetectionNetworks` |
| `23-transformer-ocr` | 位置、patch、多头和编码解码 | `transformer` |
| `24-post-processing` | 编辑距离、CER、先验和过滤 | `postProcessing` |
| `25-ocr-engine` | 照片预处理、分割、分类流水线 | `ocrEngine` |
| `26-validation` | 首次预测记录、标注与分组 | `validation` |

```javascript
const { recognizePhoto } = require('../shared/25-ocr-engine');
// 或 const { ocrEngine } = require('../shared');
```

各函数的输入、公式、数值例子和误区见对应章节 README 的知识点对应表。`course.css`、`course.js` 提供浏览器教学样式和导航；构建文件不替代可读源代码。

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
| `convolve(imageData, kernel)` | 翻转核后的数学卷积 |
| `correlate(imageData, kernel)` | 不翻核的互相关；对称滤波核与卷积结果相同 |
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
