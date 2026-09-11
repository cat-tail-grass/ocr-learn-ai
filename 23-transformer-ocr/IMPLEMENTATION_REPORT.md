# 第21–23章局部实施与验证报告

日期：2026-09-08。执行环境：Node.js v24.11.1。负责范围仅限本报告列出的章节、对应共享模块和独立测试；未修改根配置、共享总入口、OpenSpec，未提交git。最终bundle由主代理统一构建。

## 旧课对标与正式标准落实

实读了 `05-denoising/README.md`、`index.js`、HTML控制/显示区域，以及第11章完整知识结构、Node各类特征实验和HTML手绘/多视图交互。另已阅读 `docs/IMPLEMENTATION_CONTRACT.md`、`docs/COURSE_STANDARD.md`、相关OUTLINE和OpenSpec设计/规格。

| 对标点 | 旧课实质内容 | 本次落实 |
|---|---|---|
| README | 第05章噪声→卷积手算→核/边界→三滤波对照；第11章逐类特征、维度、实现、比较、自测 | 三章分别394/438/467行；逐点动机、公式符号、手算、实现、参数/局限、OCR位置、方法对比、误区和自测答案 |
| Node | 第05章多个编号实验与原始/扰动/结果/PSNR；第11章逐类特征与距离/维度对照 | 第21章7组、第22章6组、第23章7组实验；打印中间矩阵/贡献、参数对照、误差与断言自检 |
| HTML | 内置样本/可变输入、参数调整、处理前后、多种过程图、数值 | QKV输入、训练按钮、DB四图/框/EAST角度、patch/多头/三类attention、可编辑像素、重置与错误清理 |
| 可读实现 | 注释解释算法步骤，可逐行跟踪 | 核心共享模块238/332/390行；点积、patch遍历、连通域BFS等核心循环展开并注释 |
| 三入口一致性 | 同一知识在讲义、交互、Node出现 | 每章README提供“知识点—文档位置—HTML—Node”对应表，两个运行入口使用相同CommonJS算法 |

行数仅记录实读规模，不作为完成依据。旧HTML的大量样式和重复算法未照搬；公共视觉与导航使用主代理提供的 `shared/course.css`、`shared/course.js`。

## 修改文件

- `21-attention/README.md`、`index.js`、`browser.js`、`index.html`
- `22-text-detection-networks/README.md`、`index.js`、`browser.js`、`index.html`
- `23-transformer-ocr/README.md`、`index.js`、`browser.js`、`index.html`、本报告
- `shared/21-attention/index.js`
- `shared/22-text-detection-networks/index.js`
- `shared/23-transformer-ocr/index.js`
- `shared/__tests__/attention21.test.js`
- `shared/__tests__/textDetection22.test.js`
- `shared/__tests__/transformer23.test.js`

未手写或自行覆盖bundle文件。实施期间用esbuild的write:false做过内存构建，临时验证服务已关闭；最终实际QA在主代理4173服务进行。

## 可运行命令与结果

从项目根目录运行：

```bash
node 21-attention/index.js
node 22-text-detection-networks/index.js
node 23-transformer-ocr/index.js
npx jest --runInBand shared/__tests__/attention21.test.js shared/__tests__/textDetection22.test.js shared/__tests__/transformer23.test.js
```

三份Node脚本全部退出码0，所有内置断言通过。最终独立Jest结果：**3 suites / 30 tests全部通过，0 snapshots，0.447秒**。这次报告的30项是独立执行结果，不将主代理的全仓结果作为本代理重复执行的成绩。

验证覆盖手算softmax/矩阵乘法、非方形cross、masked/unmasked Q/K/V有限差分、query优化下降、DB公式/稳定BCE梯度、四邻域连通性、分数过滤、NMS/IoU、0°/90°EAST角点、padding还原、HWC切patch、位置编码、双头手算、LayerNorm、FFN手算、排列等变性、整个decoder的未来信息隔离、重复零/EOS生成、无效输入与空图。

实测主要数字：

- 第21章默认Q0输出 `[8.02224185,11.97775815]`；query优化120步，损失 `0.08→0.00255811812`，预测 `.5→.82847212962`，目标为.9。
- 第22章P=T、k=50时B̂=.5，∂B̂/∂P=12.5；P=.51/T=.48/y=1/k=12时BCE=.52926044903，P梯度−4.93151479130。
- 第22章默认P支路2框，组件面积121/169；DB教学支路2框，面积103/124。
- 第23章无位置反序等变最大误差4.44e−16；加固定位置后的对应误差2.5563907727。默认8×4视觉token，decoder 3×4，cross每头3×8。

## 独立浏览器QA证据

使用本代理新建的独立Codex浏览器标签，对 `http://127.0.0.1:4173/21-attention/`、`/22-text-detection-networks/`、`/23-transformer-ocr/` 实际操作。未使用或干预主代理 `ocr-review` 会话。

| 章节 / 操作 | 页面实际可见证据 | 结果 |
|---|---|---|
| 21 修改Q=`[[1,0]]`、K=`[[1,0],[0,1]]`、V=`[[10],[20]]`，点击计算 | 状态为Q1×2/K2×2/V2×1/输出1×1；权重0.6698/0.3302，输出13.30238 | 通过 |
| 21 点击120步梯度更新 | 初始loss .08000000000000002；最终loss .0025581181202325104、prediction .8284721296244253 | 通过 |
| 21 输入坏JSON `[[1,]]` | 显示JSON解析错误；分数表、权重表、输出和选择行清空 | 通过 |
| 21 输入空矩阵 `[]` | 显示“Q must be a nonempty number[][]” | 通过 |
| 21 恢复默认后开启causal | Q0权重[1,0,0]，输出[10,0]，默认QKV恢复 | 通过 |
| 22 k从50改为1 | (x=3,y=8) P/T不变；B̂ .88356774949→.51013190491；导数5.1437890774→.2498973445；理论峰值12.5→.25 | 通过 |
| 22 改k后看两支路框 | 两支路均仍2框，与B̂>.5等价P>T的推导相符 | 通过 |
| 22 切换空预测场 | P=0；两支路数组均[]，页面明确无满足筛选条件的区域 | 通过 |
| 22 输入x=99，然后重置 | 提示x应为0…47；重置后恢复k50、x3/y8与2框 | 通过 |
| 22 角度30°改为−60° | polygon第一点由[6.76794919,10.13397460]变为[6.13397460,13.23205081]；实线旋转框/虚线外接框同时可见 | 通过 |
| 23 patch2改4，选择cross | 状态8×4 patches→2×16 patches，视觉token从8×4→2×4；cross矩阵3×2；Q0权重.9986/.0014 | 通过 |
| 23 self层causal开启 | Q0=[1,0,0]，Q1=[.5363,.4637,0] | 通过 |
| 23 关闭causal | Q0=[.2798,.2164,.5038]，Q1=[.2914,.2520,.4566]，上三角恢复非零 | 通过 |
| 23 像素输入`[]` | 显示4行8列错误；旧权重表数量0 | 通过 |
| 23 重置后改4头并选头3 | 恢复默认图/patch2/causal；状态4头、每头1维，头3输出可见 | 通过 |

三页读取的浏览器console error列表均为空。已目视检查第21章控件/错误状态，第22章EAST四边形与外接框，第23章图像块、控制区及逐格数值热图。尚未做移动端多浏览器兼容矩阵。

期间遇到一次HTML已更新但旧bundle未同步导致重置按钮无事件的问题；主代理重新构建后，本代理刷新4173页面并复测重置/遮罩通过。当前无该阻塞问题。

## 关键集成接口

- 第21章：`scaledDotProductAttention(Q,K,V,{mask,temperature})→{scores,weights,output}`；`attentionBackward→{dQ,dK,dV}`；`matmul/transpose/matrixShape/causalMask`供第23章直接引用。布尔mask的true表示允许，矩阵行是token。
- 第22章：`differentiableBinarize(P,T,k)→{binary,dProbability,dThreshold}`；`extractBoxes`和`nms`返回半开坐标区域；`decodeEastRBox`返回polygon与外接框。x向右/y向下/θ正向顺时针，距离以图像像素为单位，只有锚点乘stride。
- 第23章：`patchify`接受平面HWC数据；`multiHeadAttention`采用D×D总投影、等宽头；`encoderBlock/decoderBlock`返回最终输出和attention中间结果；`greedyDecode`返回token、停止原因及步数。
- 所有模块CommonJS、不依赖DOM。无额外持久化依赖需求。主代理可按需要维护 `shared/index.js` 总导出，不是本章运行前提。

## 实现边界与遗留事项

无待修复的阻塞代码或QA问题。以下为有意的课程范围边界，均写进README和页面：

1. Attention只优化两个query参数，不训练OCR；加性attention只实现前向。
2. 第22章不含EAST/DBNet主干、训练或成品模型推理；合成P/T不是灰度阈值检测器，矩形扩张不等于真实多边形unclip，普通axis-IoU NMS不等于EAST locality-aware NMS。
3. `mapBoxToOriginal`裁切axis框，但polygon仅作仿射还原，不实现多边形裁切。
4. 第23章随机参数、固定正弦PE、pre-norm+ReLU、无CLS/词表训练/cache，不能当ViT或TrOCR模型；教学生成BOS/EOS不同，真实TrOCR按发布配置适配。
5. 三章无真实照片OCR准确率指标；课程说明不把运算验证或论文指标转为识别成绩。

## 一手来源

- [Bahdanau attention](https://arxiv.org/abs/1409.0473)
- [Attention Is All You Need](https://arxiv.org/html/1706.03762v7)
- [EAST](https://arxiv.org/html/1704.03155v2)
- [DB论文](https://arxiv.org/html/1911.08947v2)、[作者预测头](https://github.com/MhLiao/DB/blob/master/decoders/seg_detector.py)、[作者后处理](https://github.com/MhLiao/DB/blob/master/structure/representers/seg_detector_representer.py)
- [ViT](https://arxiv.org/html/2010.11929v2)
- [TrOCR论文](https://arxiv.org/html/2109.10282v2)、[官方Transformers文档](https://huggingface.co/docs/transformers/model_doc/trocr)
- [OpenCV官方检测接口教程](https://docs.opencv.org/4.13.0/d4/d43/tutorial_dnn_text_spotting.html)
- [PaddleOCR官方PP-OCRv5说明](https://www.paddleocr.ai/main/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5.html)

重点已核对：DB推理可直接使用P；原ViT使用可学习位置嵌入及GELU；TrOCR论文的EOS起始/右移训练约定；不沿用旧大纲中未经限定的“最新/最佳”表达。
