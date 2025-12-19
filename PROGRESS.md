# OCR 学习进度追踪

## 当前状态

| 项目 | 状态 |
|------|------|
| 当前阶段 | 第三阶段：文本检测 |
| 已完成知识点 | 8/26 |
| 当前知识点 | 08. 边缘检测 ✅ |
| 完成度 | 31% |

---

## 已完成知识点列表

### 01. 数字图像基础 ✅
- 完成日期：2024-12-18
- 核心收获：像素、RGB、矩阵表示、索引计算
- 关键代码文件：`01-image-fundamentals/`

---

### 02. JavaScript 图像处理基础 ✅
- 完成日期：2024-12-18
- 核心收获：Canvas API、ImageData、像素遍历
- 关键代码文件：`02-js-image-basics/`

---

### 03. 灰度化 ✅
- 完成日期：2024-12-18
- 核心收获：加权灰度公式、直方图计算
- 关键代码文件：`03-grayscale/`

---

### 04. 二值化 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. 理解二值化是 OCR 预处理的关键步骤
  2. 掌握固定阈值二值化方法
  3. **深入理解 Otsu 算法**：基于类间方差最大化自动计算最佳阈值
  4. 理解自适应阈值的原理和适用场景
  5. 理解阈值选择对 OCR 效果的影响
- 关键代码文件：
  - `04-binarization/README.md` - 知识点说明
  - `04-binarization/index.html` - 浏览器交互演示（三种方法对比、直方图可视化）
  - `04-binarization/index.js` - Node.js 代码示例
- 可复用模块（已添加到 shared/）：
  - `binarizeFixed(imageData, threshold)` - 固定阈值二值化
  - `binarizeOtsu(imageData)` - Otsu 自动阈值二值化
  - `calculateOtsuThreshold(histogram)` - 计算 Otsu 阈值
  - `binarizeAdaptive(imageData, blockSize, C)` - 自适应阈值二值化
- 与下一知识点的关联：
  - 二值化后的图像可能产生噪点
  - 下一章将学习去噪方法处理这些噪点

---

### 05. 图像去噪 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. 理解常见噪声类型：高斯噪声（连续分布）、椒盐噪声（极值点）
  2. **深入理解卷积操作**：图像处理的核心操作，滤波核在图像上滑动计算加权和
  3. 掌握均值滤波：简单平均，速度快但模糊边缘
  4. 掌握高斯滤波：加权平均，权重服从高斯分布，更好地保留边缘
  5. **掌握中值滤波**：取邻域中值，对椒盐噪声效果极佳
  6. 了解边界处理策略：补零、边缘复制、镜像反射
  7. 学会根据噪声类型选择合适的滤波器
- 关键代码文件：
  - `05-denoising/README.md` - 知识点说明
  - `05-denoising/index.html` - 浏览器交互演示（噪声添加、滤波对比、PSNR计算）
  - `05-denoising/index.js` - Node.js 代码示例（详细注释的算法实现）
- 可复用模块（已添加到 shared/）：
  - `createMeanKernel(size)` - 生成均值核
  - `createGaussianKernel(size, sigma)` - 生成高斯核
  - `convolve(imageData, kernel)` - 通用卷积操作
  - `meanFilter(imageData, size)` - 均值滤波
  - `gaussianFilter(imageData, size, sigma)` - 高斯滤波
  - `medianFilter(imageData, size)` - 中值滤波
  - `addGaussianNoise(imageData, sigma)` - 添加高斯噪声（测试用）
  - `addSaltPepperNoise(imageData, density)` - 添加椒盐噪声（测试用）
- 与下一知识点的关联：
  - 卷积操作是形态学操作的基础
  - 去噪后的图像更适合进行形态学处理

---

### 06. 形态学操作 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. **理解结构元素（Structuring Element）**：形态学操作的"模板"，定义操作的形状（矩形、十字、椭圆）
  2. **掌握腐蚀（Erosion）**：只有当结构元素完全匹配前景时保留，效果是缩小区域、去除噪点
  3. **掌握膨胀（Dilation）**：只要结构元素有任意部分与前景重叠就扩展，效果是扩大区域、填补空洞
  4. **掌握开运算（Opening）**：先腐蚀后膨胀，去除小噪点同时保持主体形状
  5. **掌握闭运算（Closing）**：先膨胀后腐蚀，填补小空洞同时保持主体形状
  6. 了解形态学梯度：膨胀减去腐蚀，提取边缘轮廓
  7. 了解顶帽/黑帽变换：提取亮/暗细节
  8. 理解结构元素大小对效果的影响
- 关键代码文件：
  - `06-morphology/README.md` - 知识点说明
  - `06-morphology/index.html` - 浏览器交互演示（结构元素可视化、操作对比）
  - `06-morphology/index.js` - Node.js 代码示例（详细注释的算法实现）
- 可复用模块（已添加到 shared/imageUtils.js）：
  - `createStructuringElement(shape, size)` - 创建结构元素
  - `erode(imageData, structuringElement)` - 腐蚀操作
  - `dilate(imageData, structuringElement)` - 膨胀操作
  - `morphOpen(imageData, structuringElement)` - 开运算
  - `morphClose(imageData, structuringElement)` - 闭运算
  - `morphGradient(imageData, structuringElement)` - 形态学梯度
  - `topHat(imageData, structuringElement)` - 顶帽变换
  - `blackHat(imageData, structuringElement)` - 黑帽变换
- 与下一知识点的关联：
  - 形态学操作后的图像更干净，适合进行倾斜校正
  - 连通域分析（第9章）会用到形态学处理后的结果

---

### 07. 倾斜校正 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. **理解文档倾斜的影响**：倾斜会导致文本行检测失败、字符分割错误、OCR识别率大幅下降
  2. **掌握投影分析法检测倾斜角度**：通过旋转图像计算水平投影方差，方差最大的角度即为倾斜角度
  3. 了解霍夫变换检测直线：将图像空间的点映射到参数空间，检测累加器峰值找到直线
  4. **理解仿射变换**：图像旋转的数学基础，绕中心点旋转使用逆变换公式
  5. **掌握双线性插值**：旋转后像素值的计算方法，使用周围4个像素的加权平均，效果比最近邻插值更平滑
  6. 理解为什么使用逆变换：正向变换会导致目标图像有空洞，逆变换确保每个目标像素都有值
  7. 掌握两阶段搜索优化：粗搜索 + 细化搜索，提高效率和精度
- 关键代码文件：
  - `07-deskewing/README.md` - 知识点说明（投影分析法、霍夫变换、仿射变换、双线性插值）
  - `07-deskewing/index.html` - 浏览器交互演示（实时倾斜模拟、检测校正、投影可视化、角度-方差曲线）
  - `07-deskewing/index.js` - Node.js 代码示例（完整的倾斜检测与校正流程）
- 可复用模块（已添加到 shared/imageUtils.js）：
  - `calculateHorizontalProjection(imageData)` - 计算水平投影直方图
  - `calculateVerticalProjection(imageData)` - 计算垂直投影直方图
  - `calculateProjectionVariance(projection)` - 计算投影方差
  - `bilinearInterpolate(imageData, x, y)` - 双线性插值
  - `rotateImage(imageData, angle, interpolation)` - 旋转图像
  - `detectSkewAngle(imageData, options)` - 检测倾斜角度
  - `deskew(imageData, options)` - 完整的倾斜校正
- 与下一知识点的关联：
  - 倾斜校正后的图像是水平的，适合进行边缘检测
  - 投影分析的概念将在文本区域定位中再次使用

---

### 08. 边缘检测 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. **理解图像梯度**：梯度描述图像亮度的变化率和变化方向，边缘就是梯度幅值较大的地方
  2. **掌握 Sobel 算子**：使用 3×3 卷积核计算 X 和 Y 方向的梯度，检测垂直和水平边缘
  3. **掌握 Prewitt 算子**：类似 Sobel 但权重更简单，计算更快但噪声敏感度更高
  4. **深入理解 Canny 边缘检测算法**（五步经典算法）：
     - Step 1: 高斯滤波去噪
     - Step 2: 使用 Sobel 算子计算梯度幅值和方向
     - Step 3: 非极大值抑制（NMS），细化边缘至单像素宽
     - Step 4: 双阈值检测，区分强边缘、弱边缘、非边缘
     - Step 5: 滞后阈值边缘连接，保留与强边缘相连的弱边缘
  5. 理解梯度幅值和方向的计算：G = √(Gx² + Gy²)，θ = arctan(Gy/Gx)
  6. 理解不同边缘检测算法的适用场景：Sobel 快速、Canny 精确
- 关键代码文件：
  - `08-edge-detection/README.md` - 知识点说明（梯度、Sobel、Prewitt、Canny 详解）
  - `08-edge-detection/index.html` - 浏览器交互演示（三种算法对比、Canny 五步可视化、参数调节）
  - `08-edge-detection/index.js` - Node.js 代码示例（完整的边缘检测算法实现）
- 可复用模块（已添加到 shared/imageUtils.js）：
  - `createSobelKernelX()` - 创建 Sobel X 方向核
  - `createSobelKernelY()` - 创建 Sobel Y 方向核
  - `createPrewittKernelX()` - 创建 Prewitt X 方向核
  - `createPrewittKernelY()` - 创建 Prewitt Y 方向核
  - `computeGradient(imageData, kernelX, kernelY)` - 计算梯度幅值和方向
  - `sobelEdgeDetection(imageData)` - Sobel 边缘检测
  - `prewittEdgeDetection(imageData)` - Prewitt 边缘检测
  - `nonMaxSuppression(magnitude, direction, width, height)` - 非极大值抑制
  - `doubleThreshold(magnitude, low, high, width, height)` - 双阈值处理
  - `hysteresisTracking(strong, weak, width, height)` - 滞后阈值边缘连接
  - `cannyEdgeDetection(imageData, options)` - Canny 边缘检测
- 与下一知识点的关联：
  - 边缘检测的结果可以用于连通域分析
  - 检测到的边缘帮助定位文字笔画的边界

---

## 下一步学习

### 下一个知识点：09. 连通域分析

| 属性 | 内容 |
|------|------|
| **学术名称** | Connected Component Analysis (CCA) / Connected Component Labeling (CCL) |
| **学习目的** | 将相连的像素归为同一区域，用于分割单个字符或文字块 |
| **前置知识** | 01-08 全部完成 ✅ |

**学习建议：**

1. 理解 4 连通和 8 连通的区别
2. 学习 Two-Pass 标记算法
3. 了解并查集（Union-Find）优化
4. 掌握区域属性提取（面积、边界框、质心等）
5. 理解连通域在 OCR 字符分割中的应用

**核心概念预览：**

- **连通性**：4 连通只考虑上下左右，8 连通还包括对角线
- **Two-Pass 算法**：第一遍标记，第二遍合并等价标签
- **并查集**：高效管理等价类的数据结构
- **区域属性**：面积、周长、边界框、质心、宽高比等

**学完后你将能够：**

- 将二值图像中的前景像素分割成独立区域
- 提取每个区域的几何特征
- 为后续的字符分割和文本区域定位做准备

---

## 知识点依赖关系

```
01.数字图像基础 ✅
    ↓
02.JS图像处理基础 ✅
    ↓
03.灰度化 ✅
    ↓
04.二值化 ✅
    ↓
05.图像去噪 ✅
    ↓
06.形态学操作 ✅
    ↓
07.倾斜校正 ✅
    ↓
08.边缘检测 ✅
    ↓
09.连通域分析 ← 当前目标
    ↓
10.文本区域定位
```

---

## 共享模块更新记录

| 日期 | 章节 | 新增模块 |
|------|------|----------|
| 2024-12-18 | 01-02 | 基础工具函数 |
| 2024-12-18 | 03 | 灰度化函数、直方图函数 |
| 2024-12-18 | 04 | 二值化函数（固定/Otsu/自适应） |
| 2024-12-18 | 05 | 卷积操作、滤波函数（均值/高斯/中值） |
| 2024-12-18 | 06 | 形态学操作（腐蚀/膨胀/开运算/闭运算/梯度/顶帽/黑帽） |
| 2024-12-18 | 07 | 倾斜校正（投影分析/旋转变换/双线性插值） |
| 2024-12-18 | 08 | 边缘检测（Sobel/Prewitt/Canny/梯度计算/NMS/双阈值） |

### shared/imageUtils.js 函数列表

| 分类 | 函数 | 说明 |
|------|------|------|
| **类** | `MockImageData` | 模拟 ImageData 类 |
| **像素访问** | `getPixel` | 获取像素值 |
| | `setPixel` | 设置像素值 |
| | `getGray` | 获取灰度值 |
| **图像操作** | `cloneImageData` | 克隆图像数据 |
| | `createImageData` | 创建空白图像 |
| **像素遍历** | `forEachPixel` | 按索引遍历像素 |
| | `forEachPixelXY` | 按坐标遍历像素 |
| **颜色转换** | `rgbToHex` | RGB 转十六进制 |
| | `hexToRgb` | 十六进制转 RGB |
| | `rgbToGray` | RGB 转灰度值 |
| | `rgbToHsv` | RGB 转 HSV |
| **灰度化** | `grayscaleWeighted` | 加权平均法（推荐） |
| | `grayscaleAverage` | 平均值法 |
| | `grayscaleMax` | 最大值法 |
| | `grayscaleMin` | 最小值法 |
| | `grayscaleSingleChannel` | 单通道法 |
| **直方图** | `calculateHistogram` | 计算灰度直方图 |
| | `calculateHistogramStats` | 计算统计信息 |
| **二值化** | `binarizeFixed` | 固定阈值 |
| | `binarizeOtsu` | Otsu 自动阈值 |
| | `calculateOtsuThreshold` | 计算 Otsu 阈值 |
| | `binarizeAdaptive` | 自适应阈值 |
| **滤波核** | `createMeanKernel` | 生成均值核 |
| | `createGaussianKernel` | 生成高斯核 |
| **卷积与滤波** | `convolve` | 通用卷积操作 |
| | `meanFilter` | 均值滤波 |
| | `gaussianFilter` | 高斯滤波 |
| | `medianFilter` | 中值滤波 |
| **噪声（测试用）** | `addGaussianNoise` | 添加高斯噪声 |
| | `addSaltPepperNoise` | 添加椒盐噪声 |
| **形态学操作** | `createStructuringElement` | 创建结构元素 |
| | `erode` | 腐蚀操作 |
| | `dilate` | 膨胀操作 |
| | `morphOpen` | 开运算 |
| | `morphClose` | 闭运算 |
| | `morphGradient` | 形态学梯度 |
| | `topHat` | 顶帽变换 |
| | `blackHat` | 黑帽变换 |
| **倾斜校正** | `calculateHorizontalProjection` | 计算水平投影 |
| | `calculateVerticalProjection` | 计算垂直投影 |
| | `calculateProjectionVariance` | 计算投影方差 |
| | `bilinearInterpolate` | 双线性插值 |
| | `rotateImage` | 旋转图像 |
| | `detectSkewAngle` | 检测倾斜角度 |
| | `deskew` | 完整倾斜校正 |
| **边缘检测** | `createSobelKernelX` | Sobel X 方向核 |
| | `createSobelKernelY` | Sobel Y 方向核 |
| | `createPrewittKernelX` | Prewitt X 方向核 |
| | `createPrewittKernelY` | Prewitt Y 方向核 |
| | `computeGradient` | 计算梯度幅值和方向 |
| | `sobelEdgeDetection` | Sobel 边缘检测 |
| | `prewittEdgeDetection` | Prewitt 边缘检测 |
| | `nonMaxSuppression` | 非极大值抑制 |
| | `doubleThreshold` | 双阈值检测 |
| | `hysteresisTracking` | 滞后阈值边缘连接 |
| | `cannyEdgeDetection` | Canny 边缘检测 |
| **工具** | `clamp` | 限制值在范围内 |
| | `lerp` | 线性插值 |

---

## 统计信息

| 阶段 | 知识点范围 | 状态 |
|------|-----------|------|
| 第一阶段：基础准备 | 01-02 | ✅ 已完成 (2/2) |
| 第二阶段：图像预处理 | 03-07 | ✅ 已完成 (5/5) |
| 第三阶段：文本检测 | 08-10 | 🔄 进行中 (1/3) |
| 第四阶段：传统识别 | 11-13 | 未开始 |
| 第五阶段：深度学习基础 | 14-16 | 未开始 |
| 第六阶段：深度学习OCR | 17-21 | 未开始 |
| 第七阶段：现代OCR | 22-23 | 未开始 |
| 第八阶段：自主OCR引擎开发与验证 | 24-26 | 未开始 |

---

## 🎉 阶段里程碑

### 第二阶段：图像预处理 - 完成！

恭喜！你已完成 OCR 学习的第二阶段——**图像预处理**。

在这个阶段，你学会了：

1. **灰度化**：将彩色图像转换为灰度图，降低复杂度
2. **二值化**：将灰度图转换为黑白图，分离前景和背景
3. **图像去噪**：使用滤波器去除噪声干扰
4. **形态学操作**：优化文字形态，填补空洞、去除噪点
5. **倾斜校正**：检测并校正文档倾斜

这些预处理步骤是 OCR 的基础，为后续的文本检测和识别奠定了坚实基础。

接下来进入第三阶段：**文本检测**！
