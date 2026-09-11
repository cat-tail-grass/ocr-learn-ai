# 17. CNN 字符分类器：真实训练、统一输入与独立评估

## 学习目标与本章交付

第 11–13 章把手工特征交给模板或 KNN，第 14–16 章解释反向传播、卷积和 TensorFlow.js。本章让**项目自己的 CNN 在真实 MNIST 图像上学习 0–9 分类**，完成数据下载、校验、划分、增强、训练、模型选择、保存和独立加载。

本章的结果是单字符分类器。它接收已经分割好的一个数字，不能直接把整张照片或多位数字图像变成完整字符串。第 25 章在它之前加入定位分割，第 26 章独立评估数字串。

前置知识：第 03–04 章的灰度/前景极性，第 09–10 章的区域与分割，第 11 章的矩和归一化，第 15 章的卷积维度，第 16 章的张量生命周期。

### 实际交付模型

| 项目 | 本次真实结果 |
|---|---|
| 模型 ID | `ocr-mnist-cnn-v1-9c7b0b8e8224` |
| 权重 SHA256 | `9c7b0b8e8224d188ddc38bcaf680dd032753441d6b3413870e7722a457fed90c` |
| 训练/验证 | 从 MNIST 原训练集拆分 55,000 / 5,000 |
| 独立测试 | 原始 t10k 的全部 10,000 张 |
| 参数/权重字节 | 14,538 / 58,152 |
| 训练 | TensorFlow.js 4.22.0，浏览器 WebGL，5 轮，种子 1701 |
| 历史 Dropout 策略 | seed=1704，同形状训练调用重复掩码；本轮保留模型和原成绩 |
| 模型选择 | 取验证交叉熵最低轮，第 5 轮 |
| 验证准确率 | 4,890 / 5,000 = 97.80% |
| 冻结后测试准确率 | **9,769 / 10,000 = 97.69%** |
| 时间 | WebGL 训练 141.18 秒；含保存、CPU 评估 151.36 秒 |
| 独立会话 | 新 Node 进程加载并推理 200 次，张量 8→8；释放模型后 0 |
| 真实照片成绩 | 尚未测量；样本数 0，准确率 null |

这些数值来自 `model/training-report.json` 和 `model/inference-verification.json`。`model/test-predictions.json` 保存全部真实标签和预测，可独立重新计数。MNIST 的 97.69% 不能写成照片或整串识别准确率，也不是对其他机器运行时的时间承诺。

2026-09-11 复核后，**新建模型与两个训练入口默认使用每次重新采样的 Dropout**。当前目录中的交付权重仍是上表的历史训练结果；没有重训，不能把97.69%归给修复后的新训练策略。区别见第四节。

## OCR 中的位置与方法对比

```text
训练路线：原始 MNIST → 固定划分 → 仅训练样本增强 → prepareDigit → CNN → loss → 梯度更新
部署路线：照片 → 预处理/定位/分割 → 单字符 RGBA → prepareDigit → CNN → 0–9 候选
                                                                           ↓
                                                                  按顺序拼接字符
```

| 方法 | 学什么/保存什么 | 推理工作 | 本章用途与限制 |
|---|---|---|---|
| 模板匹配 | 保存少量模板 | 逐个比相似度 | 可解释，但依赖模板覆盖 |
| KNN | 保存特征和标签 | 与训练库计算距离并投票 | 数据少时易用，库变大推理更贵 |
| 全连接网络 | 学像素到类别的权重 | 矩阵运算 | 不直接利用局部连接和参数共享 |
| 本章小 CNN | 学局部卷积核与分类权重 | 两次卷积、两层 Dense | 真实可部署基线，仍受输入域和分割限制 |
| 原始 LeNet-5 | 论文中的特定层次与训练设计 | 原论文网络 | 历史原理来源；本章并非逐层复刻 |

不能把第 13 章合成字符的 KNN 成绩和本章的真实 MNIST 测试成绩直接比较。公平对照需要相同的样本、划分、预处理和独立调参规则。

## 一、MNIST：数据来源、字节格式和划分

### 1. 为什么不用自己画十个标准字体

标准字体只提供有限的形状。MNIST 包含真实手写数字，能够学习同一类别的多种写法；但仍是已整理、居中的小图，缺少手机拍照的纸张纹理、阴影、透视、压缩和分割错误。因此它是单数字训练基线，不能替代真实照片开发和测试。

原始 MNIST 有 60,000 张训练图和 10,000 张测试图，每张 28×28、单通道、字节范围 0–255，标签是 0–9。原始灰度数据是背景低值、笔画高值。项目通过明确获得作者许可的 [CVDF 镜像](https://github.com/cvdfoundation/mnist) 下载原始 IDX 压缩文件，没有下载任何训练好的模型。

### 2. 下载与数据版本

实际 URL 前缀为 `https://storage.googleapis.com/cvdf-datasets/mnist/`：

| 文件 | 内容 | 已知 MD5 |
|---|---|---|
| train-images-idx3-ubyte.gz | 60k 原始训练图像 | f68b3c2dcbeaaa9fbdd348bbdeb94873 |
| train-labels-idx1-ubyte.gz | 60k 训练标签 | d53e105ee54ea40749a09fcbcd1e9432 |
| t10k-images-idx3-ubyte.gz | 10k 原始测试图像 | 9fb629c4189551a2d022fa330f9573f3 |
| t10k-labels-idx1-ubyte.gz | 10k 测试标签 | ec29112dd5afa0611ce80d1b7f02629c |

文件落在本章 `data/`。`data.js` 会验证 MD5、记录 SHA256 和字节数，再解压；损坏缓存会明确报错，不把 HTML 错误页当作图像。MD5 在这里用于辨认已知数据文件，不作为抗恶意篡改安全机制。原始数据缓存可重新下载，不放入源码提交；来源清单与模型报告保留哈希。

数据署名为 Yann LeCun、Corinna Cortes；来源链回溯到 NIST。依据 [Keras 官方 MNIST 页面](https://keras.io/api/datasets/mnist/) 的数据许可说明，记录为 CC BY-SA 3.0。导出的验证样本是 MNIST 的派生数据，随项目保留来源、原始索引及此许可说明；仓库代码许可证不能自动替代数据许可。

### 3. IDX 的具体结构与手算

图像文件解压后：

```text
字节  0–3 ：大端 uint32 魔数 2051 = 0x00000803
字节  4–7 ：图像数 N
字节  8–11：行数 28
字节 12–15：列数 28
字节 16 起：逐样本、逐行排列的 uint8 像素
```

标签文件头 8 字节，魔数为 2049；后面 N 个字节即标签。

原训练图像解压长度应为 `16+60000×784=47040016` 字节。第 i 张图第 y 行 x 列的偏移为：

\[
\operatorname{offset}=16+i\cdot784+y\cdot28+x
\]

例如第 2 张图（i=1）的左上角在偏移 800，值只表示像素强度，不表示标签。标签在另一个文件的 `8+i` 位置。解析器必须验证魔数、尺寸、精确总长度及标签范围，不能仅使用一个大 Buffer 然后猜测结构。

`parseImages`/`parseLabels` 的独立测试构造一个手写 IDX Buffer，检查大端读取、截断文件、错误魔数和标签 10。

### 4. 为什么训练、验证、测试要分开

训练集用于梯度更新；验证集用于模型选择和预处理/参数实验；测试集只测已经冻结的方案。若用测试集选择 epochs、旋转范围或模型结构，再报告同一测试集成绩，就不再是干净的独立评估。

本章用种子 1701 的 Fisher–Yates 洗牌把原训练索引分成：

```text
shuffled[0:5000]     → validation
shuffled[5000:60000] → training
原 t10k 10000 张     → test，不混入上面的洗牌
```

`model/split.json` 的字段明确为 **training、validation、unused**，不是 `validationIndices`。全部是对应原始训练 IDX 的零基索引；默认 unused 为空数组。验证和训练互斥，并覆盖原始 60k。浏览器的十个样例从 validation 里按每类第一个样本导出，不按模型是否预测正确挑样本。

一个最小划分算例：原索引 `[0,1,2,3,4]` 若固定打乱为 `[3,0,4,1,2]`，取前两项验证，则验证 `[3,0]`、训练 `[4,1,2]`，不存在重复索引。划分必须先于增强，同一原样本的旋转版本不能“新增”到验证集。

对真实照片，应先按原图及可用的书写者标识分组，再分配集合，最后才切字符和增强。本章 MNIST IDX 不包含用于重新分组的完整书写者元数据，因此不宣称这个验证划分具有额外的书写者隔离保证。

## 二、统一输入：让训练和推理看到相同的数字

### 1. 为什么极性、留白和居中是模型接口

相同的“7”，若训练时笔画是 1、部署时笔画是 0，网络面对的是完全不同的图案。若训练时有留白，部署时把笔画拉满 28×28，也会改变笔画宽度与卷积响应。

项目将输入协议固定为 `dark-rgba-bbox20-centroid-v1`。训练首先把 MNIST 白笔画黑背景字节转成浅背景深笔画 RGBA，然后与第 25 章调用**同一个** `prepareDigit`。不是训练直接除以 255，而部署另外做一套裁剪。

### 2. 从 RGBA 到前景强度

设 R/G/B/a 为输入通道，α=a/255。先与白背景合成，再取前景强度，合并后的公式是：

\[
g=0.299R+0.587G+0.114B,\qquad
u=\alpha(1-g/255)
\]

u=0 表示白背景，u=1 表示黑色不透明笔画。透明黑色像素 α=0，应得到 0，不能被误认为墨迹。

例：灰度 g=51、α=1，得到 u=0.8；同一像素 α=0.5，则 u=0.4。先用固定阈值 `u>0.08` 求笔画包围框；没有任何超过阈值的像素就返回 blank=true。再除以本图最大 u，保留笔画灰度层次。

这不是对任意光照的自适应背景校正。均匀灰纸、明显阴影、灰尘会使 bbox 错误，照片上游仍需得到合理的浅背景单字符图。不要把峰值归一化理解成可以自动去掉任意阴影。

### 3. 保持比例缩放的尺寸推导

包围框宽高为 Wc、Hc，最长边目标是 20：

\[
s=20/\max(W_c,H_c),\quad
W'=\operatorname{round}(sW_c),\quad H'=\operatorname{round}(sH_c)
\]

W′/H′ 至少为 1，放进 28×28 的零背景画布。横纵取整可能产生不超过一个像素的比例误差。

算例：bbox=10×20，s=1，因此缩放仍是 10×20，几何放置的 left=(28−10)/2=9、top=(28−20)/2=4。bbox=4×20 的细“1”仍是 4×20，**不会拉成 20×20**。

双线性采样把一个目标位置映射回源图的浮点位置。若四个邻居的强度为 `u00,u10,u01,u11`，横纵小数部分为 dx、dy：

\[
u=(1-d_x)(1-d_y)u_{00}+d_x(1-d_y)u_{10}
 +(1-d_x)d_yu_{01}+d_xd_yu_{11}
\]

手算例：四角 `[0,1;1,0]`，dx=dy=0.5，结果为 0.5。这保留边缘的灰度过渡，但下采样很强时不能保证完全抗混叠；最终输入质量仍依赖分割区域和笔画分辨率。

### 4. 重心居中与第 11 章的联系

几何 bbox 居中未必代表墨迹居中。对缩放后的强度 p(x,y)，定义：

\[
m=\sum p,\quad \bar x=\frac{\sum xp}{m},\quad
\bar y=\frac{\sum yp}{m}
\]

目标中心坐标为 `(13.5,13.5)`。整数平移量是 `round(13.5−x̄)`、`round(13.5−ȳ)`，并限制平移范围，防止把已缩放笔画移出画布。这正是第 11 章零阶矩、一阶矩的实际应用。

求重心要求m>0。原图通过阈值检测，不保证缩放后仍非空：100×100白图仅左上/右下两个像素为黑时，bbox覆盖整图，缩为20×20的采样点会错过两点，最终m=0。本模块返回 `blank:true, blankReason:'empty-after-resize'` 并保留原bbox，不计算0/0、不调用分类器。原图就没有前景时原因是 `no-foreground`。这修正的是空白拒识边界，非空输入的插值/居中数值及已有协议ID保持不变。

例如墨迹只在 x=10 和 x=14，各自质量 1 与 3，则重心 x̄=(10+42)/4=13；向右取整移动 1 像素后中心为 14，与 13.5 相差 0.5。整数移动允许半像素误差；若受到画布边界约束，最终偏差可能更大。

### 5. 与代码逐步对应

```javascript
const { prepareDigit, mnistToImage } = require('../shared/17-cnn-classifier');
const rgba = mnistToImage(raw784Bytes);
const prepared = prepareDigit(rgba);
// prepared.pixels: Float32Array(784)，用于模型；不是展示图的黑白字节。
// prepared.imageData: {width:28,height:28,data:Uint8ClampedArray}，浅底深色展示图。
// prepared.blank: 空白拒识状态。
const input = tf.tensor4d(prepared.pixels, [1,28,28,1]);
```

实现顺序是验证 RGBA → 计算 u 和 bbox → 原图空白分支 → 峰值归一化 → 保持比例双线性缩放 → 缩放后空白分支 → 重心平移 → 构造显示图。所有步骤在纯 JS shared 中，不依赖 Canvas/DOM。`prepareSamples` 遇到空白会报出原始样本索引，避免把全零图像带数字标签继续训练或评估。

`options.threshold` 和 `options.contentSize` 仅供独立实验。部署已保存模型必须使用默认 0.08/20；改变选项就是改变输入协议，不能再声称与本次训练完全一致。`preprocessingId` 标识本模块算法版本，不代替非默认选项的记录。

边界测试包括透明黑图、纯白图、不同画布边距、细长图形、灰度归一化、RGBA NaN、尺寸与数据长度不匹配。

## 三、CNN：由局部特征到十类概率

### 1. 架构动机

全连接层把像素看作向量，卷积则复用同一组局部权重。两个卷积层提取从局部笔画到组合形状的特征，Dense 将这些特征映射为类别。这里选择小模型以便在浏览器端快速加载和推理，不声称达到 MNIST 最佳公开成绩。

### 2. 精确维度与参数数

| 层 | 设置 | 单样本输出 | 参数计算 |
|---|---|---|---:|
| 输入 | NHWC，背景 0 / 笔画 1 | 28×28×1 | 0 |
| Conv1 + ReLU | 5×5，8 通道，stride=2，valid | 12×12×8 | (5×5×1+1)×8=208 |
| Conv2 + ReLU | 3×3，16 通道，stride=2，valid | 5×5×16 | (3×3×8+1)×16=1168 |
| Flatten | 按存储次序展平 | 400 | 0 |
| Dense + ReLU | 32 单元 | 32 | 400×32+32=12832 |
| Dropout | rate=0.15，仅训练生效 | 32 | 0 |
| Dense + softmax | 10 类 | 10 | 32×10+10=330 |
| 合计 | | | **14538** |

空间尺寸公式：`floor((H−K+2P)/S)+1`。第一层 H=28、K=5、P=0、S=2，得到 floor(23/2)+1=12；第二层 floor((12−3)/2)+1=5。

本网络以 stride=2 的卷积降采样，**没有最大池化层**。第 15 章讲过池化，但不能把课本示意图中的池化写进实际模型报告。Flatten 没有参数，Dense 的参数却占了绝大多数。

### 3. 卷积计算的约定

框架 conv2d 按互相关方式应用核，不进行数学卷积中的空间翻转：

\[
z_{y,x,o}=b_o+\sum_{i,j,c}X_{Sy+i,Sx+j,c}K_{i,j,c,o}
\]

o 是输出通道，c 是输入通道，i/j 遍历核，S 是步幅。ReLU 再输出 `max(0,z)`。

可手算的小窗口 `[1,2;3,4]` 与核 `[1,0;0,−1]` 的响应是 `1−4=−3`；偏置 1 得 −2，ReLU 后为 0。若另一个核响应为 5，ReLU 则保留 5。不同通道学习不同的局部响应，不能事先把某个卷积通道指定为“数字 7 通道”。

`inspectDigitFeatures` 实际执行已训练模型的前两个卷积层，返回 12×12×8、5×5×16 的真实激活。网页每层展示前四个通道，并分别缩放显示亮度；不同图的视觉亮度不能直接比较绝对幅值，数值范围单独标注。

### 4. softmax 与交叉熵

logits z 有 10 个分量，softmax 给出：

\[
p_k=\frac{e^{z_k-m}}{\sum_j e^{z_j-m}},\quad m=\max_jz_j
\]

减去 m 不改变比例，但减少指数溢出。输出最大概率对应的索引映射到字符串标签 `'0'`…`'9'`。

三类手算例：`z=[2,1,0]`，减最大值后指数约 `[1,0.3679,0.1353]`，归一化得到 `[0.6652,0.2447,0.0900]`。若真实类别是第 0 类，交叉熵 `−log(0.6652)≈0.4076`。

对 one-hot 标签 y，批次交叉熵为：

\[
L=-\frac1B\sum_i\sum_{k=0}^{9}y_{ik}\log p_{ik}
\]

真实类别上 y=1，其他为 0，所以每张图只累加真实类别的负对数概率。对未裁剪的理想softmax交叉熵，logits梯度是 `(p−y)/B`，解释了模型如何把真类的分数推高。

**当前框架路径的数值边界：**TF.js 4.22.0 的 Layers `categoricalCrossentropy` 先将概率按行归一化，再裁剪到 `[ε,1−ε]` 后取对数。ε由运行后端提供，并由Layers在首次使用时缓存：本项目Node CPU为10⁻⁷，部分WebGL环境为10⁻⁴。这与直接在logits上算 `logsumexp(z)−z_y` 的融合损失不同；触及裁剪时，梯度不能再无条件写成p−y。`tf.metrics.categoricalCrossentropy` 复用该Layers函数，`tf.losses.softmaxCrossEntropy` 则是接受logits的Core融合路径。本章历史与新训练入口仍保留原Layers损失；下列对照只解释差异，不暗中替换目标。

| 单样本反例 | Layers 概率损失 / logits梯度 | Core logits损失 / logits梯度 |
|---|---|---|
| z=[2,1,0]，真类0 | 约0.407606 / [−0.334759,0.244728,0.090031] | 约相同 |
| z=[1000,−1000,0]，真类1；ε=10⁻⁷ | 约16.118095 / [0,0,0] | 2000 / [1,−1,0] |
| 同一极端例，ε=10⁻⁴的WebGL环境 | 约9.210340 / [0,0,0] | 2000 / [1,−1,0] |

极端反例中的softmax在float32下为[1,0,0]。概率裁剪避免log(0)，却也使损失封顶、真类方向的梯度被截断；数值稳定不等于与理想函数处处等价。共享 `crossEntropyComparison`、Node实验8和网页第5区都实际计算损失及自动微分。源码见 [TF.js Layers损失](https://github.com/tensorflow/tfjs/blob/tfjs-v4.22.0/tfjs-layers/src/losses.ts) 和 [Core logits损失](https://github.com/tensorflow/tfjs/blob/tfjs-v4.22.0/tfjs-core/src/ops/losses/softmax_cross_entropy.ts)。

网页显示运行后端，并用“真类概率恰为0”的探针实测ε≈exp(−loss)，因此换浏览器后可以解释截断数值差异，而不只核对固定常数。此处ε是框架用于裁剪的稳定常数，不应解释为该浮点格式的最小可表示正数。缓存行为与WebGL精度分支可对照[Layers backend/common](https://github.com/tensorflow/tfjs/blob/tfjs-v4.22.0/tfjs-layers/src/backend/common.ts)和[WebGL backend](https://github.com/tensorflow/tfjs/blob/tfjs-v4.22.0/tfjs-backend-webgl/src/backend_webgl.ts)。

历史报告中 `crossEntropy` 由评估器按 `−mean(log(max(10⁻⁷,p_true)))` 计算；模型选择使用fit提供的验证Layers损失。它们都是带数值截断的指标，报告原值保持不变。

不要将 softmax 输出再次当作 logits 套一次 softmax，也不要把整数标签直接传入本项目的 one-hot categoricalCrossentropy 路径。`prepareSamples` 将标签 3 变为 `[0,0,0,1,0,0,0,0,0,0]`，形状是 `[B,10]`。

### 5. 创建与训练接口

```javascript
const { createDigitModel } = require('../shared/17-cnn-classifier');
const model = createDigitModel(tf, {seed:1701});
model.compile({
  optimizer: tf.train.adam(0.001),
  loss: 'categoricalCrossentropy', metrics: ['accuracy']
});
```

`createDigitModel` 只返回未训练的 LayersModel，不偷偷加载成品模型，也不隐式启动训练。每个可训练层使用明确的带种子初始化器。

Adam 对梯度的一阶/二阶矩做指数滑动平均，用归一化后的更新步长处理不同参数的梯度尺度；它不是保证收敛的黑盒。简写为 `m←β1m+(1−β1)g`、`v←β2v+(1−β2)g²`，偏差校正后更新 `θ←θ−η m̂/(√v̂+ε)`。本项目仅指定 η=0.001，其余使用当前 TF.js Adam 默认值，并固定版本。

## 四、增强、过拟合与正则化

### 1. 为什么增强应来自任务条件

字迹轻微倾斜或变宽可以保留类别，水平翻转、180° 旋转却可能改变数字含义。例如把 6 旋转成类似 9 后仍标 6，会制造错误监督。增强不是越多越好，而是在不破坏标签的条件下模拟合理变化。

本次每一轮对训练样本以 0.5 概率做：旋转均匀采样于 ±8°，横向比例采样于 [0.9,1.1]。增强在原始浅底 RGBA 上完成，之后仍调用 prepareDigit；验证和测试都不增强。

### 2. 逆向映射与数值例子

在中心 `(cx,cy)` 周围取输出点偏移 `(dx,dy)`，旋转角 θ，横向比例 a。为避免正向撒点留下空洞，逐输出像素反查源位置：

\[
x_s=(\cos\theta\,dx+\sin\theta\,dy)/a+c_x,
\quad y_s=-\sin\theta\,dx+\cos\theta\,dy+c_y
\]

例如 θ=0、a=1.1，输出点 dx=5.5 对应源 dx=5，意味着图形横向被拉宽 10%。θ=0、a=1 时映射恒等，独立测试核对这一点。源图越界按背景 0 处理，使用同一双线性采样函数。

本实现增强针对灰度单数字。原始 MNIST 的 RGB 通道相同；函数从红通道读取强度，因此彩色图片的旋转实验不等价于完整彩色图像处理器。其范围和用途在此明确，不包装成通用增强框架。

### 3. Dropout 的数学含义

训练时以 q=0.15 概率置零某个隐藏激活，保留部分除以 1−q：

\[
\tilde h_j=m_jh_j/(1-q),\qquad m_j\sim\operatorname{Bernoulli}(1-q)
\]

因此在理想采样下 `E[h̃j]=hj`。若 hj=2、该次保留，则训练输出约 `2/0.85=2.3529`；若丢弃则为 0。推理关闭 Dropout，直接使用激活，不随机删除神经元。

Dropout 限制神经元对特定组合的依赖；增强扩大训练输入变化。两者作用不同，均不能弥补错误标签或训练测试泄漏。本模型没有加 L2 权重衰减，不能在报告中虚构已经做过的正则化。

### 4. 固定种子与每次重新采样不是同一件事

本轮通过 [TF.js 4.22.0 Dropout源码](https://github.com/tensorflow/tfjs/blob/tfjs-v4.22.0/tfjs-core/src/ops/dropout.ts) 和重复调用核实：Layers把同一个seed传给每次Dropout；相同形状、固定seed时会重新生成同一掩码。已保存模型配置seed=1704，不能声称当时每个训练batch都独立重采样。每轮样本顺序改变，所以不同样本仍可能遇到不同位置的掩码，但这不能替代独立抽样结论。单次掩码在随机种子分布上的期望公式，也不能当作固定掩码跨步骤的时间平均保证。

| 路径 | 配置 | 实际行为 / 成绩归属 |
|---|---|---|
| 当前已保存模型 | Dropout seed=1704 | 历史固定掩码；对应上表97.69% |
| 新建模型、CPU/WebGL训练默认 | `dropoutSeedPolicy:'resample'`，省略Dropout seed | 每次训练调用重新采样；本轮未重训、无新成绩 |
| 显式历史演示 | `createDigitModel(tf,{seed:1701,dropoutSeedPolicy:'legacy-fixed'})` | 重放旧掩码策略，仅供核对历史 |

初始化、划分、样本顺序和增强仍使用固定种子；新默认的Dropout不保证跨跑逐位复现。`inspectDropout` 用8×32个全1激活调用实际层两次，检查掩码，并核对 `training:false` 原样返回输入；不执行fit、不修改权重。Node实验8也读取已保存模型的真实Dropout层。新的CPU/WebGL配置与新模型元数据记录策略，不能用旧报告证明新训练已完成。

### 5. 怎样识别过拟合

训练损失持续下降而验证损失回升，是值得检查的信号。还需检查样本数、划分泄漏和输入差异；不能只看训练准确率接近 100%。本次训练准确率是在带增强、Dropout 激活的批次上累计，验证集则是无增强、关闭 Dropout，二者不是完全相同难度的测量。

| 可调项 | 增大后的可能收益 | 代价与限制 |
|---|---|---|
| 训练轮数 | 更充分学习 | 可能过拟合；用验证损失选 checkpoint |
| 通道数/隐藏维度 | 更强表示能力 | 更大计算量/模型，可能更需数据 |
| 旋转幅度 | 覆盖更大倾斜 | 可能改变笔画关系或越界裁断 |
| Dropout 比例 | 降低部分共适应 | 太高造成欠拟合 |
| batchSize | 吞吐可能增加 | 内存增加，更新次数与统计变化 |

这些是机制分析，并非本项目已经对所有选项完成了严格消融实验。本次只运行一套预先固定的模型配置；测试集没有用于选择这些选项。

## 五、真实训练流程与复现

### 1. 训练步骤

1. 验证四个原始压缩文件，解码原训练图像/标签。
2. 固定划分并写 `split.json`、配置和来源哈希。
3. 创建全新 CNN 与 Adam；每轮重新以固定规则打乱训练索引。
4. 仅对训练样本生成增强，走同一 prepareDigit，打包 `[N,28,28,1]` 与 `[N,10]`。
5. 每轮 fit 一次，关闭 fit 内部非确定的洗牌，用已经显式洗好的顺序。
6. 在验证集测量损失、准确率；只在验证损失下降时保存模型。
7. 完成全部 5 轮，冻结选中 checkpoint。
8. 重新加载保存模型，**这时才解码 t10k** 并评估全部 10k；保存混淆矩阵、逐样本预测。

浏览器 WebGL 与 CPU 脚本调用相同的 `createDigitModel`、`prepareSamples` 和模型保存接口。随机种子固定初始化、划分、每轮顺序与增强；新默认Dropout每次重新采样，且不同后端浮点计算也可能不同，不能承诺跨跑逐位重现同一权重哈希。这些入口将产生新的训练实验，不能复写历史模型或套用历史成绩。

### 2. 本次训练曲线

| epoch | 训练 loss | 训练 acc | 验证 loss | 验证 acc | 轮耗时秒 |
|---:|---:|---:|---:|---:|---:|
| 1 | 0.586853 | 0.818691 | 0.195711 | 0.9400 | 59.83 |
| 2 | 0.215845 | 0.937145 | 0.121283 | 0.9632 | 19.80 |
| 3 | 0.155573 | 0.954400 | 0.099071 | 0.9684 | 18.31 |
| 4 | 0.129641 | 0.961364 | 0.081821 | 0.9748 | 20.46 |
| 5 | 0.118074 | 0.965145 | 0.073675 | 0.9780 | 19.01 |

最初尝试纯 Node CPU，约 30 秒完成 24 个 128 样本批次，首轮未完成时已证实 WebGL 可用，故停止 CPU 那次试跑。完整正式模型来自 WebGL 训练，不能把 CPU 部分日志当作另一个已完成模型。CPU 试跑记录放在 `benchmarks/cpu-interrupted.log`。

### 3. 快速运行与依赖

首次在根目录 `npm install` 安装项目依赖。主代理统一维护 `@tensorflow/tfjs`、esbuild 和启动脚本。本章不要求 tfjs-node；当前 Apple arm64 / Node 24 环境实际使用 CPU 推理、浏览器 WebGL 训练。

```bash
# 下载可再生的原始数据；首次运行需要网络
node 17-cnn-classifier/data.js
# 快速课程实验：不会训练或改动模型
node 17-cnn-classifier/index.js
# 新进程加载与泄漏验证
node 17-cnn-classifier/verify.js
# 默认只打印本次结果。留档时指定尚不存在的新报告，禁止覆盖历史文件：
node 17-cnn-classifier/verify.js 17-cnn-classifier/model /tmp/ocr-inference-new.json
# 独立单元测试
npx jest shared/__tests__/cnnDigitClassifier.test.js --runInBand
# 静态页面
npm run build
npm start
```

[单数字交互实验](http://127.0.0.1:4173/17-cnn-classifier/) 默认加载交付模型，不要求读者现场重新训练。验证样本已随课程导出，浏览器与 Node 快速实验都不需要下载全部 MNIST；仅从头训练和 verify.js 的原始测试检查需要 gzip 缓存。

### 4. 从头重训：使用新输出目录

以下命令采用修复后的 `resample` 策略，运行结果属于新实验，不是历史固定掩码训练的逐位复现。历史策略只通过上节明确的 `legacy-fixed` 选项演示；默认训练入口使用新策略。

```bash
# CPU 路线，耗时更长；不覆盖当前交付模型
node 17-cnn-classifier/train.js --output 17-cnn-classifier/model-reproduction

# 推荐在支持 WebGL 的浏览器从头训练
node 17-cnn-classifier/train-webgl.js 17-cnn-classifier/model-reproduction-webgl
# 保持 npm run dev 或构建后的 npm run preview 服务，再打开本章训练页
```

打开 [本章 WebGL 训练页](train.html)。课程站中的路径为 `/labs/17-cnn-classifier/train.html`；部署前缀为 `/ocr/` 时是 `/ocr/labs/17-cnn-classifier/train.html`。先核对页面显示的当前来源与“数据桥地址”，点击“检查连接（只读配置）”，确认后再点击“开始真实训练”。

WebGL 数据桥默认只监听 `127.0.0.1:4174`，默认允许页面来源为 `http://127.0.0.1:4173`；不上传云端。桥从已验证的 IDX 生成训练/验证 Tensor 数据，浏览器运行同一模型，完成每轮后把自己训练的权重回传本机保存。结束后可关闭数据桥；推理页不依赖它。已有模型目录会被拒绝覆盖，复现实验应指定新目录。

只检查站点与桥的连接时，可以在另一终端启动只读配置模式；它不下载 MNIST、不创建模型输出目录，也不运行训练：

```bash
node 17-cnn-classifier/train-webgl.js --config-only
```

站点与数据桥使用不同端口时，应明确指定允许的页面来源，例如站点在4175、桥在4176：

```bash
SITE_PORT=4175 npm run dev
# 在另一个终端启动；准备真实训练时删除 --config-only 并指定新的输出目录
OCR_TRAIN_PORT=4176 OCR_TRAIN_ORIGINS=http://127.0.0.1:4175 node 17-cnn-classifier/train-webgl.js --config-only
```

此时把训练页“数据桥地址”改为 `http://127.0.0.1:4176`，也可使用查询参数 `?bridge=http%3A%2F%2F127.0.0.1%3A4176` 预填。`OCR_TRAIN_ORIGINS` 可用逗号分隔多个精确的本机来源；未显式设置时由 `SITE_HOST` 与 `SITE_PORT` 推导。来源只包含协议、主机与端口，不包含 `/ocr/` 等路径；`localhost` 与 `127.0.0.1` 是不同来源，必须与浏览器地址一致。

一次性在内存准备 55k float32 输入约 172.48 MB，另有标签、原始数据和中间激活，因此实际峰值更高。大规模数据应用应改用流式批次；本章当前规模可在本机运行，但并非完整生产训练平台。

## 六、评估：准确率、混淆矩阵与照片差异

### 1. 单数字准确率与手算

\[
Accuracy=\frac{\sum_i[\hat y_i=y_i]}{N}
\]

例：真值 `[0,0,1,1]`、预测 `[0,1,1,1]`，正确 3/4=75%。混淆矩阵**行是真实类别，列是预测类别**：

```text
            预测0  预测1
真实0          1      1
真实1          0      2
```

类别 1 的 precision=2/(1+2)=2/3；类别 0 的 recall=1/(1+1)=1/2。准确率给整体比例，混淆矩阵给出错方向。空样本集合准确率应返回 null，不能伪装为 0% 或产生 NaN。

### 2. 本次完整测试的错误

测试正确 9769、错误 231。真实 9 的召回率是 `950/1009≈94.15%`，其中 18 个 9 被预测成 7，13 个被预测成 4。全部逐类指标和混淆矩阵保存在训练报告，浏览器也展示矩阵。

这些信息用于解释已完成结果。若据此修改模型、再反复检查相同测试集，应记录为下一轮开发分析，不能继续宣称该集合未参与决策。本次没有依据这批错误修改交付权重或输入规范。

### 3. softmax 高分不是照片正确率

模型被要求在 0–9 中选类别，即使输入是字母、断掉的一半数字或两个数字黏连，也可能给出很高分。prepareDigit 可以检测空白，但不是完备的分布外检测器。本项目没有据 MNIST 分数校准一个保证照片正确率的阈值。

若单字正确率约 p，假设各字错误独立，长度 L 的全串正确率粗略是 p^L。例如 p=0.98、L=8 时为约 0.851。但实际错误会相关，还叠加漏检、重复框、次序和分割，所以这只是一项解释用的简化计算，不能作为照片成绩。

第 24/26 章使用编辑距离给出 CER 和整串完全正确率，失败的有效照片也必须进入分母；前导零和重复数字保持字符串语义。

## 七、共享 API、产物与排障

### 关键接口

| API | 输入 | 输出/所有权 |
|---|---|---|
| prepareDigit | 浅底深色 `{width,height,data}` RGBA | `{pixels,imageData,blank,blankReason?,bounds,preprocessingId}`；空白原因区分原图/缩放后；无 Tensor |
| createDigitModel(tf,{seed,dropoutSeedPolicy}) | TensorFlow.js 实例 | 未训练 LayersModel；默认resample，可显式legacy-fixed；调用方负责dispose |
| predictDigit(tf,model,prepared) | 预处理返回值 | 字符串 label、confidence、10 个概率；空白 label=null；内部 tidy |
| inspectDigitFeatures | 非空 prepared | 两层真实激活的 shape、普通数组；内部 tidy |
| classificationReport | 等长整数标签数组 | 准确率、混淆矩阵、逐类 precision/recall |
| makeSplit | 原始样本数、seed/size | 原 IDX 的 training/validation/unused 索引 |
| crossEntropyComparison | tf、logits数组、目标索引 | Layers/Core两种损失和logits梯度；内部tidy，不训练 |
| inspectDropout | tf、含Dropout的本章模型 | 两次训练调用掩码比较、推理恒等检查；无权重更新 |

第 25 章加载方式：

```javascript
const model = await tf.loadLayersModel('/17-cnn-classifier/model/model.json');
const prepared = prepareDigit(characterRGBA);
if (!prepared.blank) {
  const result = predictDigit(tf, model, prepared);
  // result.label 是字符串。多个结果应按框的从左到右顺序拼接。
}
```

模型 JSON 包含 `userDefinedMetadata`，记录输入规范、标签映射、seed、选中轮次、训练脚本、模型 ID 和权重哈希。Node 的 `model-io.js` 在加载时校验 SHA256。全部输出只供推理，未保存 Adam 状态，不宣称可以无缝接着原训练状态恢复。

### 产物目录

```text
17-cnn-classifier/
  README.md / index.js / index.html / browser.js
  inference-browser.js / webgl-training.js / train.html
  data.js / model-io.js / train.js / train-webgl.js
  verify.js / export-samples.js / validation-samples.json
  data/                  原始 gzip 缓存和 sources.json
  model/
    model.json           拓扑与元数据
    weights.bin          本项目训练权重
    split.json           全部训练/验证原始索引
    config.json          来源、环境与训练配置
    training-curve.json   每轮实测曲线
    training-report.json 完整报告与混淆矩阵
    test-predictions.json 全部 10k 真值与预测
    inference-verification.json 新会话加载与 200 次推理记录
```

### 常见失败与定位顺序

| 现象 | 首先核对 | 为什么 |
|---|---|---|
| 全白图片仍预测一个数字 | 是否先检查 blank | softmax 总会在十类中给分 |
| 数字被拉得很胖 | 是否保持比例、contentSize 是否 20 | 模型训练中细“1”并没有拉成方形 |
| 画布能识别，照片不能 | bbox、阴影、裁剪框、极性 | 大多是输入域或分割差异，不能先调分类阈值 |
| 模型加载 404 | 本地服务、JSON 和 bin 相对路径 | 两个文件缺一不可 |
| CPU 训练看似卡住 | 日志中的 batch、后端、GPU 可用性 | 当前 Node 包不是原生 TensorFlow 后端 |
| 验证很好，现场不行 | 照片来源、写法、分割和域差异 | MNIST 测试不能代表拍照数字串 |
| 重复点击后内存增长 | 临时输入/输出、模型、optimizer 的所有权 | JS 引用消失不等于后端 Tensor 已释放 |

## 知识点—文档—HTML—Node 对应表

| 知识点 | 文档位置 | HTML 实验 | Node 实验/函数 |
|---|---|---|---|
| 真实数据和划分 | 第一节 | 内置验证样本、原始索引和真值 | 实验 1、data.js、makeSplit |
| 极性/裁剪/居中 | 第二节 | 原图、28×28 输入并排、空白状态 | 实验 2 ASCII 图、prepareDigit |
| 卷积架构与维度 | 第三节 | 两层真实激活通道与数值范围 | 实验 1 参数表、实验 3 激活统计 |
| 十类分类与损失 | 第三/六节 | 候选概率条和模型 ID | 实验 5 十类分数，实验 6 指标 |
| 增强与局限 | 第四节 | ±8° 与超范围 +20° 对照 | 实验 4 增强前后 bbox 和墨迹质量 |
| 过拟合/模型选择 | 第四/五节 | 真实 train/validation 曲线、训练页状态 | 实验 6 逐轮表、train.js |
| 评估与错误分析 | 第六节 | 混淆矩阵、真实样本量 | 实验 6 手算矩阵与完整报告 |
| 生命周期 | 第七节 | 25 次预测的张量计数 | 实验 7；verify.js 新会话 200 次 |
| 损失截断/Dropout实际采样 | 第三/四节 | 第5区普通/极端数值与掩码对照 | 实验8；不训练、不保存模型 |

## 自测与答案

1. 为什么增强必须在划分之后？MNIST 的 60k 和 10k 如何使用？
2. 原训练图像的解压字节数是多少？第 i 个样本的像素在哪里？
3. 透明黑色像素的前景强度是多少？4×20 的细数字会变成 20×20 吗？
4. 第一层为什么是 12×12×8？它有多少参数？
5. 为什么 Flatten 没参数，而紧接着 Dense 占 12832 个参数？
6. `[2,1,0]` 的 softmax 最大概率约多少？若真实类别为 0，loss 约多少？
7. Dropout 的训练与预测行为有何区别？
8. 为什么训练准确率可能低于验证准确率？
9. 真实 9 的召回率从报告怎样计算？能据此反复调参再声称测试独立吗？
10. 单字 97.69% 为什么不能当作照片数字串 97.69%？
11. 重新加载推理应保留哪些元数据？为何只保存权重不足以恢复同一训练状态？
12. tf.memory 的 numTensors 恒定是否证明全部浏览器内存都没有缓存？

<details><summary>展开答案</summary>

1. 同一原图衍生样本跨集合会泄漏。60k 内拆 55k 训练/5k 验证，独立 10k 留到配置冻结后。
2. 47040016 字节；头 16 字节后，第 i 张从 `16+i×784` 起。
3. α=0，所以前景 0；保持比例后仍为 4×20，放入有留白的 28×28。
4. floor((28−5)/2)+1=12，8 个输出通道；(25+1)×8=208 参数。
5. 本模型的Flatten保持NHWC元素存储次序，仅合并空间/通道轴；Dense对400个输入和32个输出建立权重，再加32个偏置。
6. 最大概率约 0.6652，交叉熵约 0.4076。
7. 理想Dropout在训练中独立采样、置零并缩放保留激活；新建默认按每次调用重新采样，历史固定seed配置会重复同形状掩码。两者推理都不执行随机删除。
8. 训练带增强与 Dropout，验证关闭；它们不是相同条件下的指标。
9. 950/1009≈94.15%；若依据测试错误调参，应视为测试数据已参与开发。
10. 还存在域差异、分割/排序错误及整串多字符错误累积；必须独立测照片。
11. 输入规范、标签、模型 ID、数据与划分、配置、版本；精确恢复还需要优化器/随机/数据顺序状态。
12. 不能。它检验 Tensor 累积，不是操作系统/显卡总内存或浏览器缓存计数。

</details>

## 分享重点与下一章

从一张真实 MNIST 开始，展示黑白极性、bbox、28×28 输入、两层激活、十类分数；再展示训练与验证曲线、完整测试矩阵和一例错误。让听众清楚区分“模型预测了一次”“模型在独立样本上有统计成绩”“整条照片 OCR 流程可用”这三个层级。

第 18–20 章将讨论 RNN、CTC、CRNN 怎样直接建模序列。本章单字符路线需要先切字，它的优点是每个错误阶段可检查；遇到严重粘连或自然语言序列时，切分假设可能成为瓶颈。序列课程是可解释的另一条路线，不是本章已经实现的能力。

## 原论文与官方参考

- [CVDF MNIST 镜像与 IDX 说明](https://github.com/cvdfoundation/mnist)：原作者许可镜像、四个原始下载链接。
- [Keras 官方 MNIST 数据页面](https://keras.io/api/datasets/mnist/)：尺寸、原始划分、标签范围与数据许可。
- [LeCun 等，Gradient-Based Learning Applied to Document Recognition](https://leon.bottou.org/papers/lecun-98h)：作者提供的原论文入口；卷积文档识别的历史来源。本章结构并非完整 LeNet-5。
- [TensorFlow.js 官方手写 CNN 教程](https://www.tensorflow.org/js/tutorials/training/handwritten_digit_cnn)：框架训练单数字的基本流程。本项目独立定义结构和输入协议并自行训练权重。
- [官方训练指南](https://www.tensorflow.org/js/guide/train_models)与[保存加载指南](https://www.tensorflow.org/js/guide/save_load)：fit、LayersModel、模型格式和 IOHandler。
- [Kingma & Ba，Adam](https://arxiv.org/abs/1412.6980)：自适应矩估计优化器。
- [Srivastava 等，Dropout](https://jmlr.org/papers/v15/srivastava14a.html)：随机失活正则化的原论文。

核验日期：2026-09-08。模型从随机初始化训练，没有下载现成识别权重；正文区分本次实际执行、解释用算例和未实现的扩展。
