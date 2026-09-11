# 并行课程实施约定

## 当前授权与目标

用户于 2026-09-08 明确要求多个子代理分别生成局部课程并由主代理汇总、审查和完成集成。此次允许并行实施多个章节；学习时仍按 14–26 章顺序。旧文档中“每次只生成一章”的限制以此次授权为准。

项目采用 JavaScript。用户已掌握 01–13 章，面向资深研发做多节原理分享。课程保持现有深度，中文解释公式、维度、计算步骤、局限、误区和自测答案。最终 demo 输入白纸深色笔的单行手写数字串照片，有基本间隔，允许轻微倾斜和光照不均；使用项目自行训练的模型。

## 分工及写入范围

| 执行者 | 写入范围 |
|---|---|
| 基础课程代理 | 14、15 章目录，对应 shared 模块和独立测试文件 |
| 训练课程代理 | 16、17 章目录，对应 shared 模块、模型/数据产物和独立测试文件 |
| 序列课程代理 | 18、19、20 章目录，对应 shared 模块和独立测试文件 |
| 现代架构代理 | 21、22、23 章目录，对应 shared 模块和独立测试文件 |
| 评估课程代理 | 24 章目录、shared/24-post-processing 和独立测试文件 |
| 主代理 | 25、26 章，根级文档、依赖、启动/构建、共享入口、最终集成和验证 |

各代理直接编辑分配的文件，不修改别人的写入范围，不提交或覆盖现有用户修改。主代理负责 package.json/package-lock.json、PROGRESS.md、OUTLINE.md、.cursorrules、shared/index.js、shared/README.md 和 OpenSpec 状态。依赖需求通知主代理安装。

## 模块和浏览器约定

- 用户进一步要求与旧课保持三件套教学颗粒度，必须阅读并遵守 `docs/COURSE_STANDARD.md`。每章 README 加入知识点与两个实验入口的对应表。

- 新算法模块采用 CommonJS 导出，按章节位于 shared/XX-name/index.js；不直接访问 DOM。
- 章节 Node.js 演示为 index.js，用 require 引用 shared；浏览器逻辑为 browser.js，经主代理提供的 esbuild 构建成同目录 bundle.js，index.html 引用 bundle.js。bundle.js 是生成产物，勿手写。
- 浏览器与 Node.js 必须调用同一份共享算法，避免在 HTML 内重复实现算法。
- 章节页面使用 ../shared/course.css 和 ../shared/course.js（主代理提供，纯视觉与导航）；页面缺省中文、清楚的输入输出、键盘可操作，无需另建网站或云端部署。
- 从项目根目录运行 npm run build，npm start 提供静态本地预览；所有资源可按本地路径获取。
- 算法接口拒绝无效输入；浮点测试使用容差；训练/演示带种子，实测数字不得伪造。
- 请核验专业技术与框架支持，引用原论文/官方文档。仅教学小实验需要诚实说明简化部分。

## 第 17 章对第 25 章的接口

shared/17-cnn-classifier/index.js 导出：

- prepareDigit(imageData, options = {}) -> { pixels: Float32Array(784), imageData, blank: boolean }。输入为浅背景深色笔画的 RGBA 数据；输出 28×28、背景 0/笔画 1、裁剪后保留比例并居中。imageData 为用于展示的 28×28 RGBA 图。训练与推理采用相同约定。
- createDigitModel(tf, options = {}) -> tf.LayersModel。
- 其余数据/训练辅助功能可自定；训练后提供 17-cnn-classifier/model/model.json、权重文件和真实训练报告。主代理用 tf.loadLayersModel('/17-cnn-classifier/model/model.json') 加载。

默认 @tensorflow/tfjs 由主代理安装。训练课程代理尽早验证后端、启动真实训练，并报告输入约定及产物路径，不下载成品分类模型冒充本项目训练。

## 第 24 章对第 26 章的接口

shared/24-post-processing/index.js 导出：

- alignSequences(truth, prediction) -> { distance, substitutions, deletions, insertions, alignment }。
- evaluatePredictions(records) -> 包含总样本数、有标签有效样本数、真实字符数、S/D/I、CER、整串完全正确率、逐图记录的对象，具体字段及返回示例写入 README。
- records 每项至少支持 { id, truth, prediction, status, exclusionReason }；truth 未定义/null/空串为待标注；exclusionReason 非空为排除；有标签有效样本即使 status 为失败也计入分母，prediction 可为空串。
- 数字串保留前导零和重复字符，CER 可超过 1；无有效样本时比例返回 null，不返回误导性的 0 或 NaN。

## 完成报告

每个代理结束时必须列出修改文件、可运行命令、真实测试结果、关键接口、参考来源和未解决问题。主代理审查代码和教学质量后才更新任务状态，不能把材料完成当成用户已经掌握。
