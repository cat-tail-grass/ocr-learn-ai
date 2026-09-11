# 第 16/17 章实施与验证记录

日期：2026-09-08。范围仅为 16/17 章节、对应 shared 目录及两份独立测试；未修改根级配置、共享入口或 OpenSpec，未提交 Git。模型交付后未重新训练或依据测试结果调参。

## 旧课对标

实读 `05-denoising/README.md`、`index.js`、`index.html` 和第 11 章同名三文件，并落实 `docs/COURSE_STANDARD.md`。

- 05 的可继承粒度是噪声动机、滑动窗口手算、核参数、方法对比和多组 Node 实验；两章均展开动机、符号、推导、算例、实现与局限。
- 11 的可继承粒度是每类特征的维度和中间值，以及投影/HOG 等可视化；第 17 章展示真实 28×28 输入、两层已训练卷积响应、十类概率和混淆矩阵。
- 第 16 章 README 384 行、六组 Node 实验；第 17 章 README 524 行、七组 Node 实验。行数只作记录，未复制旧 HTML 的重复算法来凑长度。
- 两份 README 都有“知识点—文档—HTML—Node”四列对应表、自测及答案、方法/配置对比、OCR 位置和下一章联系。
- 算法模块保持 CommonJS；HTML 仅加载由根构建脚本生成的 bundle，并引用 shared/course.css、shared/course.js。核心循环和分支已展开为独立代码块。

## 文件

第 16 章：

- `16-tensorflowjs-intro/README.md`、`index.js`、`browser.js`、`index.html`、`.gitignore`
- `shared/16-tensorflowjs-intro/index.js`
- `shared/__tests__/tensorflowjsIntro.test.js`
- `16-tensorflowjs-intro/browser-verification.json`、`browser-comparison-verification.json`、`browser-verified.png`
- Node 运行时生成 `16-tensorflowjs-intro/artifacts/model.json`、`weights.bin`（可再生产物，已忽略）

第 17 章：

- `17-cnn-classifier/README.md`、`index.js`、`index.html`、`browser.js`、`inference-browser.js`、`.gitignore`
- `data.js`、`model-io.js`、`train.js`、`train-webgl.js`、`webgl-training.js`、`train.html`
- `verify.js`、`export-samples.js`、`validation-samples.json`
- `shared/17-cnn-classifier/index.js`
- `shared/__tests__/cnnDigitClassifier.test.js`
- `data/sources.json` 和四个原始 gzip 缓存（gzip 可重新下载，已忽略）
- `model/model.json`、`model/weights.bin`、`model/split.json`、`model/config.json`
- `model/training-curve.json`、`model/training-report.json`、`model/test-predictions.json`、`model/inference-verification.json`
- `browser-verification.json`、`browser-blank-verification.json`、`browser-augmented-verification.json`、`browser-verified.png`
- `benchmarks/cpu-interrupted.log` 保留 CPU 试跑记录；`model-webgl/` 为正式交付前的候选输出副本，已忽略。

## 实际训练

- 数据：CVDF 获授权的 MNIST 原始 IDX 镜像；下载后验证四份已知 MD5 并记录 SHA256，没有下载现成模型。
- 55,000 训练 / 5,000 验证，seed=1701，epochs=5，batchSize=128，Adam(0.001)。验证与训练索引分别为 split.json 的 `validation`、`training`；零基原始训练 IDX 索引，默认 `unused=[]`。
- 本机 Apple M1 Pro / Node v24.11.1；Node 实测 CPU。CPU 试跑较慢，在首轮未完成时停止；正式训练为 TensorFlow.js 4.22.0、浏览器 WebGL。
- WebGL 训练 141.1806 秒；包括保存和 CPU 重新加载评估共 151.357 秒。
- 所有 5 轮完成后选取验证损失最低的第 5 轮，再解码原 t10k 进行唯一配置的完整测试。
- 模型 ID：`ocr-mnist-cnn-v1-9c7b0b8e8224`。
- 权重 SHA256：`9c7b0b8e8224d188ddc38bcaf680dd032753441d6b3413870e7722a457fed90c`。
- 参数 14,538，float32 权重 58,152 字节。
- 验证：4890/5000 = 97.80%；测试：9769/10000 = **97.69%**，交叉熵 0.0704756。
- 从全部逐样本预测重新计数，结果与训练报告完全一致。
- 未提供实拍照片，照片准确率保持 null。MNIST 拼接行也是合成输入，不能替代实拍评估。

## 关键接口

`prepareDigit(imageData, options={})` 返回 `{pixels:Float32Array(784), imageData, blank, bounds, preprocessingId}`。输入浅底深色 RGBA；透明像素按白底合成；固定阈值 0.08 求 bbox，峰值归一化，最长边 20 的保持比例双线性缩放，28×28 留白、重心整数平移。训练先把 MNIST 字节转为同样的浅底 RGBA，再调用同一函数。部署交付模型必须使用默认选项。

`createDigitModel(tf,{seed=1701})` 返回未训练 LayersModel。输入 `[B,28,28,1]`，输出 `[B,10]`，标签为字符串 0–9。最终加载路径为 `/17-cnn-classifier/model/model.json`。

`predictDigit` 内部 tidy，返回普通数组/字符串，空白不强制分类。`inspectDigitFeatures` 返回两层普通数组激活和 shape，不创建需要调用方释放的 Tensor，也不释放原模型。

`model-io.js` 保存标准 LayersModel JSON/权重，Node 新会话加载时校验权重 SHA256。推理产物不含优化器状态，不宣称可以精确接续原训练状态。

## 验证命令及结果

```bash
node --check shared/16-tensorflowjs-intro/index.js
node --check shared/17-cnn-classifier/index.js
node 16-tensorflowjs-intro/index.js
node 17-cnn-classifier/index.js
node 17-cnn-classifier/verify.js
npx jest shared/__tests__/tensorflowjsIntro.test.js shared/__tests__/cnnDigitClassifier.test.js --runInBand
npm run build
```

- 两份共享模块及全部本分工 JS 语法检查通过。曾在 inspectDigitFeatures 扩展中缺少闭合括号，已经修复；随后新增特征检查/资源测试。后续编辑全部先写临时文件、语法检查后原子替换。
- 两章 15 项独立 Jest 测试通过，包括手算自动微分、训练收敛、保存重载、透明/空白、比例/平移、训练推理预处理一致、IDX 异常、划分互斥、混淆矩阵和真实特征检查。
- `inspectDigitFeatures` 重复执行 12 次后 Tensor 数稳定，原模型仍可预测；层 shape 为 `[1,12,12,8]`、`[1,5,5,16]`，数组长度 1152/400，全部值有限。
- Node 16：120 轮、η=0.1，预测 y(2)=4.99998664855957；100 次推理张量 2→2，最终 0。
- Node 17：快速入口使用随课程提供的十个验证样本，无需重新下载原始 MNIST；所有实验完成、资源自检通过。
- 新 Node 进程 200 次原始测试推理：Tensor 8→8，释放后 0。前 200 张的 197 正确只作加载一致性抽查；正式测试成绩仍为完整 10k 的 97.69%。
- 根 `npm run build` 当前成功构建 14–26 共 13 个入口。

## 独立浏览器实测

使用用户允许的 `npx --yes agent-browser --session ocr-16-17-check`，没有操作主代理的 `ocr-review`。服务为现有 4173。

第 16 章：

- WebGL、TF.js 4.22.0，120 轮 η=0.1；w=1.9999934435、b=0.9999998808。
- 内存保存重载后 `[-2,0,2] → [-2.9999871254,0.9999998808,4.9999866486]`。
- 100 次推理：5→5，模型和优化器释放后 0。
- 改成 20 轮 η=0.01：w=0.3641861081、b=0.3323919773，y(2)=1.0607641935。参数控件实际改变训练，资源仍回到 0。
- 已实看完整截图：损失曲线、训练前后直线、矩阵/梯度表、输出状态均渲染完整。

第 17 章：

- 先测空白：blank=true、prediction=null；没有分数或特征图伪结果。
- 内置验证样本原训练索引 56424，真值 0；预测 0，softmax 分数 0.9999924898。
- 两层真实激活形状 12×12×8 / 5×5×16，各绘制前四通道；数值范围、归一化输入、十类概率、真实曲线和混淆矩阵均正常显示。
- +8° 实验：bbox 由 16×20 变为 18×20，墨迹质量由约 127.47 变为 128.43，分数变为 0.9999949932；体现参数作用，不作为泛化成绩。
- 特征提取之后的 25 次推理 Tensor 8→8，重复执行仍稳定。
- 两页 `agent-browser errors` 均没有页面脚本错误。

## 资料与已知限制

原始/官方参考均在 README 附链接：[CVDF MNIST](https://github.com/cvdfoundation/mnist)、[Keras MNIST/许可](https://keras.io/api/datasets/mnist/)、[LeCun 等原论文作者页](https://leon.bottou.org/papers/lecun-98h)、[TF.js 官方训练](https://www.tensorflow.org/js/guide/train_models)、[保存加载](https://www.tensorflow.org/js/guide/save_load)、[张量与内存](https://www.tensorflow.org/js/guide/tensors_operations)、[Adam](https://arxiv.org/abs/1412.6980)、[Dropout](https://jmlr.org/papers/v15/srivastava14a.html)。

没有遗留的模块语法或加载阻塞。仍需由 25/26 章在真实照片上验证定位、分割和域差异；本章不宣称具备整串识别、分布外可靠拒识或生产训练平台能力。后端种子有记录，但跨后端浮点结果不保证逐位重现相同模型 ID。
