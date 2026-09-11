# OCR 原理学习与手写数字串实验

面向有机器学习基础的研发同学，沿着像素处理、传统识别、神经网络、序列识别和现代 OCR，学习从照片到字符串的完整过程。第 01–13 章为既有课程；第 14–26 章延续同样的讲解尺度。每章都有 **README.md 知识文档、index.html 交互实验、index.js Node.js 实验**。

<CourseCatalog />

## 开始学习

在项目根目录运行（当前实测环境：Node.js 24、macOS arm64、Chrome）：

```bash
npm ci
npm run dev
```

打开 [课程目录](http://127.0.0.1:4173/)，进入任一章节。VuePress 直接读取原章节 README；修改讲义后自动更新，修改实验源码后自动重新打包并同步资源，刷新实验页即可看到结果。页面从本地 HTTP 服务加载，已有模型推理无需外部服务。服务默认仅监听本机。

构建并预览可部署的完整站点：

```bash
npm run build
npm run preview
```

`npm run dev` 和 `npm run preview` 默认都使用 `127.0.0.1:4173`，使用其中一个时先停止另一个。`npm start` 等同于产物预览，需要先构建。最终站点位于 `.vuepress/dist/`，包含全部讲义、实验、已训练模型与必需样例。第 N 章阅读地址为 `/<章节目录>/`，实验地址为 `/labs/<章节目录>/index.html`；每章可直接打开实验并复制 Node 命令。

部署到子目录时，构建和预览传入相同前缀，例如：

```bash
SITE_BASE=/ocr/ npm run build
SITE_BASE=/ocr/ npm run preview
```

然后访问 `http://127.0.0.1:4173/ocr/`。可用 `SITE_PORT` 修改端口、`SITE_HOST` 修改监听地址、`SITE_DEST` 修改构建及预览目录。更换域名或端口前，请先从第 26 章导出 JSON，再在新来源导入记录；只换 `/labs/` 路径仍然共用原 localStorage。

每章的快速实验可以直接运行，例如：

```bash
node 14-neural-network-basics/index.js
node 19-ctc-loss/index.js
node 25-ocr-engine/index.js
node 26-validation/index.js
```

默认实验不重新训练完整模型。第 17、20 章分别说明完整训练命令、数据准备、时间和保存方式。

## 最终实验

打开 [第 25 章：照片识别](25-ocr-engine/index.html)，先用内置手写样例观察原图、阈值图、分割框、归一化输入和逐字候选；再导入自己的照片。正确答案只用于评分。第 26 章保存首次预测、标注与排除原因，并支持 JSON 导出和恢复。

现场范围为白纸、深色笔、单行横写的 0–9 数字串，数字之间有基本间隔，整串完整入镜。支持 JPG、PNG、WebP，可尝试轻微倾斜与光照变化。前导零和连续重复数字保留为字符串。多行、连写粘连、复杂背景及严重透视属于当前局限。

已交付的 CNN 是本项目实际训练并保存的模型。MNIST 单数字测试为 **9769/10000（97.69%）**。这不能代替真实手机照片成绩。合成数字行仅用于检验整个流程，真实照片与现场预演仍待采集；详见 [训练记录](17-cnn-classifier/model/training-report.json) 与 [第 26 章](26-validation/README.md)。

## 课程和分享资料

- [完整大纲](OUTLINE.md)：26 章知识关系与学习顺序。
- [学习进度](PROGRESS.md)：用户已掌握 01–13 章，材料交付状态另记。
- [统一颗粒度标准](docs/COURSE_STANDARD.md)：从旧课程提取的三件套验收要求。
- [课程正确性复核](docs/reviews/2026-09-11/README.md)：第01–26章的独立审查、理论勘误、修复和验证。
- [首版交付检查](docs/COURSE_REVIEW.md)：2026-09-08的历史记录。
- [分享路线与现场操作](docs/SHARING_GUIDE.md)：从 2026-09-22 开始，可拆分成多节。
- [VuePress 整合方案](docs/VUEPRESS_INTEGRATION_PLAN.md)：完整阅读、实验入口和子代理实施/主代理集成方案。
- [VuePress 整合报告](docs/VUEPRESS_INTEGRATION_REPORT.md)：模块交付、开发与静态部署检查、模型保护及验收证据。
- [当前 OpenSpec 任务](openspec/changes/integrate-vuepress-course-site/tasks.md)：VuePress 整合的实施与验收清单。
- [已归档课程任务](openspec/changes/archive/2026-09-11-complete-ocr-course-and-handwritten-digit-demo/ARCHIVE_NOTES.md)：保留51/56的实际交付状态。
- [实拍验收待办](openspec/backlog/real-photo-validation.md)：独立保留的5项真实照片工作。

## 复核实现

```bash
npm test -- --runInBand
npm run verify:lessons -- --execute
npm run test:site:content
npm run test:site:labs
npm run verify:protection
npm run build
openspec validate integrate-vuepress-course-site --strict --no-interactive
```

最后一项需要另行安装 OpenSpec CLI；本次使用 1.2.0。脚本检查结果在 `artifacts/verification/`，站点整合证据在 `artifacts/vuepress-integration/`。

浏览器验收在已启动的开发服务或静态预览上运行。首次使用需要安装 Chromium（`npm exec --yes --package=agent-browser@0.37.1 -- agent-browser install`）：

```bash
npm run verify:site -- --url http://127.0.0.1:4173/ --label manual-root
npm run verify:flows -- --url http://127.0.0.1:4173/ --label manual-root-flow
```

子目录服务将 `--url` 改为含完整前缀的地址，例如 `http://127.0.0.1:4173/ocr/`。流程脚本使用隔离的浏览器会话和合成样例，验证识别、首次保存、评分、JSON 导出与恢复；不会启动模型训练。结构检查和单元测试不能代替讲义审读与实际页面操作。

核心算法在 `shared/` 中由 HTML 和 Node.js 共用。第 14–15、18–19、21–24 章保留可逐步阅读的数学实现；第 16–17、20 章使用 TensorFlow.js 执行真实训练或推理。第 22–23 章演示检测/Transformer 核心计算，范围与完整 EAST、DBNet、ViT、TrOCR 模型明确区分。

2026-09-11正确性复核已完成：33组525项测试、26个Node入口及26页浏览器装载通过，22个浏览器入口构建成功。逐章勘误和关键交互记录见上方复核报告。需要保留历史运行日志时，可指定 `npm run verify:lessons -- --execute --output-dir artifacts/review-2026-09-11`。本轮修复没有覆盖第17/20章已保存的模型和训练报告；新流程开发图回归为CER1/64、整串11/12，实拍仍待采集。
