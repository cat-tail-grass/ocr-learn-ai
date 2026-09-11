# 第 14 / 15 章局部实施交付记录

日期：2026-09-08。写入范围仅两个章节目录、对应shared模块、两个新测试文件。没有修改根配置、共享入口、OpenSpec或其他课程，没有提交git。本文供主代理集成审查，不表示用户已经掌握课程。

## 文件

- `14-neural-network-basics/README.md`：完整神经网络课程、公式/手算/参数对照/自测/入口对应表。
- `14-neural-network-basics/index.js`：7组带标题的独立Node实验与断言。
- `14-neural-network-basics/index.html`、`browser.js`：真实训练曲线、初始/当前输出、决策热图、全参数梯度检查、输入与激活探针、停止/重置/失败提示。
- `14-neural-network-basics/experiment-output.txt`：Node实验实际输出。
- `shared/14-neural-network-basics/index.js`：带种子MLP、稳定BCE、手写反向、更新、训练、全参数数值检查。
- `shared/__tests__/neuralNetworkBasics.test.js`：21项独立测试。
- `15-cnn-basics/README.md`：卷积/通道/形状/共享参数/池化/训练梯度/CNN前向/LeNet区别及自测。
- `15-cnn-basics/index.js`：8组带标题的Node实验与断言。
- `15-cnn-basics/index.html`、`browser.js`：输入/核/Conv/ReLU/Pool数值热图、通道/stride/padding/池化调节、梯度视图、6×6矩阵编辑、空白/恢复和固定CNN前向。
- `15-cnn-basics/experiment-output.txt`：Node实验实际输出。
- `shared/15-cnn-basics/index.js`：CHW/OIHW张量、普通卷积前后向、池化前后向、Flatten/Dense/Softmax和固定教学CNN。
- `shared/__tests__/cnnBasics.test.js`：24项独立测试。

两个章节的 `bundle.js` 由主代理统一构建；本代理未手写或生成最终bundle，浏览器QA使用esbuild的write:false在内存中编译当前源码。

## 对旧课颗粒度的实质对标

已读实施约定、自己的大纲、设计与课程规格，以及主代理落盘的 `docs/COURSE_STANDARD.md`。额外实读了第05/11章README、Node分节实验及HTML输入/可视化交互。

| 对标维度 | 旧05/11课做法 | 本次落实 |
|---|---|---|
| 概念解释 | 噪声/滤波、各类特征分别展开，提供公式、算例、实现 | 14逐点覆盖感知机、激活、前向、损失、反向、下降；15逐点覆盖互相关、多通道、stride/padding、共享、池化、前向与梯度 |
| 数值可核对 | 3×3窗口加权、Hu/HOG/投影数值及维度 | 14提供完整9参数单样本前后更新表；15提供37/23翻核对照、跨通道0.5、共享梯度和38参数CNN每层值 |
| Node实验 | 05核/噪声/多滤波与PSNR；11九类提取/组合/匹配步骤 | 14有7组、15有8组实验，打印输入、中间值、方法/配置对照、局限、失败与自检 |
| HTML实验 | 05原图/噪声/滤波参数对照；11手绘/预设与特征中间图 | 14有真实训练、前后输出、输入和激活探针；15有可编辑矩阵、多参数联动、分阶段特征图、空白和失败恢复 |
| 三入口一致 | 知识讲解对应可运行演示 | 两章README均有知识点—文档—HTML—Node对应表；浏览器与Node共用唯一算法模块 |
| 可阅读实现 | 逐层计算可跟踪 | 两个共享模块的核心循环与分支已展开成多行和显式代码块，便于断点查看 |

不机械匹配旧课行数，也不复制旧HTML中的算法副本；当前14讲义517行、15讲义636行，实际覆盖点和实验是验收依据。

## 命令与实测

```bash
node 14-neural-network-basics/index.js
node 15-cnn-basics/index.js
npm test -- --runInBand shared/__tests__/neuralNetworkBasics.test.js shared/__tests__/cnnBasics.test.js
```

Node v24.11.1。两入口全部实验与断言通过，45/45 Jest测试通过。关键值：

- MLP默认17个参数，ε=1e−5中心差分最大绝对误差 `1.3921364061530994e−11`。
- XOR种子42、2→4→1/tanh、η=0.5、5000次全量更新：平均BCE `0.9018187121766812→0.00047851806938166034`，四点拟合率100%。不是独立测试准确率。
- 同初始点η=10更新一次，BCE升至 `0.9393473898616962`，作为过大步长反例。
- 多通道卷积梯度检查共50个量（24输入、24权重、2偏置），最大绝对误差 `3.7145231335244944e−11`；包含stride=[2,1]、padding=[1,0]。
- 局部卷积平方损失一步下降 `0.025→0.0202385`。
- 固定CNN共38参数，竖线/横线位置2的相应类别得分约0.6224593312；空白与边缘丢失响应时为[0.5,0.5]。

## 独立浏览器QA

使用当前源码内存构建，以单独本地4314端口提供页面；没有更改根启动/构建文件。

- 14：全参数梯度检查通过；实际5000次训练得到损失0.000479、拟合率100%；输入探针改变后逐层z/a与概率改变；学习率0被拒绝，恢复0.5后单步损失0.809989；激活探针z=0正确显示Sigmoid 0.5/0.25、tanh 0/1、ReLU 0/0。
- 15：默认各层数值与README一致；切换双通道/S2/P1/平均池化后显示2×6×6→2×3×3→2×1×1，卷积参数38、理论MACs324，偏置梯度[9,9]；梯度视图显示全部核梯度。
- 15：清为空白后固定CNN得分50%/50%并提示不能区分；错误2元素矩阵被拒绝并标明保留上次结果；恢复预设再选横线后logits=[0,0.5]、横线得分62.25%。
- 两页捕获的浏览器error日志均为空，实际截图检查无明显布局遮挡。

## 关键接口

14：`createMLP`、`forward`、`backward`、`applyGradients`、`train`、`evaluate`、`gradientCheck`、`cloneModel`、`traceExample`。参数权重为行优先 `[output,input]`；样本 `{input,target}`，标签0/1；最后单logit；反向返回平均BCE的梯度。只有applyGradients/train原地修改模型。

15：`tensor`、`outputShape`、`conv2d`、`conv2dBackward`、`relu`、`pool2d`、`pool2dBackward`、`flatten`、`dense`、`softmax`、`parameterCount`、`createTinyCNN`、`tinyCNNForward`。张量CHW、核OIHW，Float64Array；默认不翻核、对称零填充、floor；卷积反向返回dInput/dKernel/dBias，不自动平均。

## 来源和遗留事项

已核验并在README引用 [Rumelhart等反向传播论文](https://www.nature.com/articles/323533a0)、[Xavier初始化论文](https://proceedings.mlr.press/v9/glorot10a.html)、[He初始化论文](https://arxiv.org/abs/1502.01852)、[LeNet作者论文页面](https://bottou.org/papers/lecun-98h)、[Conv2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Conv2d.html)、[BCEWithLogitsLoss](https://docs.pytorch.org/docs/2.14/generated/torch.nn.BCEWithLogitsLoss.html)和[MaxPool2d](https://docs.pytorch.org/docs/2.14/generated/torch.nn.MaxPool2d.html)官方文档。

局部实现没有未解决的运行问题。需主代理在最后源码修改之后统一 `npm run build`，继续全仓集成、课程入口/进度/OpenSpec审查。MLP仅二分类教学；CNN是固定手工前向加局部梯度验证，不提供完整CNN训练，不替代17章的真实手写模型。上述限制已明确写入页面和讲义。
