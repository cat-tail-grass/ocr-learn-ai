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

第 10 章输出字符框，本章取出其中一个字符，把它转换为一组有固定含义的数字。第 12、13 章再用这些数字与已知字符比较。**特征提取负责描述，分类器负责决定类别**；这一章算出向量，还没有识别出字符。

输入是单字符灰度 RGBA 图，黑字白底，R、G、B 三个通道相同。`W`、`H` 是宽、高；坐标 `(x,y)` 从左上角 `(0,0)` 开始，x 向右、y 向下。读取 R 就能得到灰度，透明度 A 不参与这里的形状统计。

我们反复用一个只有三个黑像素的小 L 形状手算：

```text
灰度 I(x,y)       前景指示 F(x,y)
0    0            1 1
0  255            1 0
```

`I` 保存亮度，0 黑、255 白；`F` 只回答“这里有没有墨迹”，所以灰度小于 128 时 F=1，否则 F=0。**黑色的亮度是 0，但统计形状时必须记作 1 次，而不能让它乘以 0 后消失。**

## 核心概念

### 1. 特征与特征向量：一张有固定栏目顺序的数字记录

一个字符可以用“墨迹占比、重心位置、每行笔画数量”等描述。每个描述是一个特征，按事先约定的顺序装进数组，就是**特征向量**。“维度”只是在数这个数组有多少项：28×28 图按像素展开后有 784 维，四个分区各统计一个比例则有 4 维。

向量 `[0.75,0.167,0.167]` 单独看没有意义；规定顺序是 `[填充率,相对质心x,相对质心y]` 后，才知道每个数描述什么。模板和待识别图必须使用相同的列顺序、单位、长度与预处理，否则看起来都叫“特征向量”，相减却是在比较不同事物。

合适的特征可以减少计算量或让某些形变影响更小，但不保证总是降维或更准确。比如对旋转保持不变的特征，也可能丢掉区分 6 和 9 所需的方向信息。

### 2. 先看各种特征分别保留了什么

| 类型 | 具体记录 | 保留的信息与代价 |
|---|---|---|
| 像素特征 | 每个位置的灰度或前景标记 | 位置细节多，也容易受平移影响 |
| 统计特征 | 均值、方差、填充率、质心 | 很紧凑，但不同形状可能统计值相同 |
| 图像矩与 Hu 矩 | 墨迹相对原点、重心的分布 | 可组合出对部分变换更稳定的描述 |
| 投影、网格 | 每行、每列或每块有多少墨迹 | 保留粗略空间结构，丢失块内细节 |
| HOG | 小区域内亮度变化的方向分布 | 描述局部边缘，需要选区域与方向划分 |

轮廓方向、笔画端点和交叉点数量也是结构特征，但通常需要轮廓或骨架等额外处理，本章不实现这些方法。接下来先从最容易核对的像素和统计量开始。

### 3. 像素特征：按行展开，数值含义不要翻转

按从上到下、每行从左到右读取小 L 的灰度，得到 `[0,0,0,255]`。一张 W×H 的图只取每个像素一个亮度，因此有 WH 维，不是 RGBA 的 4WH 维。

`extractPixelFeatures` 提供两种常用表示：

| 模式 | 计算 | 小 L 的结果 | 黑色的值 |
|---|---|---|---:|
| `normalize: true` | 每个灰度除以 255 | `[0,0,0,1]` | 0 |
| `binary: true` | 灰度小于 128 记 1，其余记 0 | `[1,1,1,0]` | 1 |

它们表达的对象相同，数字方向却相反。两种选项同时开启时，代码优先采用 binary。一个模板用亮度、另一个输入用前景标记，就不能直接比较。

图像大小也必须统一：28×28 得到 784 项，14×14 得到 196 项。降采样能减少维度，但细笔画可能丢失；像素展开本身不创造平移或旋转不变性。把同一笔画移动一格，许多向量位置都会变化。

### 4. 基本统计量：把整幅图压缩成几个数

#### 均值、方差、标准差描述亮度

设 N=WH 是总像素数，`pᵢ` 是按顺序读出的第 i 个灰度值，μ 是平均灰度：

```text
均值 μ = Σ(i=1…N) pᵢ / N
方差 σ² = Σ(i=1…N) (pᵢ−μ)² / N
标准差 σ = √(σ²)
```

均值描述整体亮暗；方差描述值离均值有多分散；标准差开平方后，与灰度值回到相同单位。这里的 σ 是统计标准差，不是去噪核的参数。

为了方便手算，把小 L 的亮度先除以 255，得到 `[0,0,0,1]`。均值为 0.25，方差为：

```text
[(0−0.25)²+(0−0.25)²+(0−0.25)²+(1−0.25)²] / 4
= (0.0625+0.0625+0.0625+0.5625) / 4
= 0.1875
标准差 ≈ 0.433013
```

共享函数先对原灰度计算，再将均值除以 255、方差除以 255²、标准差除以 255，返回值与上面先缩放后计算一致。

#### 填充率与质心描述墨迹位置

小 L 有 3 个前景像素、4 个总像素，所以填充率是 `3/4=0.75`。形状质心只平均三个黑像素的坐标：

```text
黑像素坐标：(0,0)、(1,0)、(0,1)
质心 x̄ = (0+1+0)/3 = 1/3
     ȳ = (0+0+1)/3 = 1/3
```

`x̄,ȳ` 读作 x、y 的平均值，与第 09 章的质心含义相同。统计向量为了表示相对位置，再分别除以宽和高；本图 W=H=2，所以返回 `centroidX=centroidY=1/6≈0.166667`。

默认统计向量按 `[mean,variance,stdDev,fillRatio,centroidX,centroidY]` 排列，共 **6 维**。前景数量、宽高比也在统计对象中，但不会自动加入这六项。后面计算中心矩要用像素单位的 `(1/3,1/3)`，不能误拿除以宽高后的 `(1/6,1/6)`。

### 5. 图像矩：让位置参与统计 ⭐

#### 原始矩：同一批墨迹，换一种坐标权重来求和

面积只数“有几个点”，没有说明这些点靠哪边。**矩（moment）**把坐标的幂作为权重，使求和能描述位置和分布。

```text
M_pq = Σx Σy x^p × y^q × F(x,y)
```

p、q 是非负整数，分别表示 x、y 取几次幂；它们不是像素下标，`p+q` 叫矩的阶数。双重求和遍历整张图，F 让背景贡献为 0。某一坐标的幂为 0 时，这一因子取 1，因此 M00 每个前景恰好贡献 1。

| 矩 | 每个前景贡献什么 | 小 L 的结果 | 能说明什么 |
|---|---|---:|---|
| M00 | 1 | 3 | 前景面积 |
| M10 | x | 1 | 所有前景横坐标之和 |
| M01 | y | 1 | 所有前景纵坐标之和 |
| M20 | x² | 1 | 横向位置的平方和 |
| M02 | y² | 1 | 纵向位置的平方和 |
| M11 | x×y | 0 | 横纵位置的联合分布 |

于是质心自然得到 `x̄=M10/M00,ȳ=M01/M00`。同一个形状向右移动后，x 变大，原始矩也会改变；若希望忽略移动，需要让坐标相对形状自身计算。

#### 中心矩：把原点搬到墨迹重心

令 μ_pq 表示中心矩，将公式中的 x、y 换成到质心的偏移：

```text
μ_pq = Σx Σy (x−x̄)^p × (y−ȳ)^q × F(x,y)
```

μ_pq 的 μ 是中心矩的名称，前面不带下标的 μ 才表示亮度均值。它们都常写成希腊字母 mu，但这里统计的对象不同。

小 L 的三个点相对质心的偏移为：

| 原坐标 | `dx=x−1/3` | `dy=y−1/3` |
|---|---:|---:|
| `(0,0)` | −1/3 | −1/3 |
| `(1,0)` | 2/3 | −1/3 |
| `(0,1)` | −1/3 | 2/3 |

```text
μ20 = (−1/3)²+(2/3)²+(−1/3)² = 2/3
μ02 = (−1/3)²+(−1/3)²+(2/3)² = 2/3
μ11 = (−1/3)(−1/3)+(2/3)(−1/3)+(−1/3)(2/3) = −1/3
```

如果把整个 L 向右移动 10 格，它的质心也向右移 10 格，三个 dx 不变，因此中心矩保持不变。μ20、μ02 可以理解为墨迹相对重心的横向、纵向展开程度，μ11 则反映两个方向偏移的共同变化。共享代码直接累加这些偏移，避免用大原始矩相减时损失精度。

#### 归一化中心矩：再抵消等比例缩放的影响

形状整体放大后，坐标偏移和墨迹面积都增加了。用 η_pq（eta）表示除去相应面积尺度后的中心矩：

```text
η_pq = μ_pq / M00^((p+q)/2+1)
```

对二阶矩，p+q=2，分母就是 `M00²`。小 L 的面积是 3，因此分母为 9，得到 `η20=η02=2/27`、`η11=−1/27`。

分母的指数来自二维缩放关系：连续图形的长、宽都放大 s 倍，面积乘 s²，坐标的 p+q 次幂再乘 `s^(p+q)`，所以中心矩共乘 `s^(p+q+2)`。面积的 `((p+q)/2+1)` 次幂恰好也乘这个量，除法将它抵消。它针对等比例几何缩放，不包含非等比例拉伸或随意改变灰度权重。

#### Hu 矩：把方向会变的分量组合起来

旋转时，横向展开程度可能转到纵向，单独的 η20、η02 会变化；把它们按特定方式组合，可以保留一些与旋转无关的形状量。Hu 矩就是由二阶、三阶归一化中心矩构造的七个数。

```text
h1 = η20+η02
h2 = (η20−η02)²+4η11²
h3 = (η30−3η12)²+(3η21−η03)²
```

h1 把横纵展开程度相加；h2、h3 等进一步组合方向相关项，使旋转造成的变化能够相互抵消。全部七项的计算保留在下面 `calculateHuMoments` 代码中；先理解数据从哪里来，再逐项对照表达式。

代入小 L：

```text
h1 = 2/27+2/27 = 4/27 ≈ 0.148148
h2 = 0²+4×(−1/27)² = 4/729 ≈ 0.005487
```

这条链是 `前景坐标 → 原始矩与质心 → 中心矩 → 归一化中心矩 → 七个 Hu 值`，每一层都在上一层基础上去除一种干扰。各类矩的定义可对照 [OpenCV Moments](https://docs.opencv.org/4.x/d8/d23/classcv_1_1Moments.html)。

#### “不变”在像素图上为什么只是近似

连续图形的结论不意味着任意缩放、旋转后的像素值都一样。重采样会增删边缘像素，尤其在小图上影响很大。例如全黑 n×n 正方形的 `h1=(n²−1)/(6n²)`，4×4 得 0.15625，8×8 得 0.1640625，已经不完全相同。

不发生裁剪的整数平移和保持像素集合的 90° 旋转可以更精确地保持这些量。镜像时前六项不变，第七项变号。Hu 也不是形状的唯一身份证：不同字符可能相近，视觉相近的字符也未必有更小的 Hu 欧氏距离。[OpenCV HuMoments](https://docs.opencv.org/4.x/d3/dc0/group__imgproc__shape.html)

#### 为什么实验还显示“对数 Hu”

某些 Hu 值可能是 0.1，另一些可能小到 0.0000001。对数把相差许多数量级的值压到更易查看的范围。本章对一个 Hu 分量 h 使用：

```text
h=0 时输出 0；否则输出 −sign(h)×log10(|h|+ε)
ε=1e−10，也就是 0.0000000001
```

`sign(h)` 保留原来的正负信息，`|h|` 取绝对值，ε 是防止对极小数取对数的微小补偿。例如 h=0.01，映射约为 2。由于恰好为 0 时单独返回 0，而极小非零值会接近 ±10，这个教学映射在零附近并不连续，可能放大数值噪声。阅读实验时应区分原始 Hu 与对数 Hu，不能把对数距离直接当成可靠的视觉相似度。

### 6. 结构特征：墨迹分布在哪些行、列和小块

#### 投影特征

第 10 章用投影切字，本章用同一投影描述已经切出来的一个字。小 L 的水平计数是 `[2,1]`，垂直计数也是 `[2,1]`，两组各自的和都等于前景数 3。

默认把每组除以自己的最大计数，得到水平 `[1,0.5]`、垂直 `[1,0.5]`，再按“水平在前、垂直在后”拼为 `[1,0.5,1,0.5]`。除以最大值用于比较轮廓的相对形状，不是构造概率分布，所以向量之和不必为 1。

```text
再看一个 7×7 的 A（# 是前景）：
...#...   水平计数 1
..#.#..            2
.#...#.            2
.#####.            5
.#...#.            2
#.....#            2
#.....#            2
垂直计数：[2,3,2,2,2,3,2]
```

共 16 个前景点，两个计数数组的和都是 16。水平除以 5、垂直除以 3。W×H 图输出 H+W 维；28×28 就是 56 维。投影丢失了某些位置组合信息，不同字符可能有相同投影，平移也会改变峰值所在下标。

#### 网格特征（Zone Features）

将字符图划分成固定的几行、几列小块，每块计算前景占比。比如下面 4×4 图分为 2×2 个网格，每格包含 2×2=4 个像素：

```text
##|..      左上 3/4，右上 0/4
#.|..
--+--
..|##      左下 0/4，右下 3/4
..|#.
```

按网格从上到下、从左到右展开，结果是 `[0.75,0,0,0.75]`。它表达“墨迹集中在左上和右下”，不再记录每块里黑点的精确位置。

`gridSize=4` 表示横向四格、纵向四格，一共产生 16 维，不是每格四像素。28×28 图每格恰好 7×7=49 个像素；某格有 12 个黑点，对应特征为 `12/49≈0.245`。尺寸无法整除网格数时，代码按比例边界取整，各格用实际像素数作分母；空格返回 0。

### 7. HOG：统计小区域里“往哪个方向变亮” ⭐

HOG 是 Histogram of Oriented Gradients，即方向梯度直方图。它借用第 08 章的梯度：一个小区域里若有很多相近方向的亮度变化，往往说明存在相应方向的笔画边界。这里统计的是梯度法向，不是直接统计笔画延伸方向。

#### 第一步：求梯度，保留强度与方向

本章使用不除以 2 的中心差分：

```text
Gx = I(x+1,y)−I(x−1,y)
Gy = I(x,y+1)−I(x,y−1)
幅值 M=√(Gx²+Gy²)，方向 θ=atan2(Gy,Gx)
```

例如一小块灰度按 `I(x,y)=30+3x+y` 变化。x 每增加 1，亮度增加 3，跨两格的 Gx=6；y 每增加 1，亮度增加 1，所以 Gy=2。幅值为 `√40≈6.325`，方向约 18.435°。共享实现将最外一圈的梯度设为 0。

#### 第二步：划 cell，再把方向放进 bin

**cell** 是一块固定大小的局部区域，本章默认 7×7 像素。**bin** 是统计某个角度范围的格子。默认把 0° 到 180° 分为 9 格，每格宽 20°：`[0°,20°)`、`[20°,40°)`……`[160°,180°)`。

只看 180° 的方向范围称为“无符号方向”：向右变亮与向左变亮相差 180°，被计入相同方向轴；负角加 180°，180° 回到 0°。选择有符号模式时则统计 0° 到 360°。

刚才方向 18.435° 落在第一格，但不是给它加 1，而是加幅值 √40。这样强边界比轻微波动贡献更大。若一张 7×7 图都符合该线性亮度公式，去掉边界后有 25 个内点，第一格累计 `25√40≈158.114`，其他格为 0。

本章把每个像素整票投给一个方向格，叫**硬分箱**。将亮度变化改为 `30+5x+2y`，方向约变为 21.801°，票就整份跳到第二格。这说明方向稍有变化，统计也可能跨格跳变；更完整的 HOG 可把票分配给相邻方向，本章没有实现这种插值。

#### 第三步：把相邻 cell 组成 block，统一长度

一个 cell 得到一个 9 维直方图。把相邻 2×2 个 cell 拼起来，得到 36 个数，这一组叫 **block**。对这一组做 L2 归一化，也就是每项除以整组向量长度：

```text
block 中某项 vᵢ 的新值 = vᵢ / √(Σj vⱼ² + 1e−6)
```

i、j 是这 36 项的下标；`1e−6` 是避免全零 block 除以 0 的微小值。用短向量 `[3,4]` 类比，长度是 5，归一化后约为 `[0.6,0.8]`。若对比度变化把两项都变为两倍 `[6,8]`，归一化结果仍接近 `[0.6,0.8]`，因此能减轻整体幅度改变的影响，但不会抵消任意光照变化。

#### 第四步：滑动 block，数清最终维度

28×28 图、7×7 像素一个 cell，横纵各有 4 个 cell。2×2 cell 的 block 每次移动 1 个 cell，可以从横向第 0、1、2 个 cell 起步，纵向也有 3 个起点：

```text
cell 数量：4×4
block 数量：(4−2+1)×(4−2+1)=3×3=9
每个 block：2×2×9=36 维
拼接全部 block：9×36=324 维
```

相邻 block 会重叠，同一个 cell 可参与多组局部归一化，这是有意设计的。通式为 `(⌊W/c⌋−b+1)(⌊H/c⌋−b+1)b²B`：c 是 cell 像素边长，b 是每个 block 的 cell 边长，B 是方向格数量；`⌊ ⌋` 表示向下取整，且两个括号都必须为正。

W、H 不能整除 c 时，右侧、下侧剩余条带不组成 cell；放不下一个 block，就返回空向量。cellSize、blockSize、numBins 都须为正整数。

本章保留中心差分、硬分箱、单 cell 归属、重叠 block 和 L2 归一化。没有方向与空间投票插值、Gaussian 加权，以及“截断大分量后再归一化”的 L2-Hys，因此是用于理解流程的简化 HOG。完整设计可进一步阅读 [Dalal–Triggs 原论文](https://lear.inrialpes.fr/people/triggs/pubs/Dalal-cvpr05.pdf)。

### 8. 组合向量：每一段来自哪里

默认对 28×28 图拼接以下特征，顺序固定：

| 位置（下标从 0 开始） | 内容 | 维数 |
|---|---|---:|
| 0–5 | 六个基本统计量 | 6 |
| 6–12 | 七个对数 Hu 值 | 7 |
| 13–68 | 28 个水平投影值，随后 28 个垂直投影值 | 56 |
| 69–84 | 4×4 网格填充率 | 16 |
| 合计 | `extractCombinedFeatures(...).all` | **85** |

默认不包含 HOG，也不包含完整像素数组；开启 HOG 后追加 324 维，合计 409 维。`details` 字段按组保留各部分，便于检查哪一组改变了距离。单个 block 是 36 维，不能把前 18 项打印结果误当成完整 block。

维度正确只是第一步。拼接不会自动让每组贡献相同：对数 Hu 可能比填充率大很多，一个组的维度更多，也可能累计更大的距离影响。是否加权、怎样加权，应由验证样本表现决定。

### 9. 归一化：先说清楚在谁的范围内计算

归一化容易被误写成“让所有特征公平”。实际上不同操作解决不同问题，必须说清楚最小值、均值和标准差从哪里来。

| 方法 | 公式 | 符号含义 | 作用 |
|---|---|---|---|
| Min-Max | `x'=(x−min)/(max−min)` | min、max 是选定范围的最小最大值 | 将该范围映射到 0–1 |
| Z-Score | `x'=(x−μ)/σ` | μ、σ 是选定范围的均值、标准差 | 表示离均值有几个标准差 |
| L2 | `v'=v/√Σvᵢ²` | v 是整个向量，i 遍历各项 | 把整体长度变为 1 |

`normalizeFeatures` 默认在**传入的一个向量内部**计算参数。例如 `[10,50,100,200,500]` 的 minmax 使用 min=10、max=500，得到约 `[0,0.081633,0.183673,0.387755,1]`。zscore 也默认在这一个向量内算均值与总体标准差。零向量的 L2 结果仍为零；常量向量做默认 minmax/zscore 也得到零，代码在除数为 0 时用 1 代替。

L2 对 `[3,4]` 得到 `[0.6,0.8]`，两项之比始终是 3:4。因此它统一的是样本的整体长度，并没有均衡每一维的相对大小。

#### 逐维标准化为什么要用训练集的每一列

假设每个样本有 `[墨迹面积,填充率]` 两项。面积可能是几百，填充率在 0–1；若希望按各列的变化范围来比较，应收集训练样本，分别计算“面积这一列”和“填充率这一列”的均值、标准差。

用 `μ_j,σ_j` 表示第 j 个特征列的训练集统计量，新样本的第 j 项转换为 `x'_j=(x_j−μ_j)/σ_j`。例如面积列均值 100、标准差 20，填充率列均值 0.5、标准差 0.1，样本 `[120,0.6]` 变为 `[1,1]`，意思是两项都比各自训练均值高一个标准差。

这些参数要在训练数据上确定，然后原样用于验证、测试和线上样本，不能用测试数据反过来调整它们。当前辅助函数没有自动拟合这种逐列变换，也不是完整的 StandardScaler。方法区别可对照 [scikit-learn 预处理文档](https://scikit-learn.org/stable/modules/preprocessing.html)。

### 10. 预处理与空白输入

`cropAndCenter` 先找到黑色前景的外接框，裁出它，保持宽高比缩放，再把**外接框**放到目标画布中间。它并不移动墨迹质心到中心；不对称字符的重心仍可能偏向一侧。离散尺寸需要取整，最窄边至少保留一个像素，宽高比可能有轻微变化。

空白图没有前景，不能用“坐标和 / 前景数量”求质心。统计函数返回 `(0.5,0.5)` 作为相对中心占位，Hu 返回七个零，供程序继续处理；它们不是“空白有一个真实字符重心”的证据。识别页面会提示空白，第 12 章从图像识别的入口也会在匹配前拒绝空白。

---

## 算法实现

下面代码摘自本章共享实现。阅读时把变量与上面的算例对齐：`data[(y*width+x)*4]` 读取位置 `(x,y)` 的 R 通道；`width`、`height` 是图像宽高。浏览器和 Node 示例都调用这些函数，复制片段单独运行时，还需要同模块的依赖函数。

### 1. 像素级特征

双层循环按行展开所有像素。`binary` 分支把黑色记为前景 1，`normalize` 分支则将亮度除以 255，两者的输出含义见前面的对照表。


```javascript
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

先遍历图像，统计灰度总和、前景数和前景坐标和；得到均值后再遍历一次，计算平方偏差。最后将亮度统计与质心转换到前面说明的数值范围，再按固定顺序组成六维向量。


```javascript
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

function statisticalFeaturesToVector(stats) {
    return [
        stats.mean,
        stats.variance,
        stats.stdDev,
        stats.fillRatio,
        stats.centroidX,
        stats.centroidY
    ];
}
```


### 3. 图像矩

先看 `calculateRawMoment`：`p`、`q` 决定坐标的权重，只有黑色前景会加入求和。后面的中心矩使用 `dx`、`dy` 保存到质心的偏移；`mu20` 就是正文的 μ20，`eta20` 就是 η20。


```javascript
function calculateRawMoment(imageData, p, q) {
    const { width, height, data } = imageData;
    let moment = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // 对于二值图，前景为 1，背景为 0
            const intensity = data[idx] < 128 ? 1 : 0;
            moment += Math.pow(x, p) * Math.pow(y, q) * intensity;
        }
    }

    return moment;
}
```


<details>
<summary>展开中心矩、全部七个 Hu 值与对数映射的实现</summary>

先跟踪小 L 的 `m00=3 → mu20=2/3 → eta20=2/27 → h1=4/27`，再对照其余分量。`norm(p,q)` 返回面积归一化的分母，`Math.pow(a,b)` 表示 a 的 b 次幂。


```javascript
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

function logTransformHuMoments(huMoments) {
    return huMoments.map(h => {
        if (h === 0) return 0;
        return -Math.sign(h) * Math.log10(Math.abs(h) + 1e-10);
    });
}
```


</details>

### 4. 投影特征

同一个黑像素同时给“所在行”和“所在列”各加一次计数。默认各自除以最大值，再把水平数组放在前面、垂直数组放在后面；前面的 7×7 A 可以逐行核对。


```javascript
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

`gx,gy` 是网格下标，不是梯度 Gx、Gy。先由它们确定每个格子的像素边界，再数格内前景。分母 `totalCount` 是该格实际遍历到的像素数，因此输出是填充比例。


```javascript
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

按三个函数阅读即可跟上数据流：`computeImageGradients` 生成每像素幅值与方向；`computeHOGCells` 汇总每个 cell 的方向票数；`extractHOGFeatures` 拼接每个 block 并归一化。对照 7×7 线性亮度图，第一格应累计约 158.114。

<details>
<summary>展开梯度、cell 投票与 block 拼接的实现</summary>

在 cell 循环中，`cx,cy` 表示 cell 的列号、行号；在 block 循环中，`bx,by` 表示 block 起点。它们不是字符质心。`histogram[bin] += mag` 是一次整票累加，`features.push(...values)` 则把一组数接到最终向量末尾。


```javascript
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
```


</details>

---

## 在 OCR 中的应用

### 完整特征提取流程

```text
输入：第 10 章分割后的单字符灰度/二值图
→ 裁剪前景外接框、保持宽高比缩放并居中到 28×28
→ 分别提取统计 6 维、对数 Hu 7 维、投影 56 维、网格 16 维
→ 按固定顺序拼接为默认 85 维向量
→ 交给第 12、13 章的模板匹配或 KNN
```

HOG 是可选的额外 324 维。默认拼接不自动进行整向量 minmax、zscore 或 L2 归一化；若实验需要增加某种缩放或组权重，必须对模板、训练样本和待识别样本应用同一规则。

### 不同特征的适用场景

| 特征类型 | 维度 | 优点 | 缺点 | 适用场景 |
|----------|------|------|------|----------|
| 像素特征 | 高 | 信息完整 | 维度高、不鲁棒 | 深度学习输入 |
| 统计特征 | 低 | 紧凑；仅 Hu 部分具旋转不变性 | 信息有损 | 快速粗分类 |
| 投影特征 | 中 | 捕获形状 | 对倾斜敏感 | 印刷体识别 |
| 网格特征 | 低 | 局部信息 | 精度有限 | 辅助特征 |
| HOG 特征 | 默认 324 | 保留局部梯度方向分布 | 依赖分箱、对齐与参数，计算较多 | 比较笔画边缘结构 |

---

## 代码示例

### 文件说明

| 文件 | 说明 | 运行环境 |
|------|------|---------|
| `index.html` | 浏览器交互演示，可视化各种特征 | 浏览器 |
| `index.js` | Node.js 示例，算法实现详解 | Node.js |

### 运行方式

在项目根目录首次安装依赖，然后启动课程站：

```bash
npm install
npm run dev
```

打开课程首页 `http://127.0.0.1:4173/`，进入本章阅读页，或点击[本章交互实验](index.html)进行操作。服务已运行时直接打开页面即可，无需再启动一份。

Node.js 实验也从项目根目录执行：

```bash
node 11-feature-extraction/index.js
```

阅读页讲解原理，交互实验用于改变输入和参数，Node 实验输出具体计算结果。三者调用或对照同一章的共享算法。

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
| 原始/中心/归一化矩、Hu | 图像矩的逐步手算 | 7 个对数 Hu 值 | 3 / calculateCentralMoments、calculateHuMoments |
| 投影与网格 | 结构特征 | 行列投影、4×4 填充率 | 4–5 |
| 梯度、硬分箱、block | HOG 的分步算例 | 梯度幅值、真实 cell 直方图 | 6 / computeHOGCells、extractHOGFeatures |
| 归一化与组合维度 | 特征构建、归一化范围 | 85 维组合与匹配 | 7–9；HOG 组合为 409 维 |

浏览器与 Node 都直接调用 `shared/11-feature-extraction/index.js`；浏览器输入使用 Arial 字体/手绘，Node 使用几何字符，所以不同输入的距离不能横向视为同一次实验结果。

## 排障

- 同一字符略移动后特征变化大：像素/投影/HOG 不是平移不变的；先核对裁剪、画布坐标和尺寸。中心矩使用直接中心化累加，避免大坐标原始矩展开时的大数相消。
- 0/O 的 Hu 距离反而比 0/1 大：看原始矩、零附近项和笔画厚度；Hu 特征不是视觉相似性的度量保证。
- 组合特征增加后更差：维度不等于区分能力；检查特征冗余、Hu 对数尺度和验证集表现。
- HOG 图方向似乎与笔画垂直：梯度方向是法向，不是边缘切向。本页线段显示投票区间中点。

## 自测问题

1. 同一黑像素在 normalize 与 binary 模式中分别是多少？为什么不能混用？
2. 小 L 为什么有 M00=3，中心矩为何能忽略平移？
3. 小 L 的 μ20=2/3，怎样得到 η20 和 h1？
4. Hu 的不变性质有哪些前提或代价？
5. HOG 的 cell、bin、block 各是什么，324 维怎样来？
6. 默认组合为何是 85 维？L2 会使每维贡献相同吗？

<details>
<summary>点击查看答案</summary>

1. normalize 使用亮度/255，黑色为 0；binary 使用前景标记，黑色为 1。若模板与输入的含义相反，逐项比较就失去意义。

2. 三个黑点各贡献一次，面积矩为 3。平移同时改变坐标和质心，到质心的偏移不变，因此按偏移求和的中心矩不变。

3. 二阶归一化分母为 M00²=9，所以 η20=2/27；η02 也为 2/27，h1=4/27。

4. 连续图形下对平移、等比例缩放、旋转有相应不变性质；栅格重采样、噪声、裁剪会改变结果。旋转不变也可能丢掉区分 6/9 的方向，Hu 不是唯一形状编码。

5. cell 是局部像素块，bin 是方向范围，block 是相邻 cell 的组合。28×28 图有 4×4 个 7×7 cell，产生 3×3 个重叠 block，每个含 2×2×9=36 维，总共 324 维。

6. 6 个统计量 + 7 个对数 Hu + 56 个投影 + 16 个网格值，共 85。L2 只统一向量长度，不改变各维比例；逐维标准化或组权重才可调节相对贡献。

</details>

---

## 下一步

学完本章后，继续学习 **12. 模板匹配**！你将学习如何使用特征向量进行字符识别的最简单方法——通过与标准模板比对来识别字符。

## 参考来源

- [OpenCV Moments 定义](https://docs.opencv.org/4.x/d8/d23/classcv_1_1Moments.html)：原始矩、中心矩、归一化矩。
- [OpenCV HuMoments](https://docs.opencv.org/4.x/d3/dc0/group__imgproc__shape.html)：7 个不变量及栅格化/镜像边界。
- [Dalal & Triggs, CVPR 2005](https://lear.inrialpes.fr/people/triggs/pubs/Dalal-cvpr05.pdf)：标准 HOG 设计；本章明确为简化实现。
- [scikit-learn 预处理](https://scikit-learn.org/stable/modules/preprocessing.html)：逐维标准化与逐样本归一化。
