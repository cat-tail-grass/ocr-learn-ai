# 11. 特征提取基础 (Feature Extraction)

## 学习目标

特征提取是将字符图像转换为可用于分类的数值向量的技术，是 OCR 识别的关键步骤。本章将帮助你掌握：

1. **特征的概念** - 理解什么是特征，为什么需要特征提取
2. **像素级特征** - 原始像素值作为特征
3. **统计特征** - 均值、方差、矩等统计量
4. **结构特征** - 投影特征、网格分区（轮廓与端点仅作方法概览）
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

## 输入约定与本章在 OCR 中的位置

输入是第 10 章分割后的单字符灰度图：RGBA 四通道，灰度要求 R=G=B，黑字白底。坐标 x 向右、y 向下，像素索引从 0 开始。形状统计用前景指示函数 `F(x,y)=1[gray<128]`；亮度均值/方差仍用灰度值。像素 `normalize` 模式黑色=0、白色=1，`binary` 模式前景=1、背景=0，二者不可混用。输出为固定顺序的特征向量，交给 12/13 章的模板匹配或 KNN。

`cropAndCenter` 按前景外接框裁剪、保持宽高比缩放、外接框居中，不是质心对齐。极窄边至少保留 1 像素，离散取整会轻微改变宽高比。空白图像没有定义良好的形状质心：代码的 `(0.5,0.5)` 和全零 Hu 仅为占位，识别页会明确提示空白。

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
│     cx = Σ(x × F(x,y)) / ΣF(x,y)                                         │
│     cy = Σ(y × F(x,y)) / ΣF(x,y)                                         │
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
│     M_pq = Σ Σ x^p × y^q × F(x, y)                                       │
│                                                                          │
│     常用矩：                                                              │
│     M00 = 面积（前景像素总数）                                            │
│     M10, M01 = 用于计算质心                                               │
│     M20, M02, M11 = 二阶矩，描述分布                                      │
│                                                                          │
│  2. 中心矩（Central Moments）—— 平移不变                                  │
│     μ_pq = Σ Σ (x - x̄)^p × (y - ȳ)^q × F(x, y)                          │
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
│  7×7 字符 A（# 为前景，. 为背景）：
  ...#...  水平计数 1
  ..#.#..           2
  .#...#.           2
  .#####.           5
  .#...#.           2
  #.....#           2
  #.....#           2
  垂直计数：[2,3,2,2,2,3,2]；两个投影的和都等于 16。
  默认分别除以各自最大计数：水平除以 5，垂直除以 3。
  这不是概率分布，不要求向量和为 1。

  作为特征向量：                                                           │
│  • 水平投影：高度维向量（如 28 维）                                        │
│  • 垂直投影：宽度维向量（如 28 维）                                        │
│  • 合并：56 维特征向量                                                    │
│                                                                          │
│  优点：                                                                   │
│  • 捕获字符的轮廓形状                                                     │
│  • 对小幅度变形有一定容忍度                                                │
│  • 使用与第 7 章一致的行/列计数定义                                         │
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
│  ┌─────────────┐  中心差分  ┌─────────────┐                            │
│  │  灰度图像   │ ─────────→  │ 梯度幅值 G  │                            │
│  │             │ [-1,0,1]      │ 梯度方向 θ  │                            │
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
│  │统计+Hu  │   │投影特征 │   │网格特征 │   │HOG特征  │                  │
│  │ 6+7 维  │   │ 56 维   │   │ 16 维   │   │ 324 维  │                  │
│  │(13 维)  │   │(水平+   │   │(4×4分区)│   │(梯度直  │                  │
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
│                    │ n = 409 维        │                                 │
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

### 9. 可手算的矩、HOG 与维度核验

三像素 L：`F(0,0)=F(1,0)=F(0,1)=1`，其余为 0。则 `M00=3`，`M10=M01=1`，质心 `(1/3,1/3)`；`μ20=μ02=2/3`，`μ11=-1/3`。二阶归一化分母为 `M00²=9`，所以 `η20=η02=2/27`、`η11=-1/27`，得到 `h1=4/27≈0.148148`、`h2=4/729≈0.005487`。统计向量中的质心还要分别除以图像宽、高，而计算中心矩必须使用像素坐标的质心。

尺度归一化为什么是 `(p+q)/2+1`：连续二维图形按 `s>0` 等比例缩放时，面积 `M00` 乘 `s²`，坐标 p+q 次幂再乘 `s^(p+q)`，故 `μpq` 乘 `s^(p+q+2)`。用 `M00^((p+q)/2+1)` 正好抵消。非等比例拉伸和灰度强度乘常数不属于这个结论。

栅格反例：全黑 `n×n` 正方形的 `h1=(n²-1)/(6n²)`，4×4 得 `0.15625`，8×8 得 `0.1640625`，并不完全相等。保留像素集合的整数平移、90°旋转可更精确保持；任意旋转/重采样只有近似性质。前 6 个 Hu 值对镜像不变，第 7 个变号。Hu 不保证形状可唯一恢复，也不能保证视觉相似的字符具有更小的欧氏距离。[OpenCV HuMoments](https://docs.opencv.org/4.x/d3/dc0/group__imgproc__shape.html)

本章 Hu 对数映射为 `h=0 → 0`，否则 `-sign(h)·log10(|h|+1e-10)`。这是带 epsilon 的教学映射：极小非零项趋近 ±10，与恰为 0 的映射不连续，可能放大数值噪声，不能把对数距离当作形状相似的保证。默认组合向量直接拼接，没有自动逐块均衡；Hu 分量可能占主要权重。要改变块权重必须在验证集上选择。

HOG 梯度例：`I(x,y)=30+3x+y` 的内点 `Gx=6,Gy=2`，幅值 `√40`，角度约 `18.435°`。9 个无符号 bin 宽 20°，按左闭右开区间投到 `[0°,20°)`。7×7 图的边界梯度为 0，25 个内点给该 bin 总投票 `25√40≈158.114`。改成 `30+5x+2y` 后角度约 `21.801°`，整票跳到 `[20°,40°)`，这正是硬分箱对小角度变化敏感的反例。负角度按模 180°映射，180°回到 0°；有符号模式改用 360°。

这是**教学版 HOG**：中心差分、单方向 bin 投票、单 cell 空间归属、2×2 cell 的 L2 归一化（分母 `√(Σv²+1e-6)`），block 步长 1 cell。没有方向/空间插值、Gaussian 加权和 L2-Hys 截断；不能声称完整复现 Dalal–Triggs。尺寸不能整除 cellSize 时，右/下残余条带不组成 cell；放不下一个 block 则返回空向量。参数必须为正整数。[Dalal–Triggs 原论文](https://lear.inrialpes.fr/people/triggs/pubs/Dalal-cvpr05.pdf)

一般 HOG 维度为 `(⌊W/c⌋-b+1)(⌊H/c⌋-b+1)b²B`（两个括号均为正时）；W=H=28、c=7、b=2、B=9 得 324。一个 block 是 36 维，前 18 项只是一半。默认组合不含 HOG：`6+7+56+16=85`；Node 的 HOG 组合实验为 `85+324=409`。

### 10. 单样本归一化与逐维标准化不是一回事

`normalizeFeatures([10,50,100,200,500], 'minmax')` 在**这一个向量内部**取最小/最大，结果 `[0,0.081633,0.183673,0.387755,1]`；`zscore` 也默认在向量内计算均值和总体标准差。L2 只改变整体长度，例如 `[3,4]→[0.6,0.8]`，不会改变两维之比。零向量保持零；常量向量的 minmax/zscore 为零（除数为 0 时按 1 处理）。

如果要让不同特征维度可比，常用的是在**训练集的每一列**拟合 `μ_j,σ_j`，然后对验证/测试/线上样本复用 `x'_j=(x_j-μ_j)/σ_j`。当前辅助函数没有拟合这种逐列变换；不要把它与 StandardScaler 混淆，也不要用整份数据（含测试集）拟合缩放参数。[scikit-learn 数据预处理](https://scikit-learn.org/stable/modules/preprocessing.html)

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
        normalize = true,
        binary = false
    } = options;
    
    const { width, height, data } = imageData;
    const features = [];
    
    // 遍历所有像素，提取灰度值
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = data[idx]; // 假设已是灰度图（R=G=B）

            if (binary) {
                // 二值特征：前景为 1，背景为 0
                features.push(gray < 128 ? 1 : 0);
            } else if (normalize) {
                // 归一化到 [0, 1]
                features.push(gray / 255);
            } else {
                features.push(gray);
            }
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
            
            if (gray < 128) { // 前景像素（黑色）
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
        mean: mean / 255,                    // 归一化均值 [0, 1]
        variance: variance / (255 * 255),    // 归一化方差
        stdDev: stdDev / 255,                // 归一化标准差
        fillRatio,                           // 填充率（前景像素占比）
        centroidX,                           // 归一化质心 X [0, 1]
        centroidY,                           // 归一化质心 Y [0, 1]
        foregroundCount,                     // 前景像素数量
        aspectRatio: width / height          // 宽高比
    };
}
```

### 3. 图像矩

```javascript
/**
 * 计算图像的原始矩
 * 
 * 原理：M_pq = Σ Σ x^p × y^q × F(x, y)
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
function calculateCentralMoments(imageData) {
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
    
    // 直接按定义累加偏移后的坐标，避免 M30 - 3*xBar*M20 等大数相减。
    // 例如四个像素整体平移到 x=99900 后，展开式可能把 mu30=0 算成 -1。
    const mu00 = m00;
    const mu10 = 0;
    const mu01 = 0;
    let mu20 = 0, mu02 = 0, mu11 = 0;
    let mu30 = 0, mu03 = 0, mu21 = 0, mu12 = 0;
    const { width, height, data } = imageData;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4] >= 128) continue;
            const dx = x - xBar;
            const dy = y - yBar;
            mu20 += dx * dx;
            mu02 += dy * dy;
            mu11 += dx * dy;
            mu30 += dx * dx * dx;
            mu03 += dy * dy * dy;
            mu21 += dx * dx * dy;
            mu12 += dx * dy * dy;
        }
    }

    return {
        // 原始矩
        m00, m10, m01, m20, m02, m11, m30, m03, m21, m12,
        // 质心
        xBar, yBar,
        // 中心矩
        mu00, mu10, mu01, mu20, mu02, mu11, mu30, mu03, mu21, mu12
    };
}

function calculateHuMoments(imageData) {
    const moments = calculateCentralMoments(imageData);
    const { m00, mu20, mu02, mu11, mu30, mu03, mu21, mu12 } = moments;

    // 避免除以零
    if (m00 === 0) {
        return [0, 0, 0, 0, 0, 0, 0];
    }
    
    // 计算归一化中心矩
    // η_pq = μ_pq / M00^((p+q)/2 + 1)
    const norm = (p, q) => Math.pow(m00, (p + q) / 2 + 1);

    const eta20 = mu20 / norm(2, 0);
    const eta02 = mu02 / norm(0, 2);
    const eta11 = mu11 / norm(1, 1);
    const eta30 = mu30 / norm(3, 0);
    const eta03 = mu03 / norm(0, 3);
    const eta21 = mu21 / norm(2, 1);
    const eta12 = mu12 / norm(1, 2);
    
    // 计算 Hu 矩（7 个不变矩）
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
 * 沿用第 7 章的投影定义，此处独立提取归一化特征
 * 
 * @param {ImageData} imageData - 输入图像（二值图）
 * @param {object} options - 配置选项
 * @returns {object} 投影特征对象
 */
function extractProjectionFeatures(imageData, options = {}) {
    const { normalize = true } = options;
    
    const { width, height, data } = imageData;
    
    // 初始化投影数组
    const horizontalProjection = new Array(height).fill(0);
    const verticalProjection = new Array(width).fill(0);
    
    // 遍历所有像素，计算投影
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx] < 128) { // 前景像素
                horizontalProjection[y]++;
                verticalProjection[x]++;
            }
        }
    }
    
    // 归一化（除以最大值）
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
        horizontal: horizontalProjection,    // 水平投影（高度维）
        vertical: verticalProjection,        // 垂直投影（宽度维）
        combined: [...horizontalProjection, ...verticalProjection]  // 合并
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
    
    // 计算每个网格单元的尺寸
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;
    
    const features = [];
    
    // 遍历每个网格单元
    for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
            let foregroundCount = 0;
            let totalCount = 0;
            
            // 计算当前网格的边界
            const startX = Math.floor(gx * cellWidth);
            const startY = Math.floor(gy * cellHeight);
            const endX = Math.floor((gx + 1) * cellWidth);
            const endY = Math.floor((gy + 1) * cellHeight);
            
            // 统计网格内的前景像素
            for (let y = startY; y < endY && y < height; y++) {
                for (let x = startX; x < endX && x < width; x++) {
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
function computeHOGCells(imageData, options = {}) {
    const {
        cellSize = 7,           // Cell 大小（像素）
        numBins = 9,            // 方向直方图的 bin 数
        unsigned = true         // 是否使用无符号梯度（0-180°）
    } = options;
    
    const { width, height } = imageData;
    
    for (const [name, value] of Object.entries({ cellSize, numBins })) {
        if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} 必须是正整数`);
    }

    // Step 1: 计算梯度
    const gradients = computeImageGradients(imageData);
    
    // Step 2: 计算 Cell 数量
    const numCellsX = Math.floor(width / cellSize);
    const numCellsY = Math.floor(height / cellSize);
    
    // Step 3: 计算每个 Cell 的直方图
    const cellHistograms = [];
    const binWidth = unsigned ? 180 / numBins : 360 / numBins;
    
    for (let cy = 0; cy < numCellsY; cy++) {
        for (let cx = 0; cx < numCellsX; cx++) {
            const histogram = new Array(numBins).fill(0);
            
            const startX = cx * cellSize;
            const startY = cy * cellSize;
            
            for (let y = startY; y < startY + cellSize && y < height; y++) {
                for (let x = startX; x < startX + cellSize && x < width; x++) {
                    const idx = y * width + x;
                    const mag = gradients.magnitude[idx];
                    let dir = gradients.direction[idx];
                    
                    // 将方向转换到正确的范围
                    if (unsigned) {
                        // 无符号：将 [-180, 180] 映射到 [0, 180]
                        if (dir < 0) dir += 180;
                        if (dir >= 180) dir -= 180;
                    } else {
                        // 有符号：将 [-180, 180] 映射到 [0, 360]
                        if (dir < 0) dir += 360;
                    }
                    
                    // 计算 bin 索引
                    const bin = Math.floor(dir / binWidth) % numBins;
                    
                    // 使用幅值作为投票权重
                    histogram[bin] += mag;
                }
            }
            
            cellHistograms.push(histogram);
        }
    }
    
    return { histograms: cellHistograms, numCellsX, numCellsY, cellSize, numBins, binWidth, unsigned, gradients };
}

function extractHOGFeatures(imageData, options = {}) {
    const { blockSize = 2 } = options;
    if (!Number.isInteger(blockSize) || blockSize <= 0) throw new Error('blockSize 必须是正整数');
    const { histograms: cellHistograms, numCellsX, numCellsY } = computeHOGCells(imageData, options);
    // Step 4: Block 归一化
    const numBlocksX = numCellsX - blockSize + 1;
    const numBlocksY = numCellsY - blockSize + 1;
    
    if (numBlocksX <= 0 || numBlocksY <= 0) {
        return [];
    }

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
 * 计算图像梯度（用于 HOG；图像边界置零）
 */
function computeImageGradients(imageData) {
    const { width, height, data } = imageData;
    
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            // 边界处理：边界像素梯度设为 0
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                magnitude[idx] = 0;
                direction[idx] = 0;
                continue;
            }

            // 计算 x 和 y 方向的梯度
            const left = data[((y) * width + (x - 1)) * 4];
            const right = data[((y) * width + (x + 1)) * 4];
            const up = data[((y - 1) * width + x) * 4];
            const down = data[((y + 1) * width + x) * 4];
            
            const gx = right - left;
            const gy = down - up;
            
            magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
            direction[idx] = Math.atan2(gy, gx) * 180 / Math.PI; // 转换为角度
        }
    }
    
    return { magnitude, direction, width, height };
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
│   - 外接框居中（质心不一定在中心）                                               │
│     ↓                                                                    │
│   Step 2: 多类型特征提取                                                  │
│   - 基本统计 6 维 + Hu 矩 7 维                                             │
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
| 统计特征 | 低 | 紧凑；仅 Hu 部分具旋转不变性 | 信息有损 | 快速粗分类 |
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

**首次安装与浏览器演示（项目根目录）：**
```bash
npm install
npm start
```
浏览器打开 `http://127.0.0.1:4173/11-feature-extraction/`。也可直接打开本章 HTML；共享脚本按相对路径加载，无需构建。

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
| 原始矩 | M_pq = Σ Σ x^p y^q F(x,y) | 基础计算 |
| 中心矩 | μ_pq = Σ Σ (x-x̄)^p (y-ȳ)^q F(x,y) | 平移不变 |
| 归一化中心矩 | η_pq = μ_pq / M00^((p+q)/2+1) | 尺度不变 |
| Hu 矩 | 由 η 的组合构成 | 旋转不变 |

### 归一化公式

| 方法 | 公式 | 特点 |
|------|------|------|
| Min-Max | x' = (x - min) / (max - min) | 缩放到 [0,1] |
| Z-Score | x' = (x - μ) / σ | 均值 0，标准差 1 |
| L2 归一化 | x' = x / \|\|x\|\|₂ | 单位向量 |

---

## 知识点与三入口对应

| 知识点 | 文档位置 | HTML 实验 | Node 实验/函数 |
|---|---|---|---|
| 统计量与前景约定 | 统计特征、输入约定 | 统计值与归一化图 | 2 / extractStatisticalFeatures |
| 原始/中心/归一化矩、Hu | 图像矩、手算核验 | 7 个对数 Hu 值 | 3 / calculateCentralMoments、calculateHuMoments |
| 投影与网格 | 结构特征 | 行列投影、4×4 填充率 | 4–5 |
| 梯度、硬分箱、block | HOG、手算核验 | 梯度幅值、真实 cell 直方图 | 6 / computeHOGCells、extractHOGFeatures |
| 归一化与组合维度 | 特征构建、归一化范围 | 85 维组合与匹配 | 7–9；HOG 组合为 409 维 |

浏览器与 Node 都直接调用 `shared/11-feature-extraction/index.js`；浏览器输入使用 Arial 字体/手绘，Node 使用几何字符，所以不同输入的距离不能横向视为同一次实验结果。

## 排障

- 同一字符略移动后特征变化大：像素/投影/HOG 不是平移不变的；先核对裁剪、画布坐标和尺寸。中心矩使用直接中心化累加，避免大坐标原始矩展开时的大数相消。
- 0/O 的 Hu 距离反而比 0/1 大：看原始矩、零附近项和笔画厚度；Hu 特征不是视觉相似性的度量保证。
- 组合特征增加后更差：维度不等于区分能力；检查特征冗余、Hu 对数尺度和验证集表现。
- HOG 图方向似乎与笔画垂直：梯度方向是法向，不是边缘切向。本页线段显示投票区间中点。

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
   - 合适的特征可以降维、提取结构、提高特定扰动下的稳定性；不是所有特征都降维或旋转不变

2. **Hu 矩的特殊性质**：
   - Hu 矩是由归一化中心矩的非线性组合构成
   - 具有平移不变性（使用中心矩）
   - 具有尺度不变性（使用归一化）
   - 具有旋转不变性（组合方式保证）
   - 等比例缩放/旋转不变性以连续图形为前提；栅格化、噪声、裁剪会改变结果
   - 镜像改变第 7 项符号；旋转不变性也会丢失区分 6/9 等字符所需的方向

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
   - 逐维标准化或块权重能调节维度贡献；单向量 L2 不会均衡各维的相对大小
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

## 参考来源

- [OpenCV Moments 定义](https://docs.opencv.org/4.x/d8/d23/classcv_1_1Moments.html)：原始矩、中心矩、归一化矩。
- [OpenCV HuMoments](https://docs.opencv.org/4.x/d3/dc0/group__imgproc__shape.html)：7 个不变量及栅格化/镜像边界。
- [Dalal & Triggs, CVPR 2005](https://lear.inrialpes.fr/people/triggs/pubs/Dalal-cvpr05.pdf)：标准 HOG 设计；本章明确为简化实现。
- [scikit-learn 预处理](https://scikit-learn.org/stable/modules/preprocessing.html)：逐维标准化与逐样本归一化。
