# 12. 模板匹配 (Template Matching)

## 学习目标

模板匹配是最直观的字符识别方法，通过将待识别字符与预先存储的标准模板进行比对来确定字符类别。本章将帮助你掌握：

1. **模板匹配原理** - 理解模板匹配的基本思想
2. **相似度度量** - 欧氏距离、余弦相似度、相关系数等
3. **模板库构建** - 如何创建和管理标准字符模板
4. **归一化处理** - 尺寸归一化、特征归一化的重要性
5. **匹配决策** - 最近邻匹配与阈值判断
6. **模板匹配的局限性** - 了解何时适用、何时不适用

---

## 前置知识

| 知识点 | 状态 | 关键内容 |
|--------|------|----------|
| 01-10 预处理与检测 | ✅ 已完成 | 图像预处理、字符分割 |
| 11. 特征提取 | ✅ 已完成 | **特征向量、距离度量** |

---

## 核心概念

### 1. 模板匹配：拿同一种描述与已知样本比较

第 11 章把一个字符图转换为特征向量。本章给一些已知字符也做相同处理，并连同字符标签一起存下来，称作**模板**。识别时，逐个比较输入与模板，选更接近的类别。

```text
已知字符图 → 同一套预处理、特征提取 → 标签 + 特征向量 → 模板库
待识别图   → 同一套预处理、特征提取 → 输入特征     → 比较、排序、决定是否接受
```

这里的“同一套”非常具体：图像尺寸、黑白含义、裁剪方式、特征类型、每一维顺序都要相同。例如第 11 章默认 85 维组合中，前六项是统计量；如果输入的前六项变成像素值，长度即使仍是 85 也不能比较。

本章解决的是**已经切出来的单字符分类**。它不会在整张照片里到处滑动模板寻找文字位置；整页到字符框的定位工作由前面章节完成。

### 2. 距离与相似度：小意味着近，还是大意味着像

先统一记号：A、B 是两条待比较的向量；`aᵢ,bᵢ` 是它们第 i 项；n 是共同长度；`Σ` 表示遍历全部 n 项求和。每一项必须描述同一属性，公式才有意义。

#### 欧氏距离：把逐项误差平方相加，再开平方

```text
d(A,B) = √Σ(i=1…n) (aᵢ−bᵢ)²
```

d 表示距离，数值越小越接近。平方避免正负误差抵消，也会让较大的单项误差产生较大贡献。取 A=`[1,2,3]`，B=`[4,6,3]`：

```text
逐项差：−3、−4、0
平方和：9+16+0=25
距离：√25=5
```

曼哈顿距离改为把绝对误差相加，同一算例为 `|−3|+|−4|+0=7`。两者分别也叫 L2 距离、L1 距离；“距离 5”和“距离 7”来自不同规则，不能直接用数值大小判断哪个方法更准。

欧氏距离对数值尺度敏感：一维面积差 100，就可能压过许多填充率差 0.1。解决方式要联系第 11 章的逐维缩放或特征组权重，而不是笼统说“调用一次归一化就公平了”。

#### 余弦相似度：比较各项之间的比例方向

把向量看成从原点出发的箭头，余弦相似度比较两支箭头的夹角：

```text
cosine(A,B) = (A·B)/(‖A‖×‖B‖)
A·B = Σ aᵢbᵢ，称为点积
‖A‖ = √Σ aᵢ²，称为向量长度
```

这里的方向是特征空间里的方向，不是图像梯度或字符的旋转方向。A=`[1,2]`，B=`[2,4]`，B 恰好是 A 的两倍：

```text
点积 = 1×2+2×4 = 10
长度乘积 = √5×√20 = 10
余弦相似度 = 10/10 = 1
欧氏距离却为 √((1−2)²+(2−4)²)=√5
```

所以余弦可以忽略整条向量的正比例放大，但不会忽略不同特征维度各自的缩放，也不能自动对齐旋转的字符图。数值范围为 −1 到 1，越大越同向；0 表示几何上正交，不能直接推成“统计独立”。若所有特征非负，相似度通常落在 0–1。

为了让匹配器统一使用“越小越好”，代码取 **余弦距离 = 1−余弦相似度**。当任一向量全为零时，向量没有定义良好的方向，数学分母为 0；本项目返回相似度 0 作为占位，对应距离 1，不应解释成确切的形状关系。

#### NCC：先减去平均值，再比较变化是否同步

NCC 在本章指减去均值后的归一化相关系数，与 Pearson 相关系数的公式相同。它关注的不是两组数是否逐项相等，而是“哪里高于自身平均值、哪里低于自身平均值”是否一致。

令 `μₐ,μ_b` 为 A、B 的均值，σₐ、σ_b 为各自的总体标准差：

```text
NCC = Σ(aᵢ−μₐ)(bᵢ−μ_b) / (n×σₐ×σ_b)
    = Σ(aᵢ−μₐ)(bᵢ−μ_b) / √[Σ(aᵢ−μₐ)² × Σ(bᵢ−μ_b)²]
```

第二行将标准差展开，便于手算。A=`[1,2,3]`，B=`[3,5,7]`，B 是 A 乘以 2 后再加 1：

```text
均值：μₐ=2，μ_b=5
去均值：A→[−1,0,1]，B→[−2,0,2]
分子：2+0+2=4
分母：√((1+0+1)×(4+0+4))=√16=4
NCC=1
```

因此，对逐项对齐的灰度像素，统一加亮、乘一个正对比度因子且未发生裁剪时，NCC 可以保持不变。阴影不均、像素错位、黑白反转则不属于同一个前提。对混合特征而言，每一维并不是一个灰度像素，也不能直接把它解释成“对光照不敏感”。

NCC 在有定义时范围为 −1 到 1，越大越正相关；匹配器使用 `1−NCC` 作为距离。若一条向量是 `[5,5,5]`，去均值后全为 0，分母为 0，即使另一条向量完全相同，也不能算出“相关为 1”。本 API 返回 0 作为退化占位；空向量同样返回 0，长度不一致则报错。零相关一般只说明缺少线性相关，不能推出没有其他关系。[SciPy Pearson 定义](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html)

#### 选择度量时要同时看特征与阈值

| 度量 | 越小/越大越像 | 本章用于排序的值 | 主要取舍 |
|---|---|---|---|
| 欧氏距离 | 越小 | 原距离 | 关注绝对差异，大误差经平方影响更大 |
| 曼哈顿距离 | 越小 | 原距离 | 按绝对误差累计，对异常值的影响方式不同 |
| 余弦相似度 | 越大 | `1−cosine` | 忽略整向量正比例变化，但可能丢掉有用幅度 |
| NCC | 越大 | `1−NCC` | 忽略整体偏置和正比例变化，需要非零方差 |

每次比较都遍历 n 个特征，工作量为 `O(n)`。库里共有 T 个模板时，逐模板比较约为 `O(Tn)`，再加候选排序成本。模板更多、特征更长，通常都需要更多计算和存储。

### 3. 模板库：一个类别可以有多个长相

单模板法为每个字符保存一个样本，容易理解，也容易受到字体变化影响。多模板法则为同一标签保存不同字体或不同写法的样本，例如 `'3'` 下可以有三种写法，标签仍然只有一个。

设输入到类别 A 两个模板的距离是 `[1,9]`，到类别 B 两个模板的距离是 `[3,3]`：

| 聚合方式 | 类别 A 的距离 | 类别 B 的距离 | 选谁 |
|---|---:|---:|---|
| `min`：类内取最小值 | 1 | 3 | A，与 A 中某一个写法很像 |
| `mean`：类内取平均值 | 5 | 3 | B，与 B 的两个样本都较接近 |

`matchTemplate` 支持这两种方式，默认取 min。它先得到每类一个距离，再对类别排序，并不是默认让所有模板投票。第 13 章的 KNN 才进一步讨论多个邻居投票。

还可以将某类样本聚类，用聚类中心当原型，减少模板数量。“原型”是一条代表性特征向量，不一定对应某张真实图；本章介绍这个思路，没有自动进行聚类训练。新增类别也不必重建所有旧模板，可以通过添加接口扩展，但样本和特征规则仍需一致。

### 4. 预处理：先让比较位置对应，再谈距离

输入和模板都需要采用一致的灰度/二值化、尺寸与布局规则。共享 `createTemplate` 负责调用 `cropAndCenter` 和特征提取，并不会自动完成整套拍照预处理。

`cropAndCenter` 找到黑色前景外接框，保持宽高比缩放，并将外接框居中到指定画布。**这是外接框居中，不是墨迹质心对齐**。对不对称字符，两种中心可能不同。直接拉伸虽然也能统一尺寸，却可能把瘦长字符变宽，所以这里采用保留比例加边距的方式。

以目标 28×28、`padding=0.1` 为例，每侧预留 `floor(28×0.1)=2` 像素，内容可用边长是 24。若原前景框宽 10、高 20，统一缩放倍数取 `min(24/10,24/20)=1.2`，得到宽 12、高 24，再放到画布中间。离散尺寸要取整，至少保留一个像素。

特征类型也必须一致。默认 28×28 目标图的各类维度是：

| featureType | 内容 | 维度 |
|---|---|---:|
| `pixel / binary` | 亮度或前景像素展开 | 784 |
| `statistical` | 六个统计量 + 七个对数 Hu | 13 |
| `projection` | 28 个行投影 + 28 个列投影 | 56 |
| `zone` | 4×4 网格填充率 | 16 |
| `hog` | 默认 7 像素 cell、2×2 cell block、9 个方向格 | 324 |
| `combined` | 统计 6 + Hu 7 + 投影 56 + 网格 16 | 85 |

这里沿用第 11 章的实际共享函数，HOG 会真正提取 HOG，未知类型会报错。各特征内部已有各自的数值处理，组合向量只是拼接，**不会自动再做整向量 L2 或逐列标准化**。若自行增加这类变换，建库和识别都要一致地应用。

### 5. 匹配决策：最接近的候选是否足够接近

#### 先得到候选，再决定是否接受

设一个教学输入的特征为 `[2,3]`，标签 `'1'` 的模板为 `[2,2]`，标签 `'7'` 的模板为 `[5,3]`。这只是用于演示算术的二维特征，不是声称真实字符仅靠这两个数就能区分。

欧氏距离分别是 1 和 3，所以最近候选是 `'1'`。数学上写作 `argmin_c d(input,template_c)`：c 遍历候选类别，argmin 返回“哪个类别使距离最小”，不是返回距离数值本身。

即使输入完全不像任何模板，排序也总会出现第一名。因此需要**拒识阈值**：若最小距离大于 `rejectThreshold`，输出未知（`label:null,rejected:true`）。例如阈值为 2，上例距离 1 可以接受；若另一个输入到所有类别的距离都大于 2，就应拒绝。等于阈值仍接受，默认 `null` 则关闭距离拒识。

阈值与特征、距离规则绑定，应在有标签的验证样本上确定。它有机会拒绝未知字符，但不能保证拦下所有未知样本：一个库外字符也可能恰好落在某个模板附近。从图像识别的入口会另外拒绝没有前景的空白图，空模板库也会直接拒识。

#### 为什么“置信度 73%”不能读成“正确概率 73%”

代码沿用 `confidence` 字段名，表示候选之间的**相对匹配分数**。默认用 softmax 把距离转换成总和为 1 的分数：

```text
scoreᵢ = exp(−dᵢ/T) / Σj exp(−dⱼ/T)
```

i 表示当前候选，j 遍历所有候选，`dᵢ` 是该类距离；T 是大于 0 的温度参数，控制分数分布有多集中；exp 是 e 的指数函数。距离越小，负距离越大，指数分数也越高。

取两个候选距离 `[1,2]`、T=1。为了避免指数数值太小，先减去最小距离，等价地计算：

```text
调整后距离：[0,1]
指数权重：[exp(0),exp(−1)] ≈ [1,0.367879]
总和：1.367879
相对分数：[1/1.367879,0.367879/1.367879] ≈ [73.11%,26.89%]
```

如果距离同时变成 `[1001,1002]`，减去最小值后仍是 `[0,1]`，分数完全不变，尽管两个模板都可能很远。只有一个候选时，softmax 分数甚至总是 1。它只描述当前候选之间的相对优势，没有验证“模型说 73% 的样本是否真有 73% 正确”。

T 较小会让第一名的优势更突出，T 较大则让分布更平缓；它不改变最近类别，也不能替代拒识。API 要求 T 有限且大于 0，距离有限且非负。还提供 `simple` 方法 `max(0,1−d/maxDistance)`，其中 maxDistance 至少为 `1e−6`；例如距离 `[1,2]` 得分 `[0.5,0]`，连总和为 1 都不保证，也不能当作概率。

因此同时看原始距离、候选间差距和验证集表现。默认匹配器按各类距离计算分数，返回最多五个候选供查看；不能只因第一名分数高就忽略绝对距离过大。

### 6. 模板匹配的能力边界

| 情况 | 为什么困难 | 可以怎样改进或观察 |
|---|---|---|
| 字体、粗细、手写变化 | 有限模板覆盖不了所有写法 | 增加有代表性的样本，比较不同特征 |
| 偏移、倾斜与拉伸 | 像素及局部结构难以对应 | 核对裁剪与预处理，避免过度拉伸 |
| 0/O、1/l/I 等形近字符 | 图像本身可能缺少足够区分信息 | 结合字符集约束与上下文，保留候选 |
| 新类别 | 模板库没有正确标签可选 | 允许拒识、人工复核，再扩展模板库 |
| 模板数和维度增加 | 逐个比较的工作量增加 | 评估特征选择或原型压缩的取舍 |

固定字体、类别有限、输入规范的场景适合先用模板匹配建立可解释基线；复杂手写变化通常需要更强的表示或分类方法。后续课程会继续学习 KNN 和神经网络。

---

## 算法实现

### 1. 从类内距离到候选排序

下面摘取共享实现的 `matchTemplate`。`templateLibrary` 按标签保存模板对象，每个对象的 `features` 是一条向量；`distances` 是输入到这一类各模板的距离。先用 min 或 mean 汇总成每类一个距离，再排序，正好对应前面 `[1,9]` 与 `[3,3]` 的例子。

```javascript
function calculateDistance(a, b, metric = 'euclidean') {
    switch (metric) {
        case 'euclidean':
            return euclideanDistance(a, b);
        case 'manhattan':
            return manhattanDistance(a, b);
        case 'cosine':
            // 余弦距离 = 1 - 余弦相似度
            return 1 - cosineSimilarity(a, b);
        case 'correlation':
            // 相关距离 = 1 - 相关系数
            return 1 - normalizedCrossCorrelation(a, b);
        default:
            throw new Error(`未知距离度量: ${metric}`);
    }
}

function matchTemplate(features, templateLibrary, options = {}) {
    const {
        metric = 'euclidean',    // 距离度量
        aggregation = 'min'      // 多模板聚合方式：'min' | 'mean'
    } = options;

    const results = [];

    for (const [label, templates] of templateLibrary) {
        const distances = templates.map(t =>
            calculateDistance(features, t.features, metric)
        );

        let distance;
        if (aggregation === 'mean') {
            distance = distances.reduce((a, b) => a + b, 0) / distances.length;
        } else {
            distance = Math.min(...distances);
        }

        results.push({ label, distance });
    }

    // 按距离排序
    return results.sort((a, b) => a.distance - b.distance);
}
```

`TemplateMatcher` 类在此基础上管理模板、计算分数、应用拒识阈值。下面可在项目根目录的 Node 环境中核对前面的二维算例：

```javascript
const { TemplateMatcher } = require('./shared/12-template-matching');
const matcher = new TemplateMatcher({
    distanceMetric: 'euclidean',
    rejectThreshold: 2,
});
matcher.addTemplate('1', [2, 2]);
matcher.addTemplate('7', [5, 3]);
const result = matcher.recognize([2, 3]);
console.log(result.label, result.distance, result.rejected);
// 1 1 false：候选标签为字符串 '1'，距离为 1，没有拒识。
```

`addTemplate` 直接接收已提取的向量，适合手算；`addTemplateFromImage` 则从真实字符图创建模板。`recognize` 处理向量，`recognizeFromImage` 会先检查空白并提取特征。两组入口对应不同阶段的数据，不应将图像对象直接传给向量比较函数。

### 2. NCC：把公式中的三组求和落实到循环

`meanA`、`meanB` 是均值；`diffA`、`diffB` 是某一项减去均值后的差；`varA`、`varB` 累加平方差，`covar` 累加两条向量的差值乘积。除以 n 后才能分别得到总体方差与协方差，随后代入前面定义的相关公式。

```javascript
function normalizedCrossCorrelation(a, b) {
    if (a.length !== b.length) {
        throw new Error('向量长度不一致');
    }

    const n = a.length;
    if (n === 0) return 0;

    // 计算均值
    const meanA = a.reduce((sum, v) => sum + v, 0) / n;
    const meanB = b.reduce((sum, v) => sum + v, 0) / n;

    // 计算方差和协方差
    let varA = 0, varB = 0, covar = 0;

    for (let i = 0; i < n; i++) {
        const diffA = a[i] - meanA;
        const diffB = b[i] - meanB;
        varA += diffA * diffA;
        varB += diffB * diffB;
        covar += diffA * diffB;
    }

    const stdA = Math.sqrt(varA / n);
    const stdB = Math.sqrt(varB / n);

    // 避免除以零
    if (stdA === 0 || stdB === 0) {
        // Pearson/NCC 此时未定义。教学接口返回 0 占位，对应相关距离 1；不是完全相关。
        return 0;
    }

    return Math.max(-1, Math.min(1, covar / (n * stdA * stdB)));
}
```

常量分支返回的 0 是程序的退化约定，不能用它推导统计意义上的“不相关”。用 `[1,2,3]` 和 `[3,5,7]` 调用该函数，才对应前面可算出 NCC=1 的非退化例子。

### 3. 从图像创建模板：保证建库与识别使用同一套规则

`processed` 是裁剪、缩放和外接框居中后的图。根据 `featureType` 选择一条提取路径，最终返回标签、特征向量以及类型和目标尺寸。特征长度可逐项对照前面的维度表；这里没有再将组合向量整体归一化。

<details>
<summary>展开各特征类型的模板创建实现</summary>

```javascript
function createTemplate(imageData, label, options = {}) {
    const {
        targetSize = 28,            // 归一化尺寸
        featureType = 'combined',   // 特征类型
        padding = 0.1               // 边距比例
    } = options;

    // Step 1: 预处理 - 裁剪并居中
    const processed = cropAndCenter(imageData, targetSize, padding);

    // Step 2: 提取特征
    let features;

    switch (featureType) {
        case 'pixel':
            // 像素级特征
            features = extractPixelFeatures(processed, {
                normalize: true,
                binary: false
            });
            break;

        case 'binary':
            // 二值像素特征
            features = extractPixelFeatures(processed, {
                normalize: false,
                binary: true
            });
            break;

        case 'statistical':
            // 统计特征
            const stats = extractStatisticalFeatures(processed);
            const huMoments = calculateHuMoments(processed);
            features = [
                ...statisticalFeaturesToVector(stats),
                ...logTransformHuMoments(huMoments)
            ];
            break;

        case 'projection':
            // 投影特征
            const projection = extractProjectionFeatures(processed);
            features = projection.combined;
            break;

        case 'zone':
            // 网格特征
            features = extractZoneFeatures(processed, 4);
            break;

        case 'hog':
            features = extractHOGFeatures(processed);
            break;

        case 'combined':
            // 组合特征（推荐）
            const combined = extractCombinedFeatures(processed, {
                includePixels: false,
                includeStats: true,
                includeHuMoments: true,
                includeProjection: true,
                includeZone: true,
                includeHOG: false  // HOG 计算较慢，默认不包含
            });
            features = combined.all;
            break;
        default:
            throw new Error(`未知特征类型: ${featureType}`);
    }

    return {
        label,
        features,
        featureType,
        imageSize: targetSize
    };
}
```

</details>

实际使用时，输入图与模板都通过相同的 `createTemplate` 逻辑。下面的 `knownImage`、`inputImage` 应是已完成灰度/二值预处理的单字符图像：

```javascript
const matcher = new TemplateMatcher({ featureType: 'combined', imageSize: 28 });
matcher.addTemplateFromImage(knownImage, '3');
const result = matcher.recognizeFromImage(inputImage);
// 查看 result.distance、result.candidates，再结合验证过的拒识阈值解释结果。
```

这个仅放入一个类别的示例用于说明数据流，不构成可用的十类数字识别器；演示页面会建立多类别模板供比较。

---

## 在 OCR 中的应用

### 完整的模板匹配 OCR 流程

建库时，收集带正确标签的字符图，采用统一预处理和特征规则，把每类的一条或多条向量保存到模板库。

识别整页时，先使用前面章节的预处理和定位方法得到有序字符框，再逐个执行：

```text
裁出字符图 → 检查空白 → 与模板一致的裁剪、缩放和特征提取
→ 逐模板算距离 → 按类聚合 → 排序并计算相对分数
→ 按距离阈值接受或拒识 → 按阅读顺序组合结果
```

本章匹配器实现单字符部分。被拒识的位置需要保留为未知或交给人工复核，不能因为要拼成完整字符串就强行采用第一名。

### 不同场景的参数选择

| 场景 | 特征类型 | 距离度量 | 模板数量 | 说明 |
|------|----------|----------|----------|------|
| 标准数字 | 组合特征 | 欧氏距离 | 每类 1 个 | 0-9 共 10 个模板 |
| 多字体 | HOG 特征 | 余弦相似度 | 每类多个 | 每种字体一个模板 |
| 简单印刷体 | 像素特征 | 相关系数 | 每类 1 个 | 快速但不鲁棒 |

---

## 代码示例

### 文件说明

| 文件 | 说明 | 运行环境 |
|------|------|---------|
| `index.html` | 浏览器交互演示，可视化模板匹配过程 | 浏览器 |
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
node 12-template-matching/index.js
```

阅读页讲解原理，交互实验用于改变输入和参数，Node 实验输出具体计算结果。三者调用或对照同一章的共享算法。

---

## 可复用模块

本章新增以下函数（已添加到 `shared/12-template-matching/`）：

| 函数 | 说明 |
|------|------|
| `TemplateMatcher` | 模板匹配器类 |
| `createTemplate(imageData, label, options)` | 从图像创建模板 |
| `normalizedCrossCorrelation(a, b)` | 归一化相关系数 |
| `buildTemplateLibrary(samples, options)` | 批量构建模板库 |
| `matchTemplate(features, templates, options)` | 单次模板匹配 |
| `recognizeCharacter(imageData, matcher)` | 识别单个字符 |
| `calculateConfidence(results, options)` | 根据候选距离计算相对匹配分数 |

---

## 数学公式总结

### 距离与相似度

| 名称 | 公式 | 说明 |
|------|------|------|
| 欧氏距离 | d = √(Σ(aᵢ - bᵢ)²) | L2 距离 |
| 曼哈顿距离 | d = Σ\|aᵢ - bᵢ\| | L1 距离 |
| 余弦相似度 | cos(θ) = (A·B)/(‖A‖×‖B‖) | 方向相似 |
| 相关系数 | r = cov(A,B)/(σₐ×σ_b) | 线性相关 |

### 匹配分数计算

令 dᵢ 是第 i 个候选类别的距离，T 为正温度，`dmin` 是候选中的最小距离。稳定的 softmax 写法为：

```text
wᵢ = exp(−(dᵢ−dmin)/T)
scoreᵢ = wᵢ / Σj wⱼ
```

w 是尚未除以总和的权重，score 才是相对分数。距离 `[1,2]` 与 `[1001,1002]` 得到同样分数的原因，见前面“匹配决策”的手算过程。该分数未校准为正确概率，拒识仍需结合在验证样本上确定的距离阈值。

---

## 常见问题与解决方案

### 1. 匹配准确率低

**可能原因：**
- 预处理不充分（尺寸不统一、未居中）
- 特征选择不当
- 模板质量差

**解决方案：**
- 确保严格的预处理流程
- 尝试不同的特征组合
- 使用高质量的标准模板

### 2. 相似字符混淆

**问题**：如 0/O、1/l/I、6/9 等容易混淆

**解决方案：**
- 添加区分性特征（如上下文信息）
- 使用更精细的特征（如 HOG）
- 引入后处理校正

### 3. 新字符无法识别

**问题**：模板库中没有的字符会被错误识别

**解决方案：**
- 设置拒绝阈值
- 查看候选间相对分数，同时检查绝对距离；相对高分也可能需要拒识
- 扩展模板库

---

## 自测问题

1. 模板匹配识别的是整张文档还是已经切出的字符？
2. A=[1,2]、B=[2,4]，为何余弦相似度为 1，但欧氏距离不为 0？
3. 两条相同的常量向量，NCC 应当解释为完全相关吗？
4. 为什么先统一尺寸和位置？本章如何居中？
5. 模板匹配为什么需要拒识，距离阈值可以随意照搬吗？
6. 距离 [1,2] 与 [1001,1002] 的 softmax 分数为什么相同？说明了什么？

<details>
<summary>点击查看答案</summary>

1. 本章识别单字符。模板和输入使用相同预处理、特征类型、维度顺序，再按距离比较；整页定位由前面章节完成。

2. 两向量同向，余弦为 1；对应数值并不相等，所以欧氏距离为 √5。余弦忽略的是整向量正比例放大。

3. 不能。去均值后两条都为零，分母为零，数学上没有定义。共享 API 返回 0 是退化占位，不是已证明不相关或完全相关。

4. 特征项需要对应相同位置或同一结构。cropAndCenter 保留宽高比并将外接框居中，不是把墨迹质心移到中心。

5. 没有正确模板也会出现最近候选，需要允许超过门槛时输出未知。阈值依赖特征、距离规则和验证样本，不能随意照搬。

6. 两组减去最小距离都为 [0,1]，在 T=1 时均约为 73.11%/26.89%。分数反映相对优势，不是正确概率；高相对分也可能离全部模板很远。

</details>

---

## 下一步

学完本章后，继续学习 **13. KNN 分类器**！你将学习一种更灵活的分类方法，通过多个最近邻投票来决定类别，能更好地处理模板之间的变化。
