# 20. CRNN：把 CNN、双向 LSTM 与 CTC 训练成一条链

## 学习目标、前置知识与实验范围

第 15 章讲 CNN 如何提取空间特征，第 18 章讲状态如何沿序列传播，第 19 章讲只有整串标签时怎样计算损失。本章把三者连接成**从整行像素到字符串、所有参数都能训练**的小型 CRNN。

学完应能：

1. 从图像宽高、卷积和池化参数推导时间序列尺寸。
2. 正确把 NHWC 特征图按列转换成 `[B,T,F]`，避免直接 reshape 打乱列序。
3. 解释双向 LSTM 的两条状态链和输出投影。
4. 沿 CTC loss → logits → LSTM → CNN 检查真实梯度。
5. 运行训练、权重导出重载、仅像素推理和新扰动合成样本评估。
6. 区分 CRNN 教学实验、原论文架构与最终照片 demo 的“分割 + CNN”路线。

前置知识：第 14 章反向传播、第 15 章卷积通道和尺寸、第 16 章 TensorFlow.js 生命周期、第 18 章 LSTM 门、第 19 章 CTC 和 prefix beam。**不依赖第 17 章的任何模型或数据产物。**

本章完整训练了 CNN + BiLSTM + CTC，但规模有意限制为：8×20 灰度图、0/1 两种点阵字形、1–3个数字、1,691个参数、28个合成训练样本。它不是 MNIST 或真实手机照片模型，也没有复现论文中的大型 CNN、多个序列层和场景文字基准。保持训练机制完整，缩小数据与容量，便于 CPU 逐步调试。

## 1. CRNN 要解决什么问题

### 1.1 显式切字的脆弱点

第 10 章先找字符区域，第 17 章再分类。这种路线每一步容易观察，但一次粘连、断笔或错误分割可能改变字符个数。CRNN 保留整行图像，让图像编码器学习特征，序列网络整合上下文，CTC 在训练时求对齐、在推理时折叠输出。

```text
原图（已是单行区域）
       ↓ [B,H,W,1]
CNN：每个位置提取局部笔画特征
       ↓ [B,H',W',C]
Map-to-Sequence：一列的H'×C数值组成一帧
       ↓ [B,T=W',F=H'C]
BiLSTM：左→右 / 右→左，恢复原位置后拼接
       ↓ [B,T,2h]
线性输出层：每帧K=字符类数+blank个logits
       ↓ [B,T,K]
       ├── CTC损失 ← 整串训练标签
       └── softmax → greedy/prefix beam → 字符串
```

特征提取、序列建模、转录的整体思路来自 [Shi、Bai、Yao 的 CRNN 原论文](https://arxiv.org/abs/1507.05717)。本章保留这三部分，改变具体层数、激活、池化和实验数据以形成小型可运行模型。

### 1.2 “端到端”到底指什么

目标不是每个字符的坐标或单字符类别，而是整行标签。例如生成的图里有 `001`，训练只接收 `[数字0,数字0,数字1]`，不接收字符边界或逐帧类别。

损失反向传到卷积核，图像特征也被训练，这才是本章所说的端到端。若冻结CNN、只训练输出矩阵，或把单字符分类结果拼成字符串，都不能等同于这里的训练。

CTC只是损失/转录机制，不增加一组可训练的“CTC权重”。本模型的参数在 CNN、两个 LSTM 和线性输出层中。

## 2. CNN：空间尺寸与感受野

### 2.1 输入的明确契约

每张图为 `{pixels: Float32Array(160), height:8, width:20}`，行优先、单通道，背景接近0、笔画接近1，所有值必须在[0,1]。浏览器显示时将笔画强度反转成深色，不改变模型输入约定。

输入不是二进制标签掩码：合成器给背景加0–0.08的小噪声，笔画有0.8–1的强度和小幅扰动，并随机改变字形纵向位置与字符间距。标签用于生成训练图像，这是正常监督数据构造；**识别接口本身只接收生成后的像素**。

### 2.2 本章CNN的可计算定义

采用一个3×3、输入通道1、输出通道4的卷积（框架语义为互相关）、步幅1、same填充：

\[
A_{b,y,x,c}=\tanh\left(b_c+\sum_{u=0}^{2}\sum_{v=0}^{2}
X_{b,y+u-1,x+v-1,0}K_{u,v,0,c}\right)
\]

越界位置补0。核不做数学卷积意义的翻转；与第15章和 `tf.conv2d` 约定一致。这里使用 tanh 便于观察正负特征，**不是原论文CNN的逐层复刻**。

接着2×2平均池化，步幅2、valid填充：

\[
P_{b,i,j,c}=\frac14\sum_{u=0}^{1}\sum_{v=0}^{1}A_{b,2i+u,2j+v,c}
\]

平均池化没有可训练参数。选它是为小实验简化可微空间压缩；生产网络也可能使用最大池化或带步幅卷积，不能把本章选择当成统一最佳方案。

### 2.3 可手算的局部卷积与池化

取一个教学核所有值为1/9，偏置0，局部像素为：

```text
0 1 0
1 1 0
0 0 0
```

互相关加权和为3/9=1/3，激活为 `tanh(1/3)=0.32151274`。实际训练核不要求权重和为1，也不局限于平滑，它能学出正负相间的笔画响应。

若一个通道的2×2激活块为 `[0.2,0.4;0.6,0.8]`，平均池化后为0.5。对该输出的上游梯度若为2，四个输入激活各收到0.5，然后再经过 tanh 导数和卷积求导。这个例子帮助定位“下采样虽缩小尺寸，但仍能反传”。

### 2.4 宽高计算、奇数宽度与时间预算

常见卷积/池化输出尺寸公式（有效核大小含膨胀率d）：

\[
N_{out}=\left\lfloor\frac{N_{in}+P_{left}+P_{right}-d(k-1)-1}{s}\right\rfloor+1
\]

本章卷积 k=3、s=1、d=1、两边padding=1，所以宽高不变。池化 k=2、s=2、无padding，得到：

\[
H'=\lfloor H/2\rfloor,\quad W'=\lfloor W/2\rfloor,\quad T=W'
\]

| 层 | 默认批次B=1时的形状 | 推导 |
|---|---|---|
| 输入 | `[1,8,20,1]` | 8行、20列、单通道 |
| 3×3卷积+tanh | `[1,8,20,4]` | same，4个核 |
| 2×2平均池化 | `[1,4,10,4]` | 高宽各减半 |
| 按列序列 | `[1,10,16]` | 10帧，每帧4行×4通道 |
| BiLSTM | `[1,10,16]` | 每方向h=8，拼接16 |
| 线性输出 | `[1,10,3]` | blank、数字0、数字1 |

Node 对照 W=10、20、21、32，得到 T=5、10、10、16。奇数宽21的最后一列不会成为单独的池化窗口；但它可能已通过卷积影响相邻位置，不能简单说原图最后一列毫无作用。

目标“000”最少需要 `U+r=3+2=5` 帧。若横向再多下采样一次，宽20可能只剩5帧，刚刚够三个重复字符；再压缩就无法对齐。**横向下采样率是识别长度预算，不只是运行速度参数。**

每个池化空间位置的**理论感受野**为4×4、相邻池化位置中心相隔2像素：第一层卷积为3×3，再覆盖两个相邻卷积位置，范围变4。这里说的是结构上可能依赖的区域；实际梯度强弱决定的“有效感受野”不是仅凭核大小就能确定的。[理论与有效感受野的原论文区分](https://papers.nips.cc/paper/2016/file/c8067ad1937f728f51288b3eb986afaa-Paper.pdf)。Map-to-Sequence 再拼接所有高度位置，一整帧的联合感受野覆盖图像高度与对应4列（边界含padding）。LSTM之后的上下文可跨越更宽图像，但不能凭空恢复早期压缩掉的全部细节。

## 3. Map-to-Sequence：不是任意 reshape

### 3.1 每一帧应该对应什么

卷积输出张量在 TF.js 是 `[B,H',W',C]`。OCR从左向右读，因此希望固定列x，把该列所有高度与通道作为一个特征向量：

\[
S_{b,t,yC+c}=P_{b,y,t,c},\quad t\in[0,W'-1]
\]

所以 `T=W'`、`F=H'×C`。h=4、C=4时，某一帧的16个特征排列为：第0行四通道、第1行四通道、第2行四通道、第3行四通道。

### 3.2 两行两列的手算反例

先忽略批次和通道，假设池化结果为：

```text
第0行：[1,2]
第1行：[3,4]
```

正确时间序列应该是 `t0=[1,3]`、`t1=[2,4]`，因为每帧取一列。内存行优先展开是 `[1,2,3,4]`，直接reshape会得到错误的 `[[1,2],[3,4]]`。元素个数相同不代表坐标语义相同。

```javascript
// [B,H',W',C] → [B,W',H',C] → [B,T,H'C]
const sequence = pooled
    .transpose([0, 2, 1, 3])
    .reshape([B, T, Hprime * C]);
```

实现步骤：先读取池化实际shape → 交换高宽轴 → 展平每列的高度与通道 → 校验某一帧等于原特征图相同列的连接。Node 实验5直接比较第一帧与池化列，出错会触发断言。

浏览器的通道热图来自真实卷积输出；滑动时间步可以看到该列16维特征，以及两个方向的LSTM状态。它不是把输入图缩小后冒充网络特征图。

## 4. BiLSTM 与逐帧输出

### 4.1 为什么列特征之后还要序列层

每列CNN特征只看局部笔画。相邻列的形状能帮助识别一段笔画属于哪个数字，也能让输出形成稳定字符区段。BiLSTM 的正向状态融合左侧，反向状态融合右侧；离线整行照片允许两侧上下文同时可用。

每方向隐藏宽度为h=8、输入宽度F=16。把当前输入x和历史状态拼接成24维，一次矩阵乘法算出i/f/o三个门与候选g的四组仿射结果：

\[
[a_i,a_f,a_g,a_o]=[x_t,h_{t-1}]W+b,\quad W\in\mathbb R^{24\times32}
\]

\[
c_t=\sigma(a_f)\odot c_{t-1}+\sigma(a_i)\odot\tanh(a_g),\quad
h_t=\sigma(a_o)\odot\tanh(c_t)
\]

这是第18章同一组公式的批张量版本。门顺序固定 i/f/g/o；遗忘门偏置初始化为1，其余门偏置为0。初始状态与cell全零。

若某维的四组preactivation按i/f/g/o排列为 `[0,1,1,0]`、旧cell=0，则 `i=o=0.5`、`f=0.731059`、`g=0.761594`、新cell=`0.380797`、h=`0.181700`；与第18章首步手算一致。实际32维仿射结果由可训练矩阵生成，不再手设；g是候选记忆，不是第四个门。

### 4.2 两方向的可读实现

```javascript
for (let n = 0; n < T; n++) {
    const t = direction === 'forward' ? n : T - 1 - n;
    const gates = tf.concat([frames[t], h], 1)
        .matMul(kernel).add(bias);
    const [ai, af, ag, ao] = tf.split(gates, 4, 1);
    cell = tf.sigmoid(af).mul(cell)
        .add(tf.sigmoid(ai).mul(tf.tanh(ag)));
    h = tf.sigmoid(ao).mul(tf.tanh(cell));
    states[t] = h; // 反向扫描时也放回原来的图像列位置
}
```

随后沿最后一维拼接两个方向，得到 `[B,T,16]`。核心操作采用手写可微张量扫描，是为了在循环内逐步检查门和状态；不需要假定高层封装能正确处理我们自定义的损失、维度和资源边界。

### 4.3 从上下文到类别

\[
z_t=[\overrightarrow h_t;\overleftarrow h_t]W_o+b_o,\quad
W_o\in\mathbb R^{16\times3},\ b_o\in\mathbb R^3
\]

为高效矩阵乘法，代码将 `[B,T,16]` 临时变成 `[BT,16]`，投影后还原 `[B,T,3]`。这次reshape是合法的，因为合并的是批次和时间，不改变最后一维特征内部顺序。

训练损失直接接收 logits，内部做稳定log-softmax；推理才在输出上做softmax并解码，避免对概率再softmax。

### 4.4 参数量与配置取舍

| 部分 | 参数公式 | 默认参数数 |
|---|---|---:|
| CNN | 3×3×1×4 + 4偏置 | 40 |
| 正向LSTM | `(16+8)×(4×8)+4×8` | 800 |
| 反向LSTM | 同上 | 800 |
| 输出层 | 16×3+3 | 51 |
| 合计 | 40+800+800+51 | **1,691** |

循环层计算随 T、批次B增长，每方向主要成本近似 `O(BT(F+h)4h)`；两个方向翻倍。增加h提高容量也以平方项增加循环开销；增加C同时扩大CNN输出和LSTM输入F；增加图像宽度增加T及CTC表。不是只改一个最终全连接层大小那么简单。

## 5. CTC 与真实端到端梯度

### 5.1 标签及损失

映射固定 `blank=0、字符0=1、字符1=2`。字符串“001”对应标签 `[1,1,2]`。不把字符串转成整数，所以前导零不会丢失。

对每条样本：

\[
\mathcal L_b=-\log\sum_{\pi:B(\pi)=y_b}\prod_t p_{b,t}(\pi_t),\quad
\mathcal L_{batch}=\frac1B\sum_b\mathcal L_b
\]

第19章已经实现log域α/β与 `∂L/∂z = p−γ`。本章调用同一个 `differentiableCtcLoss`，所有样本T=10，标签长度可以1、2或3，目标无需补齐成10帧。

重复串“000”的最短路径为 `[1,0,1,0,1]`，可以在10帧中通过blank和重复持续发射形成很多合法对齐。没有人为指定“第几帧必须是某个0”。

### 5.2 当前框架能做什么：实测而不是猜接口

在 `@tensorflow/tfjs 4.22.0` CPU 后端实际执行了卷积、平均池化、transpose/reshape、split/unstack/stack、门函数、矩阵乘法与变量梯度。`tf.ctcLoss` 不存在，因此使用 `tf.customGrad` 将经过有限差分核验的解析CTC梯度接回计算图。自定义梯度机制见[官方指南](https://www.tensorflow.org/js/guide/custom_ops_kernels_gradients)。

```text
CTC损失
  ↓ p−γ（本项目前后向算法；按批次平均）
每帧logits
  ↓ 输出矩阵、偏置的梯度
两个方向的LSTM状态
  ↓ 在各自时间展开图上做BPTT
列序列
  ↓ transpose/reshape的逆坐标映射
平均池化与tanh卷积
  ↓ 卷积核和偏置梯度
Adam更新全部1,691个参数
```

只观察loss下降还不够：若不小心把CNN结果 `.arraySync()` 后重新建张量而没有梯度桥，后段仍可能学习，CNN却被截断。本章在**CTC边界**读取数值并显式回接梯度；其余网络全部用框架可微操作。

### 5.3 两级梯度核验

1. 对3帧、3类、目标连续重复的9个logit坐标，用中心差分核对解析CTC梯度。报告最大绝对误差约`3.10×10⁻⁸`，ε=1e−4。
2. 对完整图像模型求8组变量梯度，逐组要求有限且非零；再选择初始卷积核中梯度绝对值最大的坐标，扰动±0.005，比较整串损失差分与框架梯度，测试容差5e−4。

第二级会同时经过CNN→BiLSTM→CTC，因此能发现“只有CTC公式正确、图像链路没梯度”的问题。纯JS CTC读取数值后保存一阶梯度，不支持可信的二阶自动微分；同步读数也限制GPU吞吐，这些边界继承第19章。

## 6. 数据、训练与如实评估

### 6.1 自包含合成数据

字形生成器将0与1定义为3×5点阵，嵌入8×20灰度画布。有14种标签串：两种1位串、四种2位串、八种3位串。

```text
0 1
00 01 10 11
000 001 010 011 100 101 110 111
```

训练每种2张，共28张，种子71；验证每种1张，共14张，种子19001。每张样本再有独立派生种子，以固定随机生成器复现噪声、位移、笔画强度和间距。

**验证图是新扰动，字形来源与全部标签组合仍与训练相同。** 它只能检查同一生成分布下的新图像，不能证明新书写者泛化、新字符串长度泛化或真实照片能力。本章不另设“最终独立测试集”，也不把验证成绩改名为公开基准成绩。

### 6.2 优化步骤可逐行追踪

默认训练配置：模型种子20260908，Adam学习率0.02，160次全批更新，不打乱固定全批顺序，不使用权重预训练、字符框或教师强制对齐。

```javascript
const objective = () => differentiableCtcLoss(tf, model.forward(xs), targets);
const { value, grads } = tf.variableGrads(objective, variableList);
// 先检查value和梯度是有限数值，再执行全局范数裁剪。
const norm = tf.addN(Object.values(grads).map(g => g.square().sum())).sqrt();
const factor = tf.minimum(tf.scalar(1), tf.scalar(5).div(norm.add(1e-8)));
const clipped = Object.fromEntries(
    Object.entries(grads).map(([name, gradient]) => [name, gradient.mul(factor)])
);
optimizer.applyGradients(clipped);
```

`tf.tidy` 包住同步一步，使中间张量在更新后释放；optimizer的动量与模型变量要显式dispose，不能依赖tidy。每5步 `await tf.nextFrame()` 让浏览器有机会绘制进度，异步等待放在tidy之外。[TensorFlow.js API](https://js.tensorflow.org/api/latest/#tidy) 明确规定tidy回调不能返回Promise。

学习率过小会让相同步数下loss下降不足；过大可能造成震荡、blank塌缩或非有限值。页面可分别改变更新次数与学习率，保留损失曲线和最终逐串表现；比较时应使用相同模型/数据种子，不能换数据后把差异全部归因于学习率。

### 6.3 已完成的真实训练结果

项目CPU实测，默认160步：

| 项目 | 实测 |
|---|---:|
| 初始训练集平均CTC损失 | 4.8090896606 |
| 最终训练集平均CTC损失 | 0.0045281863 |
| 训练集整串正确 | 28/28 |
| 合成验证集整串正确 | 14/14 |
| 卷积核最大绝对变化 | 1.6289658844 |
| CTC梯度差分最大绝对误差 | 3.10×10⁻⁸ |
| 已保存历史Node训练耗时 | 9.006秒（本机CPU，一次运行） |
| 合成验证训练前→训练后 | 0/14 → 14/14 |

首步各组梯度范数：

| 变量 | 范数 |
|---|---:|
| convKernel / convBias | 0.550627 / 1.363830 |
| forwardKernel / forwardBias | 0.375228 / 1.245122 |
| backwardKernel / backwardBias | 0.234922 / 0.987541 |
| outputKernel / outputBias | 0.256205 / 1.816484 |

这说明**训练的是完整小型CRNN，不是只有CTC logits，也不是单字符分类拼接**。原始逐图结果、参数、步数、梯度检查、耗时和数据边界记录在 `training-report.json`。重新运行时间会受机器负载影响；Node CPU同种子通常可复現相同或极接近的数值，其他后端不承诺逐bit一致。

### 6.4 推理与真值隔离

`predictRows(tf,model,images)` 不接收字符串标签或长度；返回的字符完全来自图像模型softmax和prefix beam。`evaluateRows` 先提取纯像素对象进行预测，得到结果后才与truth比较。

测试给输入图像添加一旦读取 `truth`/`labels` 就抛错的属性，预测仍必须成功。浏览器输入“001”只生成图像，点击识别时不读取这个文本框；手工修改像素可改变结果，即使文本框仍显示原内容。

每次评估保留前导零、重复数字和空预测。当前报告主要使用整串完全正确率，不把beam累计概率作为正确率。任意编辑图、全白图可能产生空串或错误串，本章没有训练或承诺完整拒识机制。

## 7. 保存、加载与浏览器过程可视化

### 7.1 权重产物不是下载的预训练模型

`model/weights.json` 是本章脚本训练后导出的8组数值张量，包含format、config、alphabet、每个权重shape和values。无外部成品模型、无第17章依赖。`importWeights` 在赋值前校验配置、固定字符表 `['','0','1']`，以及全部张量的形状、数量、空槽和转成float32后的有限性，避免只加载了一半模型。JSON数值 `1e100` 在JavaScript中有限，却会变成float32的Infinity，因此只做 `Number.isFinite` 不够；调换字符表也必须拒绝，不能让相同输出索引代表不同字符。

这是自定义小模型格式，**不是** `tf.LayersModel` 的 `model.json`；不能直接交给 `tf.loadLayersModel`。创建同配置模型后调用 `importWeights`。独立测试核对导出→JSON序列化→重载后的全部预测概率一致。

### 7.2 页面可操作的完整过程

1. 默认加载本项目训练权重与合成“001”图像。
2. 改字符串/绘图种子，或鼠标绘制、Shift擦除；键盘也能编辑8×20的0/1像素矩阵。
3. 点击仅像素识别，显示greedy、prefix beam与10帧概率。
4. 查看4个池化通道热图；选择时间步，读取16维CNN列特征、正向8维状态、反向8维状态。
5. 改学习率或训练步数，从固定随机初始化重新训练；观察实时loss曲线、日志与训练前后合成验证正确数。
6. 生成、清空或手绘改图会清除上一次的预测、特征和逐帧概率；重新识别后才显示当前图像的结果。空白图属于训练范围外输入；非法字符串、像素格式、权重加载失败、训练错误均显示明确状态。

训练不会把模型自动写回磁盘。只有Node命令显式带 `--write` 才保存模型和报告。浏览器重训完成后替换当前内存模型；关闭页面释放模型资源。

## 8. 方法对照、适用条件与排障

### 8.1 三条路线的比较

| 路线 | 训练监督 | 主要优点 | 主要限制 | 本项目位置 |
|---|---|---|---|---|
| 切字 + CNN | 单字符标签；另有切字规则 | 易解释每个区域与错误来源 | 切字错误会传递 | 第25章现场主路线 |
| CNN + BiLSTM + CTC | 整行字符串 | 不要求逐字切分；单调对齐 | 需要序列数据、足够T、有效训练算子 | 本章完整小实验 |
| Attention/Transformer OCR | 取决于编码器解码器目标 | 可显式按内容读取上下文 | 数据/计算需求、幻觉与长度建模需评估 | 第21/23章学习 |

CRNN 输入仍假设文字行已经定位或裁剪好。它不会自动完成任意照片的透视矫正、多行版面分析和文字检测。使用双向模型也意味着需要整行或分块上下文；不是零延迟流式算法。

### 8.2 常见故障的定位顺序

| 现象 | 应检查的中间量 | 可能原因 |
|---|---|---|
| “00”变一个“0” | T、逐帧blank、折叠顺序 | 帧预算不足、模型没学会blank、decoder顺序错 |
| loss=∞ | `T≥U+r`和标签索引 | 图像压缩过度，或把blank放入目标 |
| 所有输入同一结果 | 随机基线、CNN特征热图、各层梯度 | 输入极性/范围错误，梯度被切断，训练不足 |
| 只有输出层变化 | convKernel梯度与首末权重差 | 在网络中间转JS数组导致计算图断开 |
| 特征数正确但列错位 | 第一帧与池化第0列逐项比较 | 忘记transpose而直接reshape |
| 反向状态位置异常 | 原列序与反向states索引 | 倒序扫描后未恢复到原位置 |
| 重复训练内存增长 | `tf.memory().numTensors` | 初始张量/旧模型/optimizer未dispose，异步tidy误用 |
| 手写照片失败 | 输入分布与字形来源 | 本模型只见过3×5合成0/1，不能据此承诺真实OCR |

进一步走向真实手写CRNN，需要真实或可信拼接的整行数据、按书写者/原图隔离划分、覆盖0–9、合理保比例缩放、变宽padding与有效长度、独立照片评估和更高吞吐CTC实现。本章当前固定图像宽度和共同T，没有掩码、动态宽批次、多层BiLSTM或生产训练恢复系统。

## 9. 知识点到三个主入口的对应

| 知识点 | 文档位置 | HTML 实验 | Node 实验/函数 |
|---|---|---|---|
| CRNN组成和端到端意义 | §1、§5 | 完整训练进度和权重变化 | `--train`实验4/5 / `trainTinyCrnn` |
| CNN尺寸与时间预算 | §2 | 完整尺寸说明、输入图 | 实验2 / `cnnSequenceShape` |
| 按列序列化 | §3 | 通道热图、选定帧16维数值 | 实验5列序自检 / `model.inspect` |
| BiLSTM和输出投影 | §4 | 正反向状态、每帧概率 | 实验5 / `model.forward` |
| CTC与实际梯度 | §5 | 训练loss与梯度差分误差 | 实验1与独立Jest / `gradientCheck` |
| 合成数据与真实训练 | §6 | 生成/手绘、训练前后正确数 | 实验3/4 / `createSyntheticDataset` |
| 保存重载与纯像素预测 | §7 | 自动加载权重、改图后识别 | 实验4/5 / `importWeights`、`predictRows` |
| 参数和边界 | §8 | 改步数/学习率、空白/非法状态 | 实验2/6与Jest |

首次在仓库根目录 `npm install`，由主项目安装TF.js/Jest/esbuild。快速示例加载现有权重，通常不到数秒；完整重训独立命令执行：

```bash
node 20-crnn/index.js
# 完整训练，报告打印到终端；不会保存
node 20-crnn/index.js --train --steps 160
# 完整训练并保存本章权重/报告
node 20-crnn/index.js --train --steps 160 --write
npx jest --runInBand shared/__tests__/crnn.test.js shared/__tests__/ctcLoss.test.js
npm run build
npm start
```

浏览器打开静态服务的 `/20-crnn/`。必须HTTP加载 `model/weights.json`，不要双击HTML后把file协议的fetch限制误判为模型坏了。统一esbuild将CommonJS `browser.js`和同一shared算法构建为bundle，不需要手写或复制算法。

核心接口：

```javascript
const tf = require('@tensorflow/tfjs');
const { createTinyCrnn, renderSyntheticLine, predictRows } = require('../shared/20-crnn');
const model = createTinyCrnn(tf, saved.config);
model.importWeights(saved);
const image = renderSyntheticLine('001', { seed: 42 });
const result = predictRows(tf, model, [image])[0];
// {prediction, greedy, path, probability, probabilities[T,K]}
model.dispose();
```

- `createTinyCrnn(tf,options) → {config,variables,forward,inspect,exportWeights,importWeights,parameterCount,dispose}`。
- `forward(imagesTensor[B,H,W,1]) → logitsTensor[B,T,K]`，返回张量由调用者释放。
- `inspect(imagesTensor) → 各阶段{shape,values}`，返回JS数组，内部中间张量已释放，仅用于观察，不参与训练图。
- `trainTinyCrnn(tf,{steps,learningRate,seed,onProgress}) → Promise<{model,report}>`，成功后模型由调用者负责释放。
- `predictRows(tf,model,images,beamWidth=10) → 逐图预测数组`，图像仅像素、宽、高，内部张量自动释放。
- `evaluateRows(tf,model,records) → {count,exactCorrect,exactAccuracy,rows}`，评估接口在预测返回后比较truth。

## 10. 自测与答案

**题1：** `[B,4,10,4]`池化特征图为什么变成`[B,10,16]`，而不是`[B,4,40]`？

**答：** 时间轴沿图像宽度，共10列；一列连接4行×4通道。后一种形状按高度做序列，丢失从左到右的时间含义。

**题2：** `[[1,2],[3,4]]`按列序列化是什么？直接reshape有什么错？

**答：** `[[1,3],[2,4]]`。行优先内存直接reshape得到`[[1,2],[3,4]]`，没有交换高宽语义。

**题3：** 宽度8经本CNN后有几帧，能表示“000”吗？

**答：** T=4，重复字符至少需要5帧，不能。增大模型隐藏层并不能修复这个结构性不可能。

**题4：** 每方向F=16、h=8的LSTM参数多少，为什么不是`16×8`？

**答：** `4h(F+h+1)=800`，三个门加候选共四组仿射参数，均包含输入、循环状态和偏置。双向共1600。

**题5：** loss下降是否能证明CNN在训练？

**答：** 不足以证明。还要检查CNN梯度有限且非零、参数实际变化，并可对卷积参数做完整损失的有限差分。

**题6：** 14/14合成验证全对，能在分享中说“手写识别率100%”吗？

**答：** 不能。它们是相同两种点阵字形和已见标签组合的新扰动，只能按这个数据口径报告。

**题7：** 测试时把“001”标签传给prefix beam帮助输出长度正确，可以吗？

**答：** 不可以，那是泄漏答案。推理只看图像概率，真值只能用于训练损失或预测后的评分。

**题8：** 为什么saved JSON不能用`tf.loadLayersModel`直接加载？

**答：** 它是本章自定义的8组变量格式，不是LayersModel拓扑/权重manifest。要创建同配置模型后调用`importWeights`。

**题9：** CPU训练成功，是否说明我们实现了高效GPU CTC内核？

**答：** 没有。前后向在JS对数域计算，通过customGrad返回一阶梯度；dataSync会同步读数，吞吐与高阶梯度均有局限。

## 11. 分享重点与下一章

推荐现场先显示整行“001”和10帧概率，再选一列查看16维特征及双向状态。用2×2矩阵手算说明为什么必须transpose，以宽度预算解释相邻重复为什么需要blank。最后展示真实loss下降、卷积梯度范数和合成逐串结果，把“端到端可训练”与“真实场景准确”两个结论分别给证据。

下一章 Attention 将内容相关的加权读取显式化：RNN状态压缩历史，CTC对单调路径求和，Attention则学习当前位置应该关注哪些输入表示。它们解决的问题有交集，具体架构应按数据、延迟和错误表现比较。

## 参考来源

- [Shi、Bai、Yao：An End-to-End Trainable Neural Network for Image-based Sequence Recognition，2015](https://arxiv.org/abs/1507.05717)，以及[论文全文](https://arxiv.org/html/1507.05717v1)：核对CNN、循环序列建模和转录三部分。
- [Graves等：CTC，2006](https://www.cs.toronto.edu/~graves/icml_2006.pdf)：核对整串监督和单调路径求和。
- [TensorFlow.js 官方 API：conv2d](https://js.tensorflow.org/api/latest/#conv2d)、[avgPool](https://js.tensorflow.org/api/latest/#avgPool)、[variableGrads](https://js.tensorflow.org/api/latest/#variableGrads)：核对算子与变量梯度接口。
- [TensorFlow.js 自定义梯度指南](https://www.tensorflow.org/js/guide/custom_ops_kernels_gradients)、[customGrad API](https://js.tensorflow.org/api/latest/#customGrad)：核对解析CTC一阶梯度回接方式。

这些来源用于核验原理和API，不把本项目1,691参数模型的实测数字归因于论文模型；实验结果仅来自本章保存的权重与报告。
