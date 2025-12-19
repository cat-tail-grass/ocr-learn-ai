# 11. 特征提取基础 (Feature Extraction)

## 学习目标

特征提取是将字符图像转换为可用于分类的数值向量的技术，是 OCR 识别的关键步骤。本章将帮助你掌握：

1. **特征的概念** - 理解什么是特征，为什么需要特征提取
2. **像素级特征** - 原始像素值作为特征
3. **统计特征** - 均值、方差、矩等统计量
4. **结构特征** - 投影特征、轮廓特征
5. **HOG 特征** - 方向梯度直方图，经典的图像特征
6. **特征向量** - 组合多种特征形成完整的特征表示

---

## 前置知识

| 知识点 | 状态 | 关键内容 |
|--------|------|----------|
| 01. 数字图像基础 | ✅ 已完成 | 像素、坐标系统 |
| 02. JS图像处理基础 | ✅ 已完成 | Canvas API、像素操作 |
| 03. 灰度化 | ✅ 已完成 | 灰度转换 |
| 04. 二值化 | ✅ 已完成 | 二值图像 |
| 05-07 预处理 | ✅ 已完成 | 去噪、形态学、校正 |
| 08. 边缘检测 | ✅ 已完成 | **梯度计算（HOG 基础）** |
| 09. 连通域分析 | ✅ 已完成 | 区域属性提取 |
| 10. 文本区域定位 | ✅ 已完成 | **字符分割** |

---

## 核心概念

### 1. 什么是特征？

**特征（Feature）** 是用一组数值来描述图像中某种属性或模式的方式。

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          为什么需要特征提取？                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  原始图像：                        特征向量：                              │
│  ┌─────────────┐                  ┌─────────────────────────┐            │
│  │ 28×28 像素  │  ─────────────→  │ [0.2, 0.8, 0.5, ...]    │            │
│  │ = 784 个值  │   特征提取        │ 固定长度的数值数组       │            │
│  │ 高维稀疏    │                  │ 紧凑、有意义             │            │
│  └─────────────┘                  └─────────────────────────┘            │
│                                                                          │
│  好处：                                                                   │
│  ✓ 降低维度：784 像素 → 几十个特征                                         │
│  ✓ 提取本质：捕获形状、结构等关键信息                                       │
│  ✓ 提高鲁棒性：对噪声、平移、缩放更稳定                                     │
│  ✓ 加速计算：分类器处理特征比处理原始像素更快                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2. 特征的分类

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          特征类型总览                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 1. 像素级特征（Pixel-level Features）                                ││
│  │    • 原始像素值                                                      ││
│  │    • 归一化后的像素值                                                 ││
│  │    • 降采样后的像素值                                                 ││
│  │    特点：简单直接，但维度高、不够鲁棒                                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 2. 统计特征（Statistical Features）                                  ││
│  │    • 均值、方差、标准差                                               ││
│  │    • 图像矩（Image Moments）                                         ││
│  │    • Hu 矩（旋转不变矩）                                              ││
│  │    特点：紧凑，具有一定的平移/旋转不变性                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 3. 结构特征（Structural Features）                                   ││
│  │    • 水平/垂直投影                                                   ││
│  │    • 轮廓方向分布                                                    ││
│  │    • 交叉点、端点计数                                                 ││
│  │    特点：描述字符的几何结构                                           ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 4. 梯度特征（Gradient Features）                                     ││
│  │    • HOG（方向梯度直方图）                                            ││
│  │    • 梯度方向分布                                                    ││
│  │    特点：捕获边缘和形状信息，对光照变化鲁棒                            ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3. 像素级特征

最简单的特征就是直接使用像素值：

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          像素级特征                                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  原始图像 (5×5):           展开为向量:                                    │
│  ┌─────────────────┐      ┌─────────────────────────────────────────┐   │
│  │ 0   0   255 0   0│      │ [0, 0, 255, 0, 0, 0, 255, 255, 255, 0, │   │
│  │ 0   255 255 255 0│  →   │  0, 255, 0, 255, 0, 0, 255, 255, 255, 0,│   │
│  │ 0   255 0   255 0│      │  0, 0, 255, 0, 0]                       │   │
│  │ 0   255 255 255 0│      └─────────────────────────────────────────┘   │
│  │ 0   0   255 0   0│      长度 = 宽 × 高 = 25                            │
│  └─────────────────┘                                                     │
│                                                                          │
│  常见预处理：                                                              │
│  1. 尺寸归一化：将所有字符缩放到固定大小（如 28×28）                        │
│  2. 值归一化：将像素值归一化到 [0, 1] 范围                                 │
│  3. 降采样：减少像素数量（如 28×28 → 14×14）                              │
│                                                                          │
│  优点：保留所有原始信息                                                    │
│  缺点：维度高、对平移/旋转敏感                                             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4. 统计特征

通过统计量描述图像的全局特性：

#### 基本统计量

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          基本统计特征                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 像素均值（Mean）                                                      │
│     μ = (1/N) × Σ p(i)                                                   │
│     描述：图像的整体亮度                                                   │
│                                                                          │
│  2. 像素方差（Variance）                                                  │
│     σ² = (1/N) × Σ (p(i) - μ)²                                           │
│     描述：图像的对比度/像素分布的离散程度                                  │
│                                                                          │
│  3. 像素标准差（Standard Deviation）                                      │
│     σ = √σ²                                                              │
│     描述：同方差，单位与原始数据一致                                       │
│                                                                          │
│  4. 填充率（Fill Ratio）                                                  │
│     fill = 前景像素数 / 总像素数                                          │
│     描述：字符的"密度"，不同字符差异明显                                   │
│                                                                          │
│  5. 质心（Centroid）                                                      │
│     cx = Σ(x × p(x,y)) / Σp(x,y)                                         │
│     cy = Σ(y × p(x,y)) / Σp(x,y)                                         │
│     描述：字符的重心位置                                                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 图像矩（Image Moments）⭐

图像矩是描述图像形状特征的重要工具：

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          图像矩（Moments）                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 原始矩（Raw Moments）                                                 │
│     M_pq = Σ Σ x^p × y^q × I(x, y)                                       │
│                                                                          │
│     常用矩：                                                              │
│     M00 = 面积（前景像素总数）                                            │
│     M10, M01 = 用于计算质心                                               │
│     M20, M02, M11 = 二阶矩，描述分布                                      │
│                                                                          │
│  2. 中心矩（Central Moments）—— 平移不变                                  │
│     μ_pq = Σ Σ (x - x̄)^p × (y - ȳ)^q × I(x, y)                          │
│                                                                          │
│     其中 x̄ = M10/M00, ȳ = M01/M00 是质心坐标                             │
│                                                                          │
│  3. 归一化中心矩（Normalized Central Moments）—— 平移 + 尺度不变          │
│     η_pq = μ_pq / M00^((p+q)/2 + 1)                                      │
│                                                                          │
│  4. Hu 矩（Hu Moments）—— 平移 + 尺度 + 旋转不变 ⭐                       │
│     由归一化中心矩的组合构成，共 7 个不变矩                                │
│     h1 = η20 + η02                                                       │
│     h2 = (η20 - η02)² + 4η11²                                            │
│     h3 = (η30 - 3η12)² + (3η21 - η03)²                                   │
│     ...（还有 4 个）                                                      │
│                                                                          │
│  应用：Hu 矩可以用于匹配不同大小、位置、旋转的相同字符                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5. 结构特征

描述字符的几何结构：

#### 投影特征（Projection Features）

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          投影特征                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  字符 "A":                                                               │
│       █                                                                  │
│      █ █         水平投影        垂直投影                                 │
│     █   █        [1]             [2,3,4,4,3,2,1]                         │
│    █████         [2]                                                     │
│    █   █         [2]             投影值 = 每行/列的前景像素数              │
│   █     █        [5]                                                     │
│   █     █        [2]                                                     │
│                  [2]                                                     │
│                                                                          │
│  作为特征向量：                                                           │
│  • 水平投影：高度维向量（如 28 维）                                        │
│  • 垂直投影：宽度维向量（如 28 维）                                        │
│  • 合并：56 维特征向量                                                    │
│                                                                          │
│  优点：                                                                   │
│  • 捕获字符的轮廓形状                                                     │
│  • 对小幅度变形有一定容忍度                                                │
│  • 复用第 7 章已实现的投影计算函数                                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 网格特征（Zone Features）

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          网格特征（分区统计）                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  将图像划分为 N×N 个区域，统计每个区域的特征：                              │
│                                                                          │
│  字符图像 (28×28):         4×4 网格划分:                                  │
│  ┌──────────────────┐      ┌───┬───┬───┬───┐                            │
│  │                  │      │ 12│ 8 │ 5 │ 3 │  ← 每格的前景像素数          │
│  │    ██████        │      ├───┼───┼───┼───┤                            │
│  │   ██    ██       │  →   │ 15│ 2 │ 2 │14 │                            │
│  │   ████████       │      ├───┼───┼───┼───┤                            │
│  │   ██    ██       │      │ 18│ 0 │ 0 │17 │                            │
│  │   ██    ██       │      ├───┼───┼───┼───┤                            │
│  │                  │      │ 16│ 3 │ 4 │15 │                            │
│  └──────────────────┘      └───┴───┴───┴───┘                            │
│                                                                          │
│  特征向量：[12, 8, 5, 3, 15, 2, 2, 14, 18, 0, 0, 17, 16, 3, 4, 15]       │
│  长度：N × N = 16 维（4×4 网格）                                          │
│                                                                          │
│  可归一化：每个值除以该区域的总像素数，得到填充率                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6. HOG 特征（方向梯度直方图）⭐

HOG（Histogram of Oriented Gradients）是一种强大的特征描述子，广泛用于目标检测和字符识别。

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          HOG 特征原理                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  基本思想：                                                               │
│  图像的局部形状可以用梯度方向的分布来描述                                   │
│                                                                          │
│  计算步骤：                                                               │
│                                                                          │
│  Step 1: 计算梯度                                                        │
│  ┌─────────────┐   Sobel     ┌─────────────┐                            │
│  │  灰度图像   │ ─────────→  │ 梯度幅值 G  │                            │
│  │             │   算子      │ 梯度方向 θ  │                            │
│  └─────────────┘             └─────────────┘                            │
│                                                                          │
│  Step 2: 划分 Cell                                                       │
│  ┌───┬───┬───┬───┐                                                      │
│  │ C │ C │ C │ C │   每个 Cell 通常是 8×8 像素                           │
│  ├───┼───┼───┼───┤                                                      │
│  │ C │ C │ C │ C │   每个 Cell 计算一个梯度方向直方图                     │
│  ├───┼───┼───┼───┤                                                      │
│  │ C │ C │ C │ C │                                                      │
│  └───┴───┴───┴───┘                                                      │
│                                                                          │
│  Step 3: 计算每个 Cell 的直方图                                           │
│  • 将 0°-180°（或 0°-360°）分成 9 个 bin                                 │
│  • 每个像素根据梯度方向投票到对应 bin                                      │
│  • 投票权重 = 梯度幅值                                                    │
│                                                                          │
│          0°  20° 40° 60° 80° 100°120°140°160°                           │
│          ┌───┬───┬───┬───┬───┬───┬───┬───┬───┐                         │
│          │███│██ │█  │   │███│████│█  │   │██ │ ← Cell 的直方图          │
│          └───┴───┴───┴───┴───┴───┴───┴───┴───┘                         │
│                                                                          │
│  Step 4: Block 归一化                                                    │
│  • 将相邻的 Cell（如 2×2）组成 Block                                      │
│  • 对 Block 内的特征进行 L2 归一化                                        │
│  • 提高对光照变化的鲁棒性                                                  │
│                                                                          │
│  Step 5: 拼接特征向量                                                     │
│  • 将所有 Block 的归一化直方图拼接成最终特征向量                            │
│                                                                          │
│  特征维度示例（28×28 图像）：                                              │
│  • Cell: 7×7 像素 → 4×4 个 Cell                                          │
│  • Block: 2×2 Cell → 3×3 个 Block                                        │
│  • 每个 Block: 2×2×9 = 36 维                                             │
│  • 总维度: 3×3×36 = 324 维                                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7. 特征向量的构建

在实际应用中，通常组合多种特征：

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          组合特征向量                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 字符图像                                                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│       ↓              ↓              ↓              ↓                     │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐                  │
│  │统计特征 │   │投影特征 │   │网格特征 │   │HOG特征  │                  │
│  │ 7 维    │   │ 56 维   │   │ 16 维   │   │ 324 维  │                  │
│  │(Hu矩等) │   │(水平+   │   │(4×4分区)│   │(梯度直  │                  │
│  │         │   │ 垂直)   │   │         │   │ 方图)   │                  │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘                  │
│       └──────────────┴──────────────┴──────────────┘                     │
│                              ↓                                           │
│                    ┌───────────────────┐                                 │
│                    │ 特征向量拼接与归一化│                                 │
│                    └─────────┬─────────┘                                 │
│                              ↓                                           │
│                    ┌───────────────────┐                                 │
│                    │ 最终特征向量       │                                 │
│                    │ [f1, f2, ..., fn] │                                 │
│                    │ n = 403 维        │                                 │
│                    └───────────────────┘                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8. 特征归一化

归一化是特征工程的重要步骤：

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          特征归一化方法                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Min-Max 归一化                                                        │
│     x' = (x - min) / (max - min)                                         │
│     将特征值缩放到 [0, 1] 范围                                             │
│                                                                          │
│  2. Z-Score 标准化                                                        │
│     x' = (x - μ) / σ                                                     │
│     使特征均值为 0，标准差为 1                                             │
│                                                                          │
│  3. L2 归一化                                                             │
│     x' = x / ||x||₂ = x / √(Σxᵢ²)                                        │
│     将向量归一化为单位向量                                                 │
│                                                                          │
│  为什么需要归一化？                                                        │
│  • 不同特征的量纲不同（如像素值 0-255，面积可能是几百）                     │
│  • 防止某些特征因为数值大而主导分类结果                                     │
│  • 加速梯度下降等优化算法的收敛                                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 算法实现

### 1. 像素级特征

```javascript
/**
 * 提取像素级特征
 * 
 * 原理：将二值图像的像素值展开为一维向量
 * 
 * @param {ImageData} imageData - 输入图像（应为二值图或灰度图）
 * @param {object} options - 配置选项
 * @returns {number[]} 像素特征向量
 */
function extractPixelFeatures(imageData, options = {}) {
    const {
        targetSize = 28,       // 归一化到的目标尺寸
        normalize = true       // 是否归一化到 [0, 1]
    } = options;
    
    // Step 1: 尺寸归一化（实际应用中需要缩放图像）
    // 这里假设图像已经是目标尺寸
    
    const features = [];
    const { width, height, data } = imageData;
    
    // Step 2: 提取每个像素的灰度值
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = data[idx]; // 假设已是灰度图
            features.push(normalize ? gray / 255 : gray);
        }
    }
    
    return features;
}
```

### 2. 统计特征

```javascript
/**
 * 提取基本统计特征
 * 
 * @param {ImageData} imageData - 输入图像
 * @returns {object} 统计特征对象
 */
function extractStatisticalFeatures(imageData) {
    const { width, height, data } = imageData;
    const totalPixels = width * height;
    
    let sum = 0;
    let foregroundCount = 0;
    let sumX = 0, sumY = 0;
    
    // 第一次遍历：计算基本统计量
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = data[idx];
            sum += gray;
            
            if (gray < 128) { // 前景像素
                foregroundCount++;
                sumX += x;
                sumY += y;
            }
        }
    }
    
    const mean = sum / totalPixels;
    const fillRatio = foregroundCount / totalPixels;
    
    // 质心（归一化到 [0, 1]）
    const centroidX = foregroundCount > 0 ? (sumX / foregroundCount) / width : 0.5;
    const centroidY = foregroundCount > 0 ? (sumY / foregroundCount) / height : 0.5;
    
    // 第二次遍历：计算方差
    let varianceSum = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = data[idx];
            varianceSum += (gray - mean) ** 2;
        }
    }
    const variance = varianceSum / totalPixels;
    const stdDev = Math.sqrt(variance);
    
    return {
        mean: mean / 255,           // 归一化均值
        variance: variance / (255 * 255),  // 归一化方差
        stdDev: stdDev / 255,       // 归一化标准差
        fillRatio,                  // 填充率
        centroidX,                  // 归一化质心 X
        centroidY                   // 归一化质心 Y
    };
}
```

### 3. 图像矩

```javascript
/**
 * 计算图像的原始矩
 * 
 * 原理：M_pq = Σ Σ x^p × y^q × I(x, y)
 * 
 * @param {ImageData} imageData - 输入图像（二值图）
 * @param {number} p - x 的幂次
 * @param {number} q - y 的幂次
 * @returns {number} 矩值
 */
function calculateRawMoment(imageData, p, q) {
    const { width, height, data } = imageData;
    let moment = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const intensity = data[idx] < 128 ? 1 : 0; // 二值化
            moment += Math.pow(x, p) * Math.pow(y, q) * intensity;
        }
    }
    
    return moment;
}

/**
 * 计算 Hu 矩（7 个旋转不变矩）
 * 
 * @param {ImageData} imageData - 输入图像
 * @returns {number[]} 7 个 Hu 矩值
 */
function calculateHuMoments(imageData) {
    // 计算原始矩
    const m00 = calculateRawMoment(imageData, 0, 0);
    const m10 = calculateRawMoment(imageData, 1, 0);
    const m01 = calculateRawMoment(imageData, 0, 1);
    const m20 = calculateRawMoment(imageData, 2, 0);
    const m02 = calculateRawMoment(imageData, 0, 2);
    const m11 = calculateRawMoment(imageData, 1, 1);
    const m30 = calculateRawMoment(imageData, 3, 0);
    const m03 = calculateRawMoment(imageData, 0, 3);
    const m21 = calculateRawMoment(imageData, 2, 1);
    const m12 = calculateRawMoment(imageData, 1, 2);
    
    // 计算质心
    const xBar = m00 > 0 ? m10 / m00 : 0;
    const yBar = m00 > 0 ? m01 / m00 : 0;
    
    // 计算中心矩
    const mu20 = m20 - xBar * m10;
    const mu02 = m02 - yBar * m01;
    const mu11 = m11 - xBar * m01;
    const mu30 = m30 - 3 * xBar * m20 + 2 * xBar * xBar * m10;
    const mu03 = m03 - 3 * yBar * m02 + 2 * yBar * yBar * m01;
    const mu21 = m21 - 2 * xBar * m11 - yBar * m20 + 2 * xBar * xBar * m01;
    const mu12 = m12 - 2 * yBar * m11 - xBar * m02 + 2 * yBar * yBar * m10;
    
    // 计算归一化中心矩
    const norm = (p, q) => Math.pow(m00, (p + q) / 2 + 1);
    const eta20 = mu20 / norm(2, 0);
    const eta02 = mu02 / norm(0, 2);
    const eta11 = mu11 / norm(1, 1);
    const eta30 = mu30 / norm(3, 0);
    const eta03 = mu03 / norm(0, 3);
    const eta21 = mu21 / norm(2, 1);
    const eta12 = mu12 / norm(1, 2);
    
    // 计算 Hu 矩
    const h1 = eta20 + eta02;
    const h2 = Math.pow(eta20 - eta02, 2) + 4 * Math.pow(eta11, 2);
    const h3 = Math.pow(eta30 - 3 * eta12, 2) + Math.pow(3 * eta21 - eta03, 2);
    const h4 = Math.pow(eta30 + eta12, 2) + Math.pow(eta21 + eta03, 2);
    const h5 = (eta30 - 3 * eta12) * (eta30 + eta12) * 
               (Math.pow(eta30 + eta12, 2) - 3 * Math.pow(eta21 + eta03, 2)) +
               (3 * eta21 - eta03) * (eta21 + eta03) * 
               (3 * Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2));
    const h6 = (eta20 - eta02) * 
               (Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2)) +
               4 * eta11 * (eta30 + eta12) * (eta21 + eta03);
    const h7 = (3 * eta21 - eta03) * (eta30 + eta12) * 
               (Math.pow(eta30 + eta12, 2) - 3 * Math.pow(eta21 + eta03, 2)) -
               (eta30 - 3 * eta12) * (eta21 + eta03) * 
               (3 * Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2));
    
    return [h1, h2, h3, h4, h5, h6, h7];
}
```

### 4. 投影特征

```javascript
/**
 * 提取投影特征
 * 
 * 复用第 7 章的投影计算函数
 * 
 * @param {ImageData} imageData - 输入图像（二值图）
 * @param {object} options - 配置选项
 * @returns {object} 投影特征对象
 */
function extractProjectionFeatures(imageData, options = {}) {
    const { normalize = true } = options;
    
    const { width, height, data } = imageData;
    
    // 计算水平投影（每行的前景像素数）
    const horizontalProjection = new Array(height).fill(0);
    // 计算垂直投影（每列的前景像素数）
    const verticalProjection = new Array(width).fill(0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx] < 128) { // 前景像素
                horizontalProjection[y]++;
                verticalProjection[x]++;
            }
        }
    }
    
    // 归一化
    if (normalize) {
        const maxH = Math.max(...horizontalProjection, 1);
        const maxV = Math.max(...verticalProjection, 1);
        
        for (let i = 0; i < height; i++) {
            horizontalProjection[i] /= maxH;
        }
        for (let i = 0; i < width; i++) {
            verticalProjection[i] /= maxV;
        }
    }
    
    return {
        horizontal: horizontalProjection,
        vertical: verticalProjection,
        combined: [...horizontalProjection, ...verticalProjection]
    };
}
```

### 5. 网格特征

```javascript
/**
 * 提取网格（分区）特征
 * 
 * @param {ImageData} imageData - 输入图像
 * @param {number} gridSize - 网格大小（如 4 表示 4×4）
 * @returns {number[]} 网格特征向量
 */
function extractZoneFeatures(imageData, gridSize = 4) {
    const { width, height, data } = imageData;
    
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);
    
    const features = [];
    
    for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
            let foregroundCount = 0;
            let totalCount = 0;
            
            const startX = gx * cellWidth;
            const startY = gy * cellHeight;
            const endX = gx === gridSize - 1 ? width : startX + cellWidth;
            const endY = gy === gridSize - 1 ? height : startY + cellHeight;
            
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = (y * width + x) * 4;
                    totalCount++;
                    if (data[idx] < 128) {
                        foregroundCount++;
                    }
                }
            }
            
            // 归一化为填充率
            features.push(totalCount > 0 ? foregroundCount / totalCount : 0);
        }
    }
    
    return features;
}
```

### 6. HOG 特征

```javascript
/**
 * 计算 HOG 特征
 * 
 * @param {ImageData} imageData - 输入图像（灰度图）
 * @param {object} options - 配置选项
 * @returns {number[]} HOG 特征向量
 */
function extractHOGFeatures(imageData, options = {}) {
    const {
        cellSize = 7,           // Cell 大小（像素）
        blockSize = 2,          // Block 包含的 Cell 数
        numBins = 9,            // 方向直方图的 bin 数
        unsigned = true         // 是否使用无符号梯度（0-180°）
    } = options;
    
    const { width, height, data } = imageData;
    
    // Step 1: 计算梯度
    const gradients = computeGradients(imageData);
    
    // Step 2: 计算每个 Cell 的直方图
    const numCellsX = Math.floor(width / cellSize);
    const numCellsY = Math.floor(height / cellSize);
    
    const cellHistograms = [];
    
    for (let cy = 0; cy < numCellsY; cy++) {
        for (let cx = 0; cx < numCellsX; cx++) {
            const histogram = new Array(numBins).fill(0);
            
            const startX = cx * cellSize;
            const startY = cy * cellSize;
            
            for (let y = startY; y < startY + cellSize && y < height; y++) {
                for (let x = startX; x < startX + cellSize && x < width; x++) {
                    const magnitude = gradients.magnitude[y * width + x];
                    let direction = gradients.direction[y * width + x];
                    
                    // 将方向转换到 [0, 180) 或 [0, 360)
                    if (unsigned) {
                        direction = direction < 0 ? direction + 180 : direction;
                        direction = direction >= 180 ? direction - 180 : direction;
                    } else {
                        direction = direction < 0 ? direction + 360 : direction;
                    }
                    
                    // 计算 bin 索引
                    const binWidth = unsigned ? 180 / numBins : 360 / numBins;
                    const bin = Math.floor(direction / binWidth) % numBins;
                    
                    // 投票（使用幅值作为权重）
                    histogram[bin] += magnitude;
                }
            }
            
            cellHistograms.push(histogram);
        }
    }
    
    // Step 3: Block 归一化
    const numBlocksX = numCellsX - blockSize + 1;
    const numBlocksY = numCellsY - blockSize + 1;
    
    const features = [];
    
    for (let by = 0; by < numBlocksY; by++) {
        for (let bx = 0; bx < numBlocksX; bx++) {
            const blockFeatures = [];
            
            // 收集 Block 内所有 Cell 的直方图
            for (let dy = 0; dy < blockSize; dy++) {
                for (let dx = 0; dx < blockSize; dx++) {
                    const cellIdx = (by + dy) * numCellsX + (bx + dx);
                    blockFeatures.push(...cellHistograms[cellIdx]);
                }
            }
            
            // L2 归一化
            const norm = Math.sqrt(
                blockFeatures.reduce((sum, val) => sum + val * val, 0) + 1e-6
            );
            
            features.push(...blockFeatures.map(v => v / norm));
        }
    }
    
    return features;
}

/**
 * 计算图像梯度（用于 HOG）
 */
function computeGradients(imageData) {
    const { width, height, data } = imageData;
    
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            // 使用简单差分计算梯度
            const idx = y * width + x;
            const left = data[((y) * width + (x - 1)) * 4];
            const right = data[((y) * width + (x + 1)) * 4];
            const up = data[((y - 1) * width + x) * 4];
            const down = data[((y + 1) * width + x) * 4];
            
            const gx = right - left;
            const gy = down - up;
            
            magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
            direction[idx] = Math.atan2(gy, gx) * 180 / Math.PI;
        }
    }
    
    return { magnitude, direction };
}
```

---

## 在 OCR 中的应用

### 完整特征提取流程

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     OCR 特征提取流程                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   输入：分割后的单个字符图像                                               │
│     ↓                                                                    │
│   Step 1: 预处理                                                         │
│   - 二值化（如果还不是）                                                   │
│   - 尺寸归一化（缩放到固定大小，如 28×28）                                 │
│   - 居中对齐（使质心在中心）                                               │
│     ↓                                                                    │
│   Step 2: 多类型特征提取                                                  │
│   - 统计特征（Hu 矩等）→ 7 维                                             │
│   - 投影特征（水平 + 垂直）→ 56 维                                        │
│   - 网格特征（4×4 分区）→ 16 维                                           │
│   - HOG 特征 → 324 维（可选）                                             │
│     ↓                                                                    │
│   Step 3: 特征拼接                                                        │
│   - 将所有特征拼接为一个向量                                               │
│     ↓                                                                    │
│   Step 4: 特征归一化                                                      │
│   - Min-Max 或 Z-Score 归一化                                             │
│     ↓                                                                    │
│   输出：特征向量 → 送入分类器（模板匹配/KNN/神经网络）                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 不同特征的适用场景

| 特征类型 | 维度 | 优点 | 缺点 | 适用场景 |
|----------|------|------|------|----------|
| 像素特征 | 高 | 信息完整 | 维度高、不鲁棒 | 深度学习输入 |
| 统计特征 | 低 | 紧凑、旋转不变 | 信息有损 | 快速粗分类 |
| 投影特征 | 中 | 捕获形状 | 对倾斜敏感 | 印刷体识别 |
| 网格特征 | 低 | 局部信息 | 精度有限 | 辅助特征 |
| HOG 特征 | 高 | 鲁棒、效果好 | 计算较慢 | 高精度识别 |

---

## 代码示例

### 文件说明

| 文件 | 说明 | 运行环境 |
|------|------|---------|
| `index.html` | 浏览器交互演示，可视化各种特征 | 浏览器 |
| `index.js` | Node.js 示例，算法实现详解 | Node.js |

### 运行方式

**浏览器演示（推荐）：**
```bash
open 11-feature-extraction/index.html
```

**Node.js 示例：**
```bash
cd 11-feature-extraction
node index.js
```

---

## 可复用模块

本章新增以下函数（已添加到 `shared/11-feature-extraction/`）：

| 函数 | 说明 |
|------|------|
| `extractPixelFeatures(imageData, options)` | 提取像素级特征 |
| `extractStatisticalFeatures(imageData)` | 提取基本统计特征 |
| `calculateRawMoment(imageData, p, q)` | 计算原始矩 |
| `calculateCentralMoments(imageData)` | 计算中心矩 |
| `calculateHuMoments(imageData)` | 计算 Hu 不变矩 |
| `extractProjectionFeatures(imageData, options)` | 提取投影特征 |
| `extractZoneFeatures(imageData, gridSize)` | 提取网格/分区特征 |
| `extractHOGFeatures(imageData, options)` | 提取 HOG 特征 |
| `normalizeFeatures(features, method)` | 特征归一化 |
| `extractCombinedFeatures(imageData, options)` | 提取组合特征 |
| `resizeImage(imageData, targetWidth, targetHeight)` | 图像尺寸归一化 |

---

## 数学公式总结

### 图像矩

| 类型 | 公式 | 作用 |
|------|------|------|
| 原始矩 | M_pq = Σ Σ x^p y^q I(x,y) | 基础计算 |
| 中心矩 | μ_pq = Σ Σ (x-x̄)^p (y-ȳ)^q I(x,y) | 平移不变 |
| 归一化中心矩 | η_pq = μ_pq / M00^((p+q)/2+1) | 尺度不变 |
| Hu 矩 | 由 η 的组合构成 | 旋转不变 |

### 归一化公式

| 方法 | 公式 | 特点 |
|------|------|------|
| Min-Max | x' = (x - min) / (max - min) | 缩放到 [0,1] |
| Z-Score | x' = (x - μ) / σ | 均值 0，标准差 1 |
| L2 归一化 | x' = x / \|\|x\|\|₂ | 单位向量 |

---

## 自测问题

学完本章后，你应该能回答以下问题：

1. 为什么需要特征提取？直接用原始像素有什么问题？
2. Hu 矩有什么特殊性质？为什么适合字符识别？
3. HOG 特征是如何计算的？有哪些关键参数？
4. 为什么需要对特征进行归一化？
5. 如何组合多种特征构建特征向量？

<details>
<summary>点击查看答案</summary>

1. **为什么需要特征提取**：
   - 原始像素维度高（28×28=784 维），计算量大
   - 原始像素对平移、旋转、缩放敏感
   - 原始像素没有语义信息，难以区分相似字符
   - 特征提取可以降维、提取本质信息、提高鲁棒性

2. **Hu 矩的特殊性质**：
   - Hu 矩是由归一化中心矩的非线性组合构成
   - 具有平移不变性（使用中心矩）
   - 具有尺度不变性（使用归一化）
   - 具有旋转不变性（组合方式保证）
   - 因此同一个字符不管大小、位置、旋转，Hu 矩都相近

3. **HOG 特征计算步骤**：
   - Step 1: 计算每个像素的梯度幅值和方向
   - Step 2: 将图像划分为 Cell（如 8×8 像素）
   - Step 3: 对每个 Cell 计算梯度方向直方图（9 个 bin）
   - Step 4: 将相邻 Cell 组成 Block，进行 L2 归一化
   - Step 5: 拼接所有 Block 的特征形成最终向量
   - 关键参数：Cell 大小、Block 大小、bin 数量

4. **为什么需要归一化**：
   - 不同特征的量纲和数值范围不同
   - 数值大的特征会主导分类结果
   - 归一化后所有特征对分类的贡献更均衡
   - 有利于梯度下降等优化算法的收敛

5. **组合特征的方法**：
   - 分别提取各类特征（统计、投影、网格、HOG）
   - 对每类特征分别归一化
   - 将所有特征拼接成一个长向量
   - 可以根据任务选择性地使用某些特征

</details>

---

## 下一步

学完本章后，继续学习 **12. 模板匹配**！你将学习如何使用特征向量进行字符识别的最简单方法——通过与标准模板比对来识别字符。
