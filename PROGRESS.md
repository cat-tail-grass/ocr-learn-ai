# OCR 学习进度追踪

## 当前状态

| 项目 | 状态 |
|------|------|
| 当前阶段 | 第四阶段：传统识别 |
| 已完成知识点 | 11/26 |
| 当前知识点 | 11. 特征提取基础 ✅ |
| 完成度 | 42% |

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

### 09. 连通域分析 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. **理解连通性概念**：4 连通只考虑上下左右，8 连通还包括对角线；OCR 推荐使用 8 连通
  2. **深入掌握 Two-Pass 标记算法**：
     - Pass 1：从左到右、从上到下扫描，初始标记并记录等价关系
     - Pass 2：使用并查集解析等价关系，统一所有等价标签
  3. **掌握并查集（Union-Find）数据结构**：高效管理等价类，支持 Find（查找根）和 Union（合并集合）操作，使用路径压缩和按秩合并优化
  4. **学会区域属性提取**：面积、边界框、质心、填充率、宽高比等
  5. **理解区域筛选在 OCR 中的应用**：通过面积、宽高比、填充率等特征过滤噪点和非文字区域
  6. 理解连通域分析是 OCR 字符分割的核心技术
- 关键代码文件：
  - `09-connected-components/README.md` - 知识点说明（Two-Pass 算法、并查集、区域属性）
  - `09-connected-components/index.html` - 浏览器交互演示（可视化标记结果、区域属性展示、过滤功能）
  - `09-connected-components/index.js` - Node.js 代码示例（完整的连通域分析流程）
- 可复用模块（已添加到 shared/09-connected-components/）：
  - `UnionFind` - 并查集数据结构类
  - `labelConnectedComponents(imageData, connectivity)` - 连通域标记
  - `extractRegionProperties(labels, numLabels, width, height)` - 提取区域属性
  - `filterRegions(regions, options)` - 按条件过滤区域
  - `colorizeLabels(labels, numLabels, width, height)` - 可视化标记结果
  - `extractRegionMask(labels, labelId, width, height)` - 提取单个区域掩码
  - `extractRegionImage(imageData, boundingBox)` - 提取区域图像
- 与下一知识点的关联：
  - 连通域分析提取的区域属性用于文本区域定位
  - 区域的边界框、质心等信息用于字符排序和行检测

---

### 10. 文本区域定位 ✅
- 完成日期：2024-12-19
- 核心收获：
  1. **理解文本区域定位的作用**：从图像中找出包含文字的区域，是 OCR 流程中连接预处理和识别的桥梁
  2. **掌握 RLSA 游程平滑算法**：
     - 水平 RLSA：连接同一行的字符，形成文字行块
     - 垂直 RLSA：连接上下相邻的内容
     - 阈值选择：水平阈值为字符宽度的 1~2 倍，垂直阈值为行高的 0.5~1 倍
  3. **掌握投影分析法**：
     - 水平投影：统计每行前景像素数，峰值对应文字行位置
     - 垂直投影：统计每列前景像素数，谷值对应字符间隔
  4. **掌握区域特征筛选**：基于面积、宽高比、填充率等属性筛选候选字符区域
  5. **学会文字行检测**：使用投影分析或 RLSA + 连通域方法检测文字行
  6. **学会字符分割**：使用垂直投影或连通域分析分割单个字符
  7. **理解字符排序**：按从左到右、从上到下的阅读顺序排列字符
- 关键代码文件：
  - `10-text-localization/README.md` - 知识点说明（RLSA、投影分析、行检测、字符分割）
  - `10-text-localization/index.html` - 浏览器交互演示（可视化定位过程、参数调节、投影图）
  - `10-text-localization/index.js` - Node.js 代码示例（完整的文本定位流程）
- 可复用模块（已添加到 shared/10-text-localization/）：
  - `horizontalRLSA(imageData, threshold)` - 水平 RLSA
  - `verticalRLSA(imageData, threshold)` - 垂直 RLSA
  - `filterCandidateCharacters(regions, options)` - 筛选候选字符区域
  - `detectTextLines(imageData, options)` - 检测文字行
  - `groupRegionsIntoLines(regions, options)` - 按行分组区域
  - `segmentCharacters(imageData, lineRegion, options)` - 垂直投影分割字符
  - `segmentCharactersByCC(imageData, options)` - 连通域分割字符
  - `sortCharacters(characters)` - 按阅读顺序排序
  - `extractLineImage(imageData, lineRegion)` - 提取行图像
  - `calculateRegionStats(regions)` - 计算区域统计信息
  - `localizeText(imageData, options)` - 完整文本定位流程
- 与下一知识点的关联：
  - 文本区域定位后，得到有序的字符区域列表
  - 下一章将学习如何提取字符的特征向量，用于识别

---

### 11. 特征提取基础 ✅
- 完成日期：2024-12-19
- 核心收获：
  1. **理解特征的概念**：特征是用一组数值来描述图像属性的方式，是连接图像和分类器的桥梁
  2. **掌握像素级特征**：最简单的特征，将像素值展开为向量，维度高但信息完整
  3. **掌握统计特征**：均值、方差、填充率、质心等，维度低、计算快
  4. **深入理解图像矩**：
     - 原始矩：M_pq = Σ Σ x^p y^q I(x,y)
     - 中心矩：平移不变
     - 归一化中心矩：尺度不变
     - Hu 矩：7 个旋转不变矩，相似形状的字符 Hu 矩接近
  5. **掌握投影特征**：水平投影（每行前景像素数）+ 垂直投影（每列前景像素数），捕获形状轮廓
  6. **掌握网格特征**：将图像划分为 N×N 网格，统计每个区域的填充率
  7. **深入理解 HOG 特征**（方向梯度直方图）：
     - 计算每个像素的梯度幅值和方向
     - 划分 Cell，计算梯度方向直方图
     - Block 归一化，提高光照鲁棒性
     - 拼接所有 Block 特征
  8. **学会特征归一化**：Min-Max、Z-Score、L2 归一化方法
  9. **学会组合多种特征**：将不同类型特征拼接成完整特征向量
  10. **掌握距离度量**：欧氏距离、余弦相似度、曼哈顿距离
- 关键代码文件：
  - `11-feature-extraction/README.md` - 知识点说明（特征类型、Hu矩、HOG详解）
  - `11-feature-extraction/index.html` - 浏览器交互演示（特征可视化、模板匹配）
  - `11-feature-extraction/index.js` - Node.js 代码示例（完整特征提取流程）
- 可复用模块（已添加到 shared/11-feature-extraction/）：
  - `extractPixelFeatures(imageData, options)` - 像素级特征
  - `extractStatisticalFeatures(imageData)` - 统计特征
  - `statisticalFeaturesToVector(stats)` - 统计特征转向量
  - `calculateRawMoment(imageData, p, q)` - 原始矩
  - `calculateCentralMoments(imageData)` - 中心矩
  - `calculateHuMoments(imageData)` - Hu 不变矩
  - `logTransformHuMoments(huMoments)` - Hu 矩对数变换
  - `extractProjectionFeatures(imageData, options)` - 投影特征
  - `extractZoneFeatures(imageData, gridSize)` - 网格特征
  - `computeImageGradients(imageData)` - 梯度计算
  - `extractHOGFeatures(imageData, options)` - HOG 特征
  - `normalizeFeatures(features, method)` - 特征归一化
  - `resizeImage(imageData, width, height)` - 图像缩放
  - `getBoundingBox(imageData)` - 边界框计算
  - `cropAndCenter(imageData, targetSize)` - 裁剪居中
  - `extractCombinedFeatures(imageData, options)` - 组合特征
  - `euclideanDistance(a, b)` - 欧氏距离
  - `cosineSimilarity(a, b)` - 余弦相似度
  - `manhattanDistance(a, b)` - 曼哈顿距离
- 与下一知识点的关联：
  - 特征提取后，得到描述字符的数值向量
  - 下一章将学习如何使用这些特征进行模板匹配识别

---

## 下一步学习

### 下一个知识点：12. 模板匹配

| 属性 | 内容 |
|------|------|
| **学术名称** | Template Matching |
| **学习目的** | 通过与标准模板比对来识别字符，最直观的 OCR 识别方法 |
| **前置知识** | 01-11 全部完成 ✅ |

**学习建议：**

1. 理解模板匹配的基本原理
2. 学习相似度度量方法（欧氏距离、相关系数）
3. 学习如何构建模板库
4. 理解归一化处理的重要性
5. 了解模板匹配的局限性

**核心概念预览：**

- **模板库**：存储标准字符的特征向量或图像
- **相似度计算**：度量待识别字符与模板的相似程度
- **最近邻匹配**：选择最相似的模板作为识别结果
- **归一化**：统一尺寸和特征范围

**学完后你将能够：**

- 构建标准字符模板库
- 实现基于模板匹配的字符识别
- 理解模板匹配的优缺点
- 识别标准化的印刷体字符

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
09.连通域分析 ✅
    ↓
10.文本区域定位 ✅
    ↓
11.特征提取 ✅
    ↓
12.模板匹配 ← 当前目标
    ↓
13.KNN分类器
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
| 2024-12-18 | 09 | 连通域分析（Two-Pass/并查集/区域属性/区域筛选） |
| 2024-12-19 | 10 | 文本区域定位（RLSA/投影分析/行检测/字符分割/排序） |
| 2024-12-19 | 11 | 特征提取（像素/统计/Hu矩/投影/网格/HOG/归一化/距离度量） |

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
| **连通域分析** | `UnionFind` | 并查集数据结构类 |
| | `labelConnectedComponents` | 连通域标记（Two-Pass） |
| | `extractRegionProperties` | 提取区域属性 |
| | `filterRegions` | 按条件过滤区域 |
| | `colorizeLabels` | 可视化标记结果 |
| | `extractRegionMask` | 提取单个区域掩码 |
| | `extractRegionImage` | 提取区域图像 |
| **文本区域定位** | `horizontalRLSA` | 水平 RLSA |
| | `verticalRLSA` | 垂直 RLSA |
| | `filterCandidateCharacters` | 筛选候选字符区域 |
| | `detectTextLines` | 检测文字行 |
| | `groupRegionsIntoLines` | 按行分组区域 |
| | `segmentCharacters` | 垂直投影分割字符 |
| | `segmentCharactersByCC` | 连通域分割字符 |
| | `sortCharacters` | 按阅读顺序排序 |
| | `extractLineImage` | 提取行图像 |
| | `calculateRegionStats` | 计算区域统计 |
| | `localizeText` | 完整文本定位流程 |
| **特征提取** | `extractPixelFeatures` | 像素级特征 |
| | `extractStatisticalFeatures` | 统计特征 |
| | `statisticalFeaturesToVector` | 统计特征转向量 |
| | `calculateRawMoment` | 原始矩 |
| | `calculateCentralMoments` | 中心矩 |
| | `calculateHuMoments` | Hu 不变矩 |
| | `logTransformHuMoments` | Hu 矩对数变换 |
| | `extractProjectionFeatures` | 投影特征 |
| | `extractZoneFeatures` | 网格特征 |
| | `computeImageGradients` | 梯度计算 |
| | `extractHOGFeatures` | HOG 特征 |
| | `normalizeFeatures` | 特征归一化 |
| | `resizeImage` | 图像缩放 |
| | `getBoundingBox` | 边界框计算 |
| | `cropAndCenter` | 裁剪居中 |
| | `extractCombinedFeatures` | 组合特征 |
| | `euclideanDistance` | 欧氏距离 |
| | `cosineSimilarity` | 余弦相似度 |
| | `manhattanDistance` | 曼哈顿距离 |
| **工具** | `clamp` | 限制值在范围内 |
| | `lerp` | 线性插值 |

---

## 统计信息

| 阶段 | 知识点范围 | 状态 |
|------|-----------|------|
| 第一阶段：基础准备 | 01-02 | ✅ 已完成 (2/2) |
| 第二阶段：图像预处理 | 03-07 | ✅ 已完成 (5/5) |
| 第三阶段：文本检测 | 08-10 | ✅ 已完成 (3/3) |
| 第四阶段：传统识别 | 11-13 | 🔄 进行中 (1/3) |
| 第五阶段：深度学习基础 | 14-16 | 未开始 |
| 第六阶段：深度学习OCR | 17-21 | 未开始 |
| 第七阶段：现代OCR | 22-23 | 未开始 |
| 第八阶段：自主OCR引擎开发与验证 | 24-26 | 未开始 |

---

## 🎉 阶段里程碑

### 第四阶段：传统识别 - 进行中！

恭喜！你已开始 OCR 学习的第四阶段——**传统识别方法**。

在这个阶段，你已完成：

1. **特征提取**（✅ 已完成）：掌握多种特征提取方法
   - 像素级特征：直接使用像素值
   - 统计特征：均值、方差、填充率、质心
   - 图像矩：Hu 矩（旋转不变）
   - 结构特征：投影特征、网格特征
   - 梯度特征：HOG 方向梯度直方图
   - 特征归一化与距离度量

现在你已经能够：
- 从字符图像中提取多种类型的特征
- 构建用于分类的特征向量
- 计算特征向量之间的距离/相似度

接下来学习：
- **模板匹配**：使用特征进行最简单的字符识别
- **KNN 分类器**：更灵活的机器学习分类方法
