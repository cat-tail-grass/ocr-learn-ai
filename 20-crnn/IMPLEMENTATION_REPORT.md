# 第18–20章局部实施交付报告

日期：2026-09-08。写入仅限18–20章目录、对应shared模块及独立测试。未提交git，未编辑根文档、配置、共享入口或OpenSpec，未另建Codex任务或站点。

## 交付结论

**完整小型CRNN已真实训练完成。** 网络为3×3 CNN + 平均池化 + 按列序列化 + 双向LSTM + 线性输出 + CTC，1,691个可训练参数。不是字符分类拼接，也不是仅训练CTC logits。第19章另有明确标注的可微logits实验，以便区分机制验证与图像模型训练。

TensorFlow.js 4.22.0 CPU上没有 `tf.ctcLoss`，使用本项目log域CTC前后向与 `tf.customGrad` 提供已核验的一阶解析梯度。所有网络层真实可微，梯度传到CNN和两个方向的LSTM。

## 文件清单

| 章节 | 主要文件 | 共享模块 | 独立测试 |
|---|---|---|---|
| 18 | `18-rnn-basics/README.md`、`index.js`、`index.html`、`browser.js` | `shared/18-rnn-basics/index.js` | `shared/__tests__/rnnBasics.test.js` |
| 19 | `19-ctc-loss/README.md`、`index.js`、`index.html`、`browser.js` | `shared/19-ctc-loss/index.js` | `shared/__tests__/ctcLoss.test.js` |
| 20 | `20-crnn/README.md`、`index.js`、`index.html`、`browser.js` | `shared/20-crnn/index.js` | `shared/__tests__/crnn.test.js` |

第20章额外产物：

- `model/weights.json`：本项目随机初始化后训练的全部8组权重，自定义格式。
- `training-report.json`：训练设置、loss历史、首步梯度、卷积权重变化、训练前后及逐图评估。
- `browser-qa.png`：独立浏览器会话的实际界面记录。
- `IMPLEMENTATION_REPORT.md`：本报告。

`bundle.js` 均由esbuild真实构建，仅用于本地QA，不手写，已被主项目gitignore忽略。主代理可统一重新构建。算法不在HTML中重复实现，页面引用公共course.css和course.js。

## 旧课程颗粒度对标

实读 `05-denoising/README.md`、`index.js`、`index.html`，以及 `11-feature-extraction/README.md`、`index.js`、`index.html`，并按 `docs/COURSE_STANDARD.md` 修改：

| 旧课实质特征 | 18章落实 | 19章落实 | 20章落实 |
|---|---|---|---|
| 05卷积核/局部像素手算；11逐类特征公式与实现 | 四步RNN，四门/c/h，真实灵敏度乘积 | 0.76路径和、0.448重复串完整α表、后验和梯度推导 | 局部卷积/池化、2×2列序反例、完整尺寸与参数数 |
| 05核大小/sigma与滤波方法对照；11特征维度/距离对照 | 循环权重、饱和反例、遗忘门偏置、正反向对照 | greedy/prefix beam、束宽、枚举/DP、帧数不足 | 图像宽度/时间预算、随机/训练后、学习率/步数、最终分割路线比较 |
| Node编号实验打印输入与中间结果 | 6个标题实验，状态/门表，差分和非法输入断言 | 7个标题实验，路径/α/后验/梯度表，真实logits更新 | 6个标题实验，ASCII输入、随机基线、CNN特征列、概率、保存重载及训练 |
| HTML输入与过程可视化 | 可调序列/Wₕ/b_f、状态曲线与门表、末帧扰动比较 | 可编辑矩阵/目标、例子选择、束宽、α/后验/梯度、双解码及错误状态 | 合成/手绘/键盘像素、4通道特征热图、帧选择、双向状态、概率、真训练曲线 |
| 自测答案、OCR位置、下一章关系 | 全部具备 | 全部具备 | 全部具备 |

三章均增加“知识点—文档位置—HTML实验—Node实验/函数”对应表。正文约330 / 477 / 475行，行数仅辅助描述，不以堆叠样式或复制算法对标旧课。共享核心循环已展开，便于逐步断点。

## 可运行命令与本次结果

从仓库根目录：

```bash
node 18-rnn-basics/index.js
node 19-ctc-loss/index.js
node 20-crnn/index.js
npx jest --runInBand shared/__tests__/rnnBasics.test.js shared/__tests__/ctcLoss.test.js shared/__tests__/crnn.test.js
node 20-crnn/index.js --train --steps 160 --write
# 主代理提供的统一构建/服务
npm run build
npm start
```

- 三个Node入口均退出0；各自包含输入、中间值、方法/参数对照和自检。
- 独立Jest：**3组、32项通过**，本次约3.9秒。包括重复/blank、非零blank索引、非法概率/形状/目标、DP对枚举、完整分布对beam、数值梯度、全模型梯度、权重重载、仅像素推理与张量释放。
- `node 19-ctc-loss/index.js`：仅logits实验40步，loss `3.29583693 → 0.01954518`，路径 `[1,0,1]` 折叠得到两个数字0，释放后0个张量。
- `node 20-crnn/index.js --train --steps 160 --write`：loss `4.8090896606 → 0.0045281863`；训练28/28；合成验证0/14→14/14；CPU本轮9.006秒，结束后0个张量。
- CTC解析梯度与有限差分：9坐标最大绝对误差 `3.10150483e−8`。
- 完整CNN参数数值梯度测试容差5e−4通过；8组变量首步梯度都有限且非零；卷积核最大变化 `1.6289658844`。

## 浏览器QA（自己的验证页与独立会话）

本地服务 `http://127.0.0.1:4173`。先在独立创建的CUA验证页实测，随后使用CLI独立会话 `ocr-sequence-review` 复核；未使用、未修改主代理的 `ocr-review`。

| 操作 | 观察到的实际结果 |
|---|---|
| 18默认输入 | 首步RNN h=0.4621，LSTM c=0.3808、h=0.1817 |
| 18 Wₕ=1.2、b_f=3 | 20步灵敏度=38.3376；遗忘门=0.9526；状态表/曲线更新 |
| 18输入 `1,NaN`，再恢复 | 显示有限数值输入错误；恢复按钮回到四步有效结果 |
| 19重复串00 | P=0.448、loss=0.802962；27路径中1条合法，DP与枚举差5.55e−17 |
| 19同概率矩阵只改目标00→01 | loss变为2.538307；greedy和beam仍输出00，未泄漏真值 |
| 19 greedy反例 | greedy为空串，beam输出数字0，累计概率0.4025 |
| 19帧数不足 | T=2、目标00最少3帧，P=0、loss=Infinity，后验留空 |
| 19全blank与空目标 | greedy和beam均为空串，P=1，loss=0 |
| 20加载已训练权重 | 默认像素001，greedy与beam均为001；逐帧10行概率与真实特征显示 |
| 20只把文本框改成111，不重新绘图 | 仍输出001；点击生成改图后才输出111 |
| 20选择时间步3 | 显示对应16维列特征、两个方向各8维状态 |
| 20浏览器完整重训160步 | CTC最终0.004528；合成验证0/14→14/14；训练28/28；卷积变化1.62897 |
| 20控制台 | 上述完整训练后无error日志 |

界面真实截图检查发现训练图原本与控件inline基线对齐不佳，已改为块级显示并给loss图添加轴含义；不需要主代理再修这个布局点。

## 集成接口

### 第18章

`rnnForward(inputs[T,D], parameters, initialState?)`，返回states[T,H]/finalState；LSTM四门列序固定i/f/g/o，返回各步h/c/gates。`bidirectionalRnn`先逆序扫描再恢复原位置；`scalarSensitivity`返回一维真实导数与逐步轨迹。

### 第19章

`ctcForwardBackward(probabilities[T,K],target,blank=0)` 返回loss、logProbability、possible、扩展状态、log域α/β、类别后验。`ctcLossAndGradient(logits,target,blank)` 返回对logits的一阶梯度；`differentiableCtcLoss(tf,logits[B,T,K],targets[B],blank)` 返回批平均标量。greedy/prefixBeam均不接收target，beam宽度参数默认为10。

### 第20章

`createTinyCrnn(tf,config)` 创建8组变量，含forward、inspect、export/importWeights、dispose。`predictRows(tf,model,images,beamWidth=10)`仅接收 `{pixels,height,width}`，返回prediction、greedy、逐帧概率等；`trainTinyCrnn`返回调用者负责释放的model与report。

输入默认 `[B,8,20,1]`，前景1背景0。类别映射为blank索引0、数字0索引1、数字1索引2。权重是自定义 `ocr-course-tiny-crnn-v1` JSON，**不能直接用tf.loadLayersModel加载**。第25章无须依赖此模型或第17章与此模型互换。

## 明确限制与剩余集成工作

1. 没有未解决的本章训练/梯度阻塞；完整小型CRNN训练与重载推理均已实现并实测。
2. 仅合成0/1点阵字形、1–3位、固定8×20；验证与训练来自同一字形生成器、相同14种字符串。**不宣称独立手写或照片准确率，不冒充原论文生产规模。**
3. CTC是同步JS前后向+一阶customGrad，不是高效GPU内核，不支持可靠二阶自动微分；批内T相同，无inputLengths/padding遮罩。
4. 浏览器手绘/空白/范围外输入不保证正确；没有以真值长度、字符框或字典作弊输出。
5. 主代理只需按原分工完成共享入口/根文档/统一build的集成与总体验收；本代理未越界修改这些文件。

## 一手核验来源

- [LSTM原作者资料](https://www.bioinf.jku.at/software/lstm/)与[Graves/Schmidhuber 2005双向LSTM论文](https://www.cs.toronto.edu/~graves/nn_2005.pdf)。
- [CTC原论文，ICML 2006](https://www.cs.toronto.edu/~graves/icml_2006.pdf)。
- [CRNN原论文，2015](https://arxiv.org/abs/1507.05717)。
- [TensorFlow.js 4.22 API](https://js.tensorflow.org/api/latest/)及[自定义梯度官方指南](https://www.tensorflow.org/js/guide/custom_ops_kernels_gradients)。

课程中公式、框架契约、教学缩小部分和本项目实测结果分别说明，未引用第三方模型成绩作为本项目成绩。
