# 24. 后处理与独立评估

识别器已经输出 `123`，照片实际写着 `1203`。这不是“第三位以后都错了”，而是漏了一个 `0`。本章先建立可复核的字符对齐，再讨论什么情况下可以用语言先验提出纠错建议，以及怎样诚实统计失败。

本章实现的是**单位代价编辑距离、独立数字串评估、有限词典与 Bigram 排序、一个置信度拒识教学策略**。它没有训练 OCR 网络、没有读取照片，也不是完整生产纠错系统。所有例子中的字符串和分数都是人为构造的课堂输入，不能当作手写照片模型成绩。

## 1. 学习目标与前置知识

完成阅读、手算与实验后，应能：

1. 从真值到预测区分替换 S、删除 D、插入 I，并完成动态规划和最短路径回溯。
2. 解释为什么距离唯一，最优对齐却可能不唯一；能复现本模块的固定平局规则。
3. 正确计算聚合 microCER、整串完全正确率和 WER，说明各自分子、分母和统计单位。
4. 区分待标注、明确排除和识别失败，保留前导零、重复数字及原始预测。
5. 用词典产生候选，用 N-gram 语言概率排序，说明为何这不适合任意数字串。
6. 展示置信度阈值改变覆盖率与端到端错误的过程，而不是把高得分当作准确率。

| 前置章节 | 本章如何使用 |
|---|---|
| 09–10 连通域、文字定位 | 理解“漏字 / 多字”可能来自定位和分割 |
| 13、17 分类器 | 理解替换、候选得分、独立测试与实际图像分布变化 |
| 18–20 序列识别、CTC、CRNN | 区分模型内部对齐与预测完成后的评估对齐 |
| 21、23 Attention、Transformer | 理解语言先验和视觉证据的分工，不必为本章加载大模型 |

第25章将照片处理成原始数字串；第26章在预测完成后录入答案并调用本章评估。评估模块不调用识别器，也不把答案传回识别流程。学习交付完成不等于学习者已经掌握本章。

## 2. 先运行，再推导

首次使用仓库时，在项目根目录执行`npm install`安装工具依赖；并行实施期间依赖由主代理统一管理，本章不修改依赖配置。随后从项目根目录运行：

```bash
node 24-post-processing/index.js
npm test -- --runInBand shared/__tests__/postProcessing.test.js
```

浏览器入口由主代理统一构建，章节不手写 `bundle.js`：

```bash
npm run build
npm start
```

打开 [第24章本地实验](http://127.0.0.1:4173/24-post-processing/)。如果页面停留在“正在载入实验”，先完成统一构建；不要直接以 `file://` 打开未经构建的入口。

文件结构：

```text
24-post-processing/
├── README.md
├── index.js                    # Node固定输入实验
├── browser.js                  # CommonJS，引用同一份shared算法
└── index.html                  # 引用共享样式、导航和生成的bundle.js
shared/
├── 24-post-processing/index.js # 纯算法，无DOM、无模型依赖
└── __tests__/postProcessing.test.js
```

本章算法无第三方运行时依赖；Jest 和 esbuild 使用项目现有工具。浏览器引用 `../shared/course.css`、`../shared/course.js`，没有外部模型、CDN、上传服务或另建网站。

### 知识点—文档位置—HTML实验—Node实验/函数

| 知识点 | README位置 | HTML实验与中间结果 | Node实验/函数 |
|---|---|---|---|
| OCR常见S/D/I与匹配 | §3 | 01：修改两串，查看原始字符与缺口 | 实验1–2，`printAlignment` |
| 编辑距离定义与动态规划 | §4.1–4.3 | 01：完整矩阵、维度、当前格三个前驱成本 | 实验1，`experimentMatrix` |
| 回溯、固定平局、重复字符 | §4.4–4.5 | 01：逐列播放，平局/前导零/空串预设 | 实验2，`experimentTieAndBoundaries` |
| microCER、整串准确率与样本去向 | §5.1–5.5、§6 | 02：JSON编辑、逐图S/D/I、分子分母和导出 | 实验3、8，`experimentEvaluation`、`experimentInvalidInputs` |
| CER和WER计数单位 | §5.6 | 02：词级输入、切词数组、词级对齐、指标对照 | 实验4，`experimentWordUnits` |
| 字典候选与noisy-channel直觉 | §7 | 03：观测词与左词输入、候选距离和得分表 | 实验6，`experimentDictionary` |
| N-gram、计数、边界和平滑 | §8 | 03：α滑块、实际计数/分子/分母/概率和 | 实验5，`experimentBigram` |
| 语言权重与数字串保护 | §8.3、§9 | 03：λ滑块、bock与00110对照 | 实验6，`experimentDictionary` |
| 置信度、拒识与验证集调参 | §10 | 04：τ滑块、原始/最终预测、覆盖率与固定分母 | 实验7，`experimentConfidence` |
| 非法输入、无分母与局限 | §4.5、§5.5、§11–13 | 空串、无标签、非法JSON及错误状态 | 实验8与独立Jest边界测试 |

八组Node实验均打印输入、中间状态、对照结论并进行`assert`自检。失败会产生非0退出状态；固定输入不依赖随机种子，不触发训练。共享算法循环和分支分行展开，适合在递推、回溯、计数和汇总处打断点。

建议按以下顺序操作：

1. 点“漏掉一个0”，将对齐滑块从0推到4，对照字符列和5×4矩阵。
2. 点“平局：12 → 21”“前导零与重复”“CER 300%”“失败空预测”。
3. 在 JSON 面板修改记录，再点“计算独立指标”；试试无分母和错误的数值型真值。
4. 将语言权重从1调到0，观察 `bock` 的候选；将α从0.1调到3，对照计数和平滑项；再输入 `00110`。
5. 调节拒识阈值到0.55、0.8、0.91，核对覆盖率和端到端分母。

## 3. 错误是序列之间的关系

以下方向始终是 **truth → prediction**：

| 操作 | 含义 | 真值 | 预测 | 本章代价 |
|---|---|---|---|---:|
| M，Match | 同一个字符正确保留 | `3` | `3` | 0 |
| S，Substitution | 真值被替换成别的字符 | `3` | `8` | 1 |
| D，Deletion | 真值中的字符在预测中缺失 | `0` | 缺口 | 1 |
| I，Insertion | 预测中多出一个字符 | 缺口 | `1` | 1 |

在 OCR 中，`3 → 8` 可能来自分类混淆；漏字符可能来自裁剪、检测、分割或解码；多字符可能来自噪声、一个字符被切成多个块或序列解码。**S/D/I 是文本对齐的错误归类，不能单靠它认定图像处理阶段的根因。** 要结合第25章的框、归一化图和逐字预测核查。

假如直接逐位置比较 `1203` 和 `123`，第三位会被算成 `0 → 3`，末尾又缺一个 `3`。对齐允许插入缺口：

```text
真值：1  2  0  3
预测：1  2  ∅  3
操作：M  M  D  M
```

因此最少只需要一次删除。显示符号 `∅` 不是字符串里的真实字符；API 用 `null` 表示缺口，避免与真实的 `-`、空格等混淆。

## 4. Levenshtein 编辑距离：从公式到二维表

### 4.1 定义、变量与边界

令真值序列为 (a=(a_1,\ldots,a_m))，预测序列为 (b=(b_1,\ldots,b_n))。`m`、`n` 是比较单位的数量：默认是 Unicode 码点，WER实验中则是词。数字0–9的一个码点就是一个数字。

\[
d[i,j]=\text{把真值前 }i\text{ 个字符变为预测前 }j\text{ 个字符的最少编辑数}
\]

表有 **(m+1) 行、(n+1) 列**，多出来的一行和一列代表空前缀。距离是非负整数，无量纲。

\[
d[0,0]=0,\qquad d[i,0]=i,\qquad d[0,j]=j
\]

把 `i` 个真实字符变成空串，要删 `i` 次；空串变成 `j` 个预测字符，要插入 `j` 次。

### 4.2 为什么只需要比较三个前驱

任何从前缀 `a[0:i]` 到 `b[0:j]` 的最优编辑，其最后一步只可能属于三类：

1. 两端各消耗一个字符：相同则匹配成本0，不同则替换成本1，前驱为 `(i−1,j−1)`。
2. 只消耗真值字符：删除，前驱为 `(i−1,j)`，成本1。
3. 只消耗预测字符：插入，前驱为 `(i,j−1)`，成本1。

如果某条最优路径的前驱部分不是最优，就能换成更便宜的前驱路径，得到更小的总代价，与“最优”矛盾。这就是递推依赖的最优子结构。

\[
d[i,j]=\min\begin{cases}
d[i-1,j-1]+\mathbf{1}[a_i\ne b_j] & \text{匹配或替换}\\
d[i-1,j]+1 & \text{删除}\\
d[i,j-1]+1 & \text{插入}
\end{cases}
\]

方括号指示函数 `1[条件]` 在条件成立时取1，否则取0。按从上到下、从左到右填表，三个前驱都已计算。单位代价编辑距离及此动态规划可对照 [Stanford《Introduction to Information Retrieval》编辑距离章节](https://nlp.stanford.edu/IR-book/html/htmledition/edit-distance-1.html)；经典算法出处为 Wagner 与 Fischer 的 [The String-to-String Correction Problem](https://dl.acm.org/doi/10.1145/321796.321811)。

### 4.3 手算 `1203 → 123`

`m=4`、`n=3`，矩阵为5×4。下表中“∅”是空前缀边界，行列标签的字符对应新加入前缀的字符。

| 真值↓ / 预测→ | ∅ | 1 | 2 | 3 |
|---|---:|---:|---:|---:|
| ∅ | 0 | 1 | 2 | 3 |
| 1 | 1 | 0 | 1 | 2 |
| 2 | 2 | 1 | 0 | 1 |
| 0 | 3 | 2 | 1 | 1 |
| 3 | 4 | 3 | 2 | **1** |

三个关键格：

- `d[2,2]`：`2` 与 `2` 相等，取左上格 `d[1,1]+0=0`。
- `d[3,2]`：真值 `120` 变为 `12`。替换候选 `d[2,1]+1=2`，删除候选 `d[2,2]+1=1`，插入候选 `d[3,1]+1=3`，故取1。
- `d[4,3]`：最后一个 `3` 匹配，取 `d[3,2]+0=1`。右下角是最终距离。

对应共享代码中的核心循环：

```javascript
const cost = truthTokens[i - 1] === predictionTokens[j - 1] ? 0 : 1;
table[i][j] = Math.min(
    table[i - 1][j - 1] + cost,
    table[i - 1][j] + 1,
    table[i][j - 1] + 1
);
```

数学下标从1记字符；JavaScript数组从0开始，故读取 `[i-1]`。表的 `(i,j)` 仍表示前缀长度，不是某个字符的数组坐标。

### 4.4 完整回溯和平局

只有右下角的距离，不能直接知道 S、D、I。代码从 `(m,n)` 向左上回溯，查找满足“当前值 = 前驱值 + 操作成本”的前驱。本模块固定优先级：

```text
M 匹配 → S 替换 → D 删除 → I 插入
```

M和S是同一条对角线的两个互斥分支；相同字符为M，否则为S。每次记录字符、操作和原始索引，再移动坐标，最后反转结果，得到从左到右的对齐列。

`1203 → 123` 回溯为 `(4,3) → (3,2) → (2,2) → (1,1) → (0,0)`，对应反向的 `M,D,M,M`；反转后是 `M,M,D,M`。

平局例子 `12 → 21` 的距离是2：两次替换可以实现，先插入一个 `2` 再删除最后一个 `2` 也能实现。固定规则选择 `S,S`，不随循环或候选顺序变化。不同工具的成本和平局规则可能不同；跨工具比较错误构成前需要统一规则。

重复字符的归属同样有歧义：`00110 → 0110` 可以说漏了第一个0，也可以说漏了第二个0。本模块从尾部优先匹配，固定把第一个0记为删除。这是评分约定，不是定位证据。`1 → 1111` 同理固定返回 `I,I,I,M`。

**这里不允许“交换相邻字符，代价1”这一额外操作。** `12 → 21` 距离为2，本章没有实现带转置操作的 Damerau–Levenshtein 距离。词典建议可以使用其他代价，但不能悄悄改变本章 CER 的评分定义。

### 4.5 复杂度、字符单位与资源限制

- 填表时间为 `O((m+1)(n+1))`，通常记为 `O(mn)`；回溯时间最多 `O(m+n)`。
- 完整二维表空间为 `O((m+1)(n+1))`。仅求距离可滚动保存两行；本章保留整表以方便回溯和可视化。
- 表最多4,000,000个单元格，超出抛 `RangeError`。数值行用 `Uint32Array`，数值部分最多约16MB，另有行、字符、对象开销；教学展示函数返回普通数组，会另有复制成本。
- 对齐页面为可读性限制每串60个码点；JSON页面最多200条、每条200个码点。模块本身没有“数字串必须固定长度”的要求。
- 默认 `Array.from(text)` 按码点拆分，避免把一个补充平面字符拆成两个UTF-16代理项；索引也是码点索引。它不是字素簇分割，没有 NFC 归一化、大小写折叠、去空格或标点清理。
- `é` 和 `e` 加组合重音仍不同；`🔢1 → 🔢2` 是一次替换。生产多语言评估必须事先约定规范化和计数单位，不能算完以后再选有利规则。

## 5. 评估口径：不要只看一个百分比

### 5.1 microCER按真实字符聚合

设纳入评估的有标签有效照片集合为 (E)，第 (k) 张真值长度为 (N_k>0)，最优对齐得到 (S_k,D_k,I_k)。

\[
\operatorname{microCER}=\frac{\sum_{k\in E}(S_k+D_k+I_k)}{\sum_{k\in E}N_k}
\]

分子是所有错误编辑的总次数，分母是**真实字符总数**，不是预测长度、匹配数或“最大字符串长度”。CER按字符计数，WER按词计数，这一区分可核验 [NIST OpenASR21 报告中的评估定义](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=934557)。

自己核算这两张图：

| 图 | 真值 | 预测 | S | D | I | N | 单图CER | 整串正确 |
|---|---|---|---:|---:|---:|---:|---:|---|
| A | `12` | `12` | 0 | 0 | 0 | 2 | 0 | 是 |
| B | `1203` | `123` | 0 | 1 | 0 | 4 | 1/4 | 否 |

聚合为 `1/(2+4)=1/6≈16.67%`。逐图比例算术平均是 `(0+1/4)/2=1/8=12.5%`，它让每张图权重相同，是另一种指标；不能用它冒充这里约定的 microCER。microCER也等于以真值长度为权重的单图CER平均。

### 5.2 整串完全正确率按照片计数

\[
\operatorname{ExactMatchAccuracy}=
\frac{\sum_{k\in E}\mathbf{1}[truth_k=prediction_k]}{|E|}
\]

上例为 `1/2=50%`。`00110` 只有原封不动的 `00110` 才正确；漏一个0或把连续1合成一个1都算整串错。

单数字分类准确率则来自独立已裁剪数字测试集，分母是数字图片数。它与照片整串正确率不是同一个任务。若仅为直觉而假设每个数字独立、正确概率同为 `p=0.98`，长度10全对概率为 `p^10≈81.71%`；实际错误可能相关，还存在分割失败，不能拿这个乘法当作照片成绩估计。

### 5.3 CER可以超过100%

真值 `1`，预测 `1111`：`S=0,D=0,I=3,N=1`，CER为 `3/1=3=300%`。

插入次数没有被真值长度限制，因而CER不保证小于等于1。模块不会截断。`1−CER` 此时为负值，不能被命名为通用字符准确率。即使CER没有超过1，其补数也不等于“多少个真值位置被正确分类”。

### 5.4 待标注、排除、失败

本章三种样本去向互斥，按以下先后判断：

| 条件 | `disposition` | 纳入分母 | 记录方式 |
|---|---|---|---|
| `exclusionReason.trim()`非空 | `excluded` | 否 | 保留原理由，即使同时缺答案也只算排除 |
| 无排除，`truth`为undefined/null/空串 | `pending` | 否 | 允许看预测，等待标注 |
| 无排除，非空合法数字真值 | `evaluated` | 是 | 不因失败或空预测而跳过 |

有效照片 `truth='305'`，识别流程没有产出时，`prediction=''` 或缺失：按3次删除、CER100%、整串失败计算。状态只是额外诊断信息，**状态失败不等于输入无效**。损坏文件或明确超出约定的图片可以排除，但要保留理由；不能用“模型识别错了”当排除依据。

总数满足：

```text
totalSamples = evaluatedSamples + pendingSamples + excludedSamples
```

`failedSamples` 是纳入样本中的失败数，是 `evaluatedSamples` 的子集，不能再加到上述等式右边。逐图 `failed` 在预测为空或状态为 `failed/error/rejected`（忽略大小写）时为true。其他自定义状态照原样保存；如需统计为失败，调用方应映射为这些规范状态。

`prediction`表示本次流程最终交付的文本。失败状态带非空、确实交付的部分文本时，按这段文本评分，不将它强行清空。如果状态为failed但交付文本恰好等于真值，它同时计入“状态失败数”和“整串匹配数”；运行状态与文本匹配是两个独立维度，应结合失败原因解释。`failedSamples`不等于文本错误数，其补数也不能当作端到端识别成功率。

整串拒识表示没有交付文本，应写 `prediction:''`、`status:'rejected'`，把拒识前候选另存为`originalPrediction`；现有`filterByConfidence`即遵守此约定。只把status改成rejected而仍在prediction里保留候选，会继续对该候选文本评分，不能代表“拒识后”的成绩。评估器不根据状态静默改写预测，生产方负责明确最终交付结果。

### 5.5 无分母返回null

当没有有标签有效样本时，`microCER` 与 `exactMatchAccuracy` 都返回 `null`。错误次数和真实字符数仍返回0。`null` 表示尚不能计算，不是0%错误、100%正确或计算失败的NaN。

通用 `alignSequences('', '')` 仍有明确定义：距离0、空对齐。在数字串评估契约中，空真值代表待标注，所以不会把空真值样本计成一次“正确识别空字符串”。两层接口职责不同。

### 5.6 WER：先约定什么是“词”

\[
\operatorname{WER}=\frac{S_{word}+D_{word}+I_{word}}{N_{word}}
\]

本章 `wordErrorRate` 去掉首尾空白、以连续空白分词，区分大小写且保留标点，然后复用同一个对齐内核。没有自动中文分词。

```javascript
wordErrorRate('read the book', 'read book');
// truthWords: ['read', 'the', 'book']; predictionWords: ['read', 'book']
// distance: 1, deletions: 1, wer: 1/3
```

`00110 → 0110` 作为一个词会得到WER100%，但CER20%；它们回答不同问题。对任意无空格数字串，本项目用CER加整串准确率，不把WER作为主要照片指标。若真值词数为0，本辅助函数保留插入次数而把 `wer` 返回null。

实现顺序是：`splitWords`产生两个词数组→`alignTokens`以词作为比较单位构建表并回溯→`distance/truthWords.length`。只改变单位，距离和缺口方向不变。英文例子中，空格参与码点CER，`read the book → read book`删除the和一个空格共4码点，字符分母13，CER为4/13；词级则删除1词、分母3。页面与实验4显示两种口径。

### 5.7 指标与方法的选择对照

| 方法 | 主要输入 | 解释什么 | 本项目用途与局限 |
|---|---|---|---|
| 固定位置逐字正确率 | 已对齐且定长的分类标签 | 每个位置分类是否正确 | 可用于独立单字分类；漏字导致错位时不适用 |
| microCER | 原始预测与真实字符串 | 单位真实字符的编辑错误 | 数字串主指标；插入数可能超过分母 |
| 整串完全正确率 | 原始预测与真实字符串 | 整张照片是否完全正确 | 不区分错一位或多位，配合CER使用 |
| WER | 已约定切词的文本 | 单位真实词的编辑错误 | 英文文本便于解释；任意数字无自然词边界 |
| 仅编辑距离词典建议 | 观测词与有限词典 | 字面最接近的候选 | 易手算；同距候选无法靠形式定胜负 |
| 距离+Bigram排序 | 候选与左词历史 | 上下文更常见的候选 | 可改坏正确的未登录词；不接入数字串 |
| 置信度拒识 | 预测与逐字得分 | 是否交给人工复核 | 需报告覆盖率和完整分母，不保证CER下降 |

## 6. 集成契约：第26章直接调用

共享入口是 `require('../shared/24-post-processing')`。根级共享入口的汇总由主代理负责。

### 6.1 `alignSequences(truth, prediction)`

两参数必须为字符串，可为空，可包含一般文本；不会调用 `String()` 或转数值。返回：

```javascript
{
  distance: 1,
  substitutions: 0,
  deletions: 1,
  insertions: 0,
  alignment: [
    { operation: 'M', truth: '1', prediction: '1', truthIndex: 0, predictionIndex: 0 },
    { operation: 'M', truth: '2', prediction: '2', truthIndex: 1, predictionIndex: 1 },
    { operation: 'D', truth: '0', prediction: null, truthIndex: 2, predictionIndex: null },
    { operation: 'M', truth: '3', prediction: '3', truthIndex: 3, predictionIndex: 2 }
  ]
}
// 上例输入：alignSequences('1203', '123')
```

索引是原字符串拆分后的零基码点索引；缺口对应字符及索引都为null。`distance === substitutions + deletions + insertions`。将非null真值列拼接能恢复truth，将非null预测列拼接能恢复prediction。

### 6.2 `evaluatePredictions(records)`输入

`records`必须是数组；每条为对象，至少支持以下字段：

| 字段 | 支持值、默认值与含义 |
|---|---|
| `id` | 字符串或有限数值；undefined/null时生成`sample-1`、`sample-2`等位置标识 |
| `truth` | 非空时必须匹配`/^[0-9]+$/`；undefined/null/`''`统一为空串，代表待标注 |
| `prediction` | 任意字符串，可为空；undefined/null按空串评分，数值被拒绝 |
| `status` | 字符串；缺失时`'ok'`；推荐`'ok'/'failed'/'error'/'rejected'` |
| `exclusionReason` | 字符串；undefined/null默认`''`；仅判断是否有非空白内容，不改写原始理由 |
| 其他元数据 | 如`modelId`、`config`、`failureReason`、`writerId`、`split`、`source`，浅层保留 |

严格校验即使对待标注/排除记录也适用；例如带字母的真值不是本数字评估器可接受的标注。一般文本需用`alignSequences`或另建明确口径的评估器。`truth=' 12'`、全角`１２`和数值`12`会报错，模块不暗中规范化。预测允许`O0 `等非数字内容，因为它们也是必须计入的实际错误。

重复id按输入位置分别计分，不静默合并；照片去重由集成层负责。元数据采用浅拷贝且不写回输入对象，不承诺深复制、自动数据划分验证或对任意对象的序列化。可下载报告的输入应使用JSON可序列化元数据；禁止与以下保留返回字段重名后再依赖旧值。

### 6.3 汇总对象稳定字段

| 字段 | 类型 | 定义 |
|---|---|---|
| `totalSamples` | integer | 输入记录总数 |
| `evaluatedSamples` | integer | 非排除、有合法非空答案的记录数 |
| `pendingSamples` | integer | 非排除、无答案的记录数 |
| `excludedSamples` | integer | 有非空排除理由的记录数 |
| `failedSamples` | integer | 纳入记录中`failed=true`的数量 |
| `totalTruthCharacters` | integer | 纳入记录的真值字符总数 |
| `substitutions` | integer | 纳入记录的总替换数S |
| `deletions` | integer | 纳入记录的总删除数D |
| `insertions` | integer | 纳入记录的总插入数I |
| `totalErrors` | integer | S+D+I |
| `microCER` | number或null | totalErrors / totalTruthCharacters；不截断 |
| `exactMatches` | integer | 纳入记录中本次最终交付文本prediction严格等于真值的数量 |
| `exactMatchAccuracy` | number或null | exactMatches / evaluatedSamples |
| `records` | object[] | 按输入顺序返回所有逐图结果，包括待标注和排除 |

比率在API中用小数：0.25代表25%，3代表300%。不返回百分数整数，不同时维护`cer`和`microCER`两个汇总别名。

逐图在保留元数据的基础上，规范化/增加：

| 字段 | 定义 |
|---|---|
| `id, truth, prediction, status, exclusionReason` | 规范化后的基础字段，字符串语义不变 |
| `rawPrediction` | 本次传入的`prediction`；若缺失/null则为null，用于区分没有产出与显式空串 |
| `disposition` | `'evaluated' / 'pending' / 'excluded'` |
| `included` | 是否纳入本轮指标 |
| `failed` | 预测为空或规范失败状态；是否进入汇总失败数还取决于included |
| `truthLength` | 规范化真值的长度，未标注为0；排除行也保留其标注长度，但不聚合 |
| `distance, substitutions, deletions, insertions` | 纳入时是整数；未纳入时均为null |
| `cer` | 本图distance / truthLength；未纳入为null |
| `exactMatch` | 纳入时boolean；未纳入为null |
| `alignment` | 纳入时与alignSequences完全一致的数组；未纳入为null |

若先应用拒识策略，`filterByConfidence`会另外保留`originalPrediction`；此时传给评估器的`prediction`已是策略输出，`rawPrediction`反映这个本次输入。比较原始模型与拒识策略时分别调用评估器，不能把两个输出口径混为一份成绩。

### 6.4 最小完整返回示例

```javascript
const { evaluatePredictions } = require('../shared/24-post-processing');
const report = evaluatePredictions([{ id: 'photo-01', truth: '1', prediction: '', status: 'failed' }]);
// report与下面的对象内容相同：
const expectedReport = {
  totalSamples: 1,
  evaluatedSamples: 1,
  pendingSamples: 0,
  excludedSamples: 0,
  failedSamples: 1,
  totalTruthCharacters: 1,
  substitutions: 0,
  deletions: 1,
  insertions: 0,
  totalErrors: 1,
  microCER: 1,
  exactMatches: 0,
  exactMatchAccuracy: 0,
  records: [{
    id: 'photo-01', truth: '1', prediction: '', status: 'failed', exclusionReason: '',
    rawPrediction: '', disposition: 'evaluated', included: true, failed: true,
    truthLength: 1, distance: 1, substitutions: 0, deletions: 1, insertions: 0,
    cer: 1, exactMatch: false,
    alignment: [{ operation: 'D', truth: '1', prediction: null, truthIndex: 0, predictionIndex: null }]
  }]
};
```

无标签或全排除时，计数仍完整，两个汇总比率为null。接口返回对象没有调用时间、随机数或隐式全局状态，同一输入与同一元数据给出确定结果。

### 6.5 评估与识别之间的边界

建议集成顺序：

```text
冻结模型与配置
    ↓
读取照片并生成原始prediction（此时不读取truth）
    ↓
保存id / prediction / modelId / config / status / failureReason
    ↓
人工录入truth与明确的输入排除理由
    ↓
evaluatePredictions(records)
    ↓
展示逐图对齐、分子分母、样本数并导出原始记录
```

评估器不能证明照片没有被用来调参，也不能检查书写者隔离。这些需要第26章的数据划分、原图来源、模型版本和实验记录；模块保留这些元数据以便复核。不要按答案长度分割照片、用真值补字、删除低置信度照片后仍称端到端成绩。

## 7. 从编辑距离到词典纠错

### 7.1 距离只衡量形式差异

对观测词 `bock`，字典只有 `back`、`book`：

```text
bock → back：o换成a，距离1
bock → book：c换成o，距离1
```

距离相同不能判断哪个词才是原意。再小的距离也不能证明候选正确：正确人名、专业术语、缩写或外语词可能不在字典中。

本模块首先枚举去重后的字典词，保留距离不大于 `maxDistance` 的候选，再排序。词典大小K、单词平均长度L时，穷举距离计算约 `O(KL²)`，适合课堂小词典，大字典通常需更高效候选检索。本章没有这些检索结构。

### 7.2 Noisy channel：把先验与错误机制分开

设 `o` 是观测词，`w` 是候选原词，`h` 是上下文。在给定上下文下，贝叶斯公式给出：

\[
\hat w=\arg\max_w P(w\mid o,h)
=\arg\max_w P(o\mid w,h)P(w\mid h)
\]

`P(w|h)`表达上下文中原词的先验，`P(o|w,h)`表达原词如何变成观测错误。这两个因子对应语言模型与噪声机制。基于该思想的经典拼写纠错见 [Kernighan、Church、Gale 1990 原论文](https://aclanthology.org/C90-2036/)。OCR场景还应利用视觉证据或从开发数据估计的混淆概率；键盘拼错的统计不能直接当作手写识别错误统计。

本章为了看清计算，使用以下**启发式排序分数**：

\[
score(w)=-\beta\cdot distance(w,o)+\lambda\ln P_{LM}(w\mid h)
\]

`β=editWeight≥0`控制编辑惩罚；`λ=languageWeight≥0`控制语言先验；`ln`为自然对数。它借用了“距离越小越合理”和“常见上下文更合理”的思路。没有完整归一化的错误通道，也没有证明不同候选的归一化常数相同，**因此不能把这个score称为后验概率或置信度**。

真正接入识别器时，还可能用 `log P_visual(y|x)+λ log P_LM(y)+长度项` 对候选序列重排；其权重、长度偏置和重复使用内部语言先验的问题要单独验证。本章不实现Beam Search，也不声称复现某个完整OCR解码器。

## 8. N-gram与可运行的Bigram实验

### 8.1 保留多长的历史

对词序列 `w₁,…,wT`，概率链式法则为：

\[
P(w_1,\ldots,w_T)=\prod_{t=1}^{T}P(w_t\mid w_1,\ldots,w_{t-1})
\]

N-gram用最近 `q−1` 个词近似完整历史：`q=1`为unigram，`q=2`为bigram，`q=3`为trigram。这里用q表示阶数，以免与CER分母N混淆。

\[
P(w_t\mid w_{<t})\approx P(w_t\mid w_{t-q+1:t-1})
\]

Bigram只看一个左侧词：`P(book|the)`。Trigram会看两个：`P(book|read,the)`。阶数变高能描述更多上下文，但词表大小V时潜在q-gram种类增长至 `V^q`，有限语料会非常稀疏。这是模型假设和样本量的权衡，不是越大越好。定义与平滑公式参考作者发布的 [Jurafsky与Martin，N-gram Language Models](https://web.stanford.edu/~jurafsky/slp3/3.pdf)。

### 8.2 计数和平滑

`C(h,w)`是历史h后出现词w的次数，`C(h)=Σw C(h,w)`是该历史所有后继词次数。最大似然估计：

\[
P_{MLE}(w\mid h)=\frac{C(h,w)}{C(h)}
\]

没见过的组合会被赋0，整句概率连乘也会归零。教学代码对每个后继词加上 `α>0`：

\[
P_{add\text{-}\alpha}(w\mid h)=\frac{C(h,w)+\alpha}{C(h)+\alpha V}
\]

分母必须同步加 `αV`，才能让V种后继概率之和为1。默认 `α=1` 为add-one；它易于手算，但对大词表往往过度平滑，不能当作现代语言模型的完整平滑方案。

### 8.3 本项目自己构造的语料与实测数值

```javascript
const model = createBigramModel([
  'read the book',
  'read the book',
  'read the back',
  'read a book'
]);
```

每句内部加入 `<s>` 和 `</s>`，避免把上一句末词和下一句首词连成错误bigram。后继词表包含5个普通词 `read/the/book/back/a`、结束标记 `</s>` 和未知词桶 `<unk>`，所以 **V=7**；句首 `<s>`只作历史，不在后继词表里。

对历史the，`C(the,book)=2`、`C(the,back)=1`、`C(the)=3`，故：

\[
P(book\mid the)=(2+1)/(3+7)=0.3
\]

\[
P(back\mid the)=(1+1)/(3+7)=0.2
\]

`bock`到两个候选距离都为1。设β=λ=1，实测：

| 候选 | 距离 | 语言概率 | score |
|---|---:|---:|---:|
| book | 1 | 0.3 | −2.203972804325936 |
| back | 1 | 0.2 | −2.6094379124341005 |

分数较大的book排第一。设λ=0时两者都为−1，规则按距离再按JS字符串字典序稳定排序，back排第一。这是实验结果，并非宣称bock在现实文本中必然拼错。

句子模型的对数概率通过相加避免小概率连乘下溢。例如：

```text
P(read | <s>) = 5/11
P(the  | read) = 4/11
P(book | the) = 3/10
P(</s> | book) = 4/10
log P(read the book </s>) = ln(5/11)+ln(4/11)+ln(3/10)+ln(4/10)
```

未知词映射到一个 `<unk>` 事件桶，未知历史没有训练计数，因此给V个后继事件均匀的1/V概率。不能把无限多个未见词都看成独立且各有1/V概率的事件；这个模型的样本空间是有限词表与未知词桶。

### 8.4 辅助接口及限制

```javascript
createBigramModel(sentences, { alpha: 1 });
// → { vocabulary: string[], alpha, probability(previous, word), logProbability(text) }

suggestCorrection('bock', ['book', 'back'], {
  model,
  previousToken: 'the',
  editWeight: 1,
  languageWeight: 1,
  maxDistance: 2
});
// → {
//   original:'bock', suggestion:'book', changed:true,
//   reason:'toy-dictionary-suggestion',
//   candidates:[{word, distance, languageProbability, score}, ...]
// }
```

`sentences`非空，空句或直接包含保留边界标记的语料报错；拆词仅用空白，不改大小写。`vocabulary`和模型对象被冻结，内部计数通过闭包封装。`logProbability`给出词表事件序列的自然对数概率；它不是可序列化训练模型产物。

`suggestCorrection`只检查一个词；已在字典中直接保留，空输入/带空白输入保留，纯ASCII数字保留。无候选也保留。默认无语言模型时只按距离排序，`languageProbability`为null。字典应与语言模型词表匹配；大量词表外候选落在同一个 `<unk>` 桶，不会获得有意义的语言区分。

这个实验没有右侧上下文，不能处理真实词错误，如把一个合法词误识别成另一个合法词；没有短语候选、词语合并拆分或候选搜索剪枝；没有自适应行业词典；没有真实混淆矩阵和视觉得分。未知词可能被误改，平滑、权重和最大编辑距离都需要独立开发集选择。

### 8.5 参数对照与逐步实现

`createBigramModel`按五步组织，可以逐步检查中间变量：

1. 以空白切词，为每句加入边界；建立固定后继词表。
2. 外层遍历句子，内层遍历相邻词对，在`counts.get(previous)`累加`C(h,w)`，在`totals`累加`C(h)`。
3. `inspectTransition(previous,word)`将未知词映射到`<unk>`，返回计数、词表大小、平滑分子和分母。
4. `probability`读取检查对象中的概率；`logProbability`逐个转移累加自然对数，包括结束符。
5. `suggestCorrection`逐个计算候选编辑距离，过滤超过`maxDistance`的候选，计算编辑惩罚和语言项并稳定排序。

```javascript
const transition = model.inspectTransition('the', 'book');
// { previous:'the', word:'book', previousToken:'the', token:'book',
//   count:2, historyCount:3, vocabularySize:7, alpha:1,
//   numerator:3, denominator:10, probability:0.3 }
```

`inspectTransition`是只读诊断方法，供Node和页面共用；返回新对象，不暴露内部Map。评分和教学展示使用同一计数。超出浮点稳定计算范围的极端α会明确报错，不能静默产生0或NaN。

同一语料上，实验5实际得到：

| α | P(book\|the) | P(back\|the) | P(未见词桶\|the) |
|---:|---:|---:|---:|
| 0.1 | 2.1/3.7≈0.567568 | 1.1/3.7≈0.297297 | 0.1/3.7≈0.027027 |
| 1 | 3/10=0.3 | 2/10=0.2 | 1/10=0.1 |
| 3 | 5/24≈0.208333 | 4/24≈0.166667 | 3/24=0.125 |

α增大，频率差异被削弱，概率逐步靠近1/7。λ=0忽略语言项；实验6对照λ=0、1、3，候选距离相同，正λ让book领先而分数间隔不同。β越大，越不愿接受较远候选；`maxDistance=0`则使bock没有候选，保持原样。

若候选编辑距离不同，比较`u,v`时，`score(u)>score(v)`等价于`λ ln(P(u|h)/P(v|h)) > β(distance(u,o)−distance(v,o))`。语言收益必须抵消额外编辑惩罚。没有独立验证数据，不能凭一个例子认定权重最优。

## 9. 任意数字串为什么不该被擅自“润色”

本项目输入是白纸上的任意数字序列，不保证它是电话、金额、日期或词典中的编号。`00110`、`1111`、`00000`都可能是合法原文。对它应用“去掉前导零”“去重”“更像常见编号”的规则，会制造错误。

```javascript
suggestCorrection('00110', ['110']);
// { original:'00110', suggestion:'00110', changed:false,
//   reason:'numeric-string-preserved', candidates:[] }
```

最终数字串流程不调用这个词典函数；函数内的数字保护只是额外演示，也不代表一个通用敏感字段识别器。例如带字母的编号并不受纯数字保护。因此不要把它直接用于未知字段类型的生产文本。

有明确业务规则时，可以检验格式、长度、校验位，并提示复核；只有充分证据才能产生单独记录的候选建议。正确答案只能参与评分，不能用来补齐预测；原始预测与人工修订必须分开保存。第19章CTC去blank/折叠路径的操作属于解码定义，不能在拼接后的普通数字串上再次去重。

## 10. 置信度过滤与阈值调优

### 10.1 模型得分不等于实测正确概率

模型给某类0.99，表示该模型的输出得分高，不能直接推出现场99%的图片能识别正确。神经网络校准不足已有原论文实证；可参见 [Guo等，On Calibration of Modern Neural Networks](https://proceedings.mlr.press/v70/guo17a.html)。其校准结论不是本项目已经完成校准的证明。

即使在验证集校准过，新的手机照片、书写者和光照也可能改变误差分布。模型得分适合辅助排序和人工复核；准确率需要真实答案与独立数据。

### 10.2 可运行的整串拒识策略

设一串n个字符对应得分 `p₁,…,pₙ`，本教学策略定义：

\[
c_{min}=\min_i p_i,\qquad accept=\mathbf{1}[n>0\ \land\ c_{min}\ge\tau]
\]

`τ`为阈值；最低得分不是整串正确概率。拒识后本策略返回空串，并保留`originalPrediction`，不只删掉低分字符造成位置错乱。空预测视为失败，即使τ=0也不能变成一次有效接受。

```javascript
filterByConfidence('308', [0.90, 0.90, 0.55], 0.8);
// {
//   originalPrediction:'308', prediction:'', minimumConfidence:0.55,
//   threshold:0.8, rejected:true, status:'rejected'
// }
```

`scores`必须与预测码点数相等，每项在[0,1]内且为有限数；不接受稀疏数组或缺失得分。阈值在[0,1]，等于阈值允许通过。没有得分的空串返回`minimumConfidence:null`。

### 10.3 不能只报已接受结果的准确率

固定样例（分数为教学构造，不是已训练模型产物）：

| 图 | 真值 | 原始预测 | 最低得分 | τ=0.8后预测 |
|---|---|---|---:|---|
| A | `12` | `12` | 0.90 | `12` |
| B | `305` | `308` | 0.55 | 空串 |

原始CER为 `1/(2+3)=20%`，整串正确率1/2。拒识后B算3次删除，CER变为 `3/5=60%`，整串正确率仍为1/2。只看接受的A可以得到1/1=100%，但覆盖率只有1/2。

\[
coverage=\frac{\text{被接受的有效有标签样本数}}{\text{有效有标签样本总数}}
\]

如果报告选择性准确率，必须同时报告覆盖率和完整数据集的端到端成绩。没有接受样本时，选择性准确率也无分母；页面显示null对应的“无分母”。这个例子说明拒识可能使编辑错误更多，但能引导人工介入；不能笼统声称“提高阈值必然提升系统准确率”。

### 10.4 怎样调阈值才不污染测试集

1. 原图及同源裁剪/增强先分组，再按训练、验证、最终测试划分；书写者可识别时隔离书写者。
2. 在验证集比较预先定义的若干阈值，同时看覆盖率、microCER、整串正确率与失败案例。
3. 根据业务目标选择阈值并冻结。最终测试或现场新照片只运行冻结配置，保留所有原始预测。
4. 看到测试错误后改阈值，该照片就参与了开发；后续成绩应使用新的未见测试集并另记版本。

本项目没有用户约定的最低准确率或拒识率门槛，所以应报告实测与适用范围，不自行承诺某个成绩。

## 11. 实验与验证记录

2026-09-08，本章在本机Node v24.11.1上完成固定输入运行。`node 24-post-processing/index.js`包含以下可复核结果：

| 实验 | 实测结果 |
|---|---|
| `1203 → 123` | 距离1，S=0/D=1/I=0 |
| `12 → 21` | 距离2，固定S=2/D=0/I=0 |
| `00110 → 0110` | 距离1，固定删除第一个0 |
| `1 → 1111` | 距离3，I=3，CER300% |
| `305 → ''` | D=3，单图CER100% |
| 两图`12→12`、`1203→123` | microCER=1/6，整串正确率1/2 |
| 加入有标签失败`305→''`、1条待标注、1条排除 | 总5、纳入3、待标注1、排除1、纳入失败1；microCER=4/9，整串正确率1/3 |
| `read the book → read book` | WER=1/3 |
| bock候选，λ从0改为1 | 建议从back改成book；数字00110保持原样 |
| 两图阈值0.8 | CER从0.2变为0.6，整串正确率仍0.5，覆盖率0.5 |

浏览器初始JSON将第一图换成`00110→00110`以突出前导零，因此默认总真实字符数为12，默认CER=4/12、整串正确率1/3；它与Node示例的4/9使用了不同的第一图长度，不是计算偏差。

本章独立Jest共46项通过，覆盖固定S/D/I、平局、缺口索引、前导零、重复数字、两种空串、码点/字面符号、完整矩阵、micro聚合、失败纳入、排除优先、元数据不变、无分母、重复id、非法输入、bigram概率归一化、词典保护及拒识分母。另穷举长度0–3的15个二进制串，共225对，使用独立的前缀状态图最短路参考实现核验距离，并逐列核对坐标、操作和两端字符串重建。它没有把被测DP函数再调用一次当作参考答案。

浏览器入口通过esbuild `write:false` 编译检查；bundle由主代理统一生成。完成最终统一构建后，使用独立`ocr-ch24-qa`浏览器会话重新加载页面，18项实际交互检查全部通过：编辑距离与单格前驱成本、固定平局、CER300%、失败空预测、超长输入/非法数值真值/非法JSON及恢复、两图聚合16.67%与50%、无分母、数字00110保护、词典建议恢复、α实际改变概率、CER/WER单位对照及全拒识固定分母。没有使用主代理的`ocr-review`会话。

浏览器详细结果见[browser-qa-results.json](browser-qa-results.json)，记录18项观测结果、执行时间与被测bundle的SHA-256；[桌面截图](browser-qa-desktop.png)记录默认页面的实际呈现。

本章没有真实手写照片识别成绩、模型准确率或现场预演结论。这些属于第17、25、26章的独立测量。

## 12. 常见误区

| 误区 | 应怎样判断 |
|---|---|
| 逐个位置比较就能统计CER | 漏字会导致后续错位，应做完整编辑对齐 |
| 最优对齐一定唯一 | 代价可相同，须公布平局规则 |
| D一定是分割模块的错 | 它只描述文本差异，还需检查图像中间结果 |
| 把各图CER平均就是本项目CER | 本项目按真实字符总数进行micro聚合 |
| CER限制在0–100% | 插入可使其超过100% |
| 1−CER就是字符准确率 | 指标语义不成立，可能为负 |
| 失败图片不能用来评分 | 有标签有效输入的失败必须计入 |
| 无答案可以用预测当答案 | 会构造虚假的正确率；应记待标注 |
| 高置信度就是高准确率 | 得分、校准和实测正确率是不同概念 |
| 词典选出来就一定对 | 先验可能改坏陌生词、专名和编号 |
| 00110可以用数值110保存 | 两串不是同一原文，必须保持字符串 |
| 在最后测试集上选最佳阈值 | 测试集已变成开发数据，不能继续称独立成绩 |

## 13. 自测题与答案

先自己手算，再展开答案。矩阵与对齐类题可在浏览器核对，API类题可用Node复现。

<details>
<summary>1. d[0,3]和d[4,0]分别是多少，为什么？</summary>

分别是3和4。空真值变成3个预测字符需要3次插入；4个真值字符变成空预测需要4次删除。

</details>

<details>
<summary>2. 1203 → 123的编辑表为何是5×4，而不是4×3？</summary>

两维都要包含长度为0的前缀。真值4字符对应0–4共5行，预测3字符对应0–3共4列。最终距离d[4,3]=1。

</details>

<details>
<summary>3. 12 → 21为什么不是距离1？本模块会如何对齐？</summary>

本章仅有单字符替换、删除、插入，没有“交换两字符”操作。最少成本2。回溯平局优先对角线，所以返回两次替换。

</details>

<details>
<summary>4. 00110 → 0110的CER与整串正确率是多少？能判断原图漏了哪个0吗？</summary>

一次删除，CER=1/5=20%；该图整串错误。本模块固定删除第一个0，但仅靠序列无法判断图像里是哪一个0没被识别。

</details>

<details>
<summary>5. 两图分别是12 → 12和1203 → 123，microCER与逐图平均为什么不同？</summary>

microCER=1/6；逐图CER平均=(0+1/4)/2=1/8。前者让每个真实字符权重一致，后者让每张图片权重一致。整串准确率为1/2。

</details>

<details>
<summary>6. 真值1、预测1111的CER是多少？1−CER表示什么？</summary>

I=3、N=1，所以CER=3=300%。1−CER=−2，不能称准确率，模块不会用它作为成绩。

</details>

<details>
<summary>7. 答案305的有效照片识别失败，prediction没有提供，如何处理？</summary>

规范化prediction为空串；保留rawPrediction=null以说明未提供；纳入样本、真值分母加3、D加3、整串错误、failedSamples加1。不能根据status自动排除。

</details>

<details>
<summary>8. 5条记录：1条无truth、1条truth=null、1条truth为空、1条无truth但明确排除、1条正常正确。如何计数？</summary>

totalSamples=5、pendingSamples=3、excludedSamples=1、evaluatedSamples=1。仅正常正确那条进入分母，CER=0、整串准确率1。如果最后那条也待标注，则两个比率都为null。

</details>

<details>
<summary>9. 输入truth: 110与truth: '00110'是否可等价？</summary>

不等价。数值110已经丢失前导零，本模块直接拒绝数值型真值，不做隐式String转换补救。JSON中的答案必须加引号。

</details>

<details>
<summary>10. Bigram实验里为什么V是7而不是5或8？</summary>

5个普通词，加后继事件中的结束标记与未知词桶，共7。句首标记只作历史，不是可预测后继。the出现3次，book跟随2次，add-one概率是(2+1)/(3+7)=0.3。

</details>

<details>
<summary>11. bock到back和book距离都为1，为什么λ=1选book，λ=0选back？</summary>

λ=1时book语言概率0.3大于back的0.2，score更大。λ=0时两者分数同为−1，按固定字典序back排前。这个打分没有完整错误通道，不能解释为候选真实正确概率。

</details>

<details>
<summary>12. 阈值0.8后，接受样本100%正确，为什么端到端CER可能更差？</summary>

示例只接受正确的12，拒识305→308，把一次替换变成三次删除。接受覆盖率1/2，端到端CER由1/5升至3/5；端到端整串准确率仍1/2。漏掉拒识样本会选择性美化报告。

</details>

<details>
<summary>13. read the book → read book的WER是多少？中文是否可以直接用本章切词？</summary>

漏掉the，Dword=1、Nword=3，WER=1/3。中文往往没有词间空格，需提前约定分词器或改用字符指标；本章没有中文分词功能。

</details>

<details>
<summary>14. 编辑距离已经证明有一次删除，是否可以用答案把预测补回去后评分？</summary>

不可以。评估应该比较预测完成时的原始输出。补回字符属于参考答案泄漏，得到的成绩没有识别能力含义；人工订正要独立记录，不能覆盖本轮原始结果。

</details>

## 14. 面向研发分享的重点

可将这一章放在“识别已经跑通，怎样判断它是否有用”的课次，不要求一次讲完所有代码。建议围绕以下四个问题准备自己的讲稿：

| 段落 | 要讲清的结论 | 最有用的现场动作 |
|---|---|---|
| 错误对齐 | 漏一个字符不等于后面都分类错；回溯才能给S/D/I | 1203→123，逐步播放5×4矩阵 |
| 指标口径 | 分子分母和原始记录比一个百分比更重要 | 修改JSON、加入失败、清空标签、展示300% |
| 语言先验 | 常见词可以帮助建议，也可能毁掉数字或未登录词 | λ滑块、bock候选、00110保护 |
| 拒识与验证 | 阈值改变覆盖率，失败必须保留；在验证集选配置 | 阈值0.55→0.8→0.91，对比完整分母 |

可以留一道讨论题：如果把CER作为唯一优化目标，模型宁可少输出还是多输出？没有一概而论的答案；删除、插入、替换都计成本，还取决于输出策略与数据。需要把模型输出、拒识工作流和下游任务损失分开评估。

与后续章节的联系：第25章保留可检查的图像处理过程和原始预测；第26章组织独立照片、标注、模型版本和逐图结果，使用本章接口给出可重算的实测报告。

## 15. 技术来源与本章实现的边界

核验日期：2026-09-08。正文公式与结论对应以下原论文、作者资料或官方评估资料；本章数值样例、代码、阈值和字段约定是本项目的教学设计。

1. Wagner & Fischer，1974，[The String-to-String Correction Problem](https://dl.acm.org/doi/10.1145/321796.321811)：编辑操作和二维动态规划经典出处。本文实现单位成本、固定平局，未扩展转置。
2. Manning、Raghavan、Schütze，作者提供的 [Edit distance章节](https://nlp.stanford.edu/IR-book/html/htmledition/edit-distance-1.html)：用于核对递推与距离候选选择。
3. Kernighan、Church、Gale，1990，[A Spelling Correction Program Based on a Noisy Channel Model](https://aclanthology.org/C90-2036/)：先验与错误通道的分解；本章没有复现论文完整纠错程序。
4. Jurafsky & Martin，作者发布的 [N-gram Language Models](https://web.stanford.edu/~jurafsky/slp3/3.pdf)：N-gram近似、边界、对数概率与平滑；本章仅实现小词表bigram加平滑。
5. NIST，[OpenASR21评估报告](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=934557)：WER的S/D/I定义及CER的字符单位。其语音实验成绩不用于本项目OCR效果声明；本项目另行固定空值、排除与平局约定。
6. Guo等，2017，[On Calibration of Modern Neural Networks](https://proceedings.mlr.press/v70/guo17a.html)：区分置信度与真实正确概率；本章不实现温度缩放，不声称模型已校准。

**已知局限**：完整矩阵不适合超长文本；码点计数不等于多语言字素簇；WER只按空白切词；词典实验只看一个左词；拒识策略没有业务成本模型；评估器不负责照片标注质量、同源样本去重或数据泄漏检测。真实照片成绩与冻结配置的独立验证由后续集成完成。

## 16. 旧课颗粒度对标与落实

已实读`docs/COURSE_STANDARD.md`以及05、11章的README、Node实验主体和HTML输入、参数、过程展示部分；对标的是概念与实验颗粒度，不按行数堆代码。

| 旧课具体做法 | 第24章对应落实 | 与旧课的必要区别 |
|---|---|---|
| 05章README从噪声来源到3×3邻域算例、边界方式、三滤波比较 | §3解释S/D/I来源，§4展开5×4矩阵、单格三前驱、回溯平局；§5.7提供方法选择表 | 最短文本对齐不能直接证明照片噪声或分割根因 |
| 05章Node先展示核权重，再造10×10图像，再逐方法打印结果与PSNR | 实验1先打印输入/表/三候选，实验3再打印逐图错误、分子分母与micro/均值对照 | 用真实算法结果自检，不把固定教学案例当照片模型成绩 |
| 05章HTML调噪声、核尺寸和sigma，展示原图/含噪图/结果/核与对照 | HTML01展示原串/对齐/矩阵/单格候选；03调α/λ；04调τ并比较原始与拒识输出 | 无图像算法重复内嵌，所有核心计算来自同一shared模块 |
| 11章README逐类解释像素、统计、矩、投影、网格与HOG，并给实现与特征对比 | 本章对编辑距离、聚合、WER、词典、Bigram、拒识逐点给动机、符号、实例和步骤 | 不把本章未实现的Beam Search或完整错误通道写成已实现 |
| 11章Node打印样例字符、向量维度、变换前后结果和距离 | 实验4打印词数组及词级对齐，实验5打印词表维度/转移计数/归一化及α对照 | 每个算例通过共享算法产出，预期值用独立手算断言 |
| 11章HTML可手绘/选字符并查看统计、投影、网格、HOG和组合匹配 | 本章可改两串、JSON标注、词级输入、观测词和左词；查看对应中间状态 | 文本与矩阵用表格和步骤可视化，按问题选择呈现方式 |

补深后的Node有8组有标题实验及显式自检；README的对应表将核心知识点映射到三个主文件；HTML增加当前格候选成本、可操作的CER/WER对照以及真实Bigram计数和平滑过程。`alignSequences`和`evaluatePredictions`稳定字段契约保持不变。
