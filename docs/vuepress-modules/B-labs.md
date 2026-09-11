# 模块 B：实验资源、路径与构建

日期：2026-09-11。对应任务 3.1–3.6。B 已完成实现和局部验证，由主代理审查后勾选；最终整站根路径、子目录与导入导出验收由 D/主代理执行。

## 文件与接口

- `scripts/lab-assets.mjs`：从唯一目录 `.vuepress/catalog.mjs` 导入章目录、项目根及 base 规则；显式列出运行和正文引用资源。26 份章入口、22 份 bundle、6 份共享脚本/样式、10 份 CNN 资源、2 份 CRNN 资源、1 份跨章样例、11 份正文引用文件，共 78 份。
- `scripts/prepare-labs.mjs`：导出 `prepareLabs(options = {})`，CLI 可直接调用。可配置 `root`、`outputDir`、`assets`、`quiet`；默认输出 `.vuepress/public/labs`，返回 `{ outputDir, files, bytes }`。先汇总缺失/非法/重复资源，随后在临时目录逐字节复制，最后交换目录；失败不发布半套资源。路径保持原仓库相对关系，未注入或改写复制后的内容。
- `scripts/build-site.mjs`：导出 `buildSite`，依序执行原实验打包、资源装配、VuePress 构建；子步骤失败传播非零退出码，后续阶段停止。
- `scripts/dev-site.mjs`：初始实验构建/装配后启动 VuePress。README 和 VuePress 文件由其自身监听；章目录及 `shared` 的实验源码/资源由本脚本合并事件、顺序重新打包/装配。忽略生成 bundle、测试和数据下载目录，防止循环。实验页刷新后可观察修改；公开静态 HTML 不承诺 Vue HMR。
- `scripts/preview-site.mjs`：导出 `previewSite`，仅从最终 `SITE_DEST` 读取文件，不回退到源码或旧服务。支持 GET/HEAD、目录补斜线、base 挂载、二进制及字体 MIME；不存在资源返回 404，禁止越界、隐藏路径和 node_modules。
- `scripts/test-labs.mjs`：10 项 Node 自带测试，临时文件仅在 B 证据目录下创建并清理，不改真实资源来模拟缺失。
- `shared/course.js`：从自身脚本 URL 解析 labs 根和阅读根，连接已有静态导航。只对导航设置样式，保留早期章节实验样式。
- 全部 26 章 `index.html`：提供无需路由执行的本章讲义/课程目录链接、显式 `index.html` 的 25/26 实验切换，替换原 README 链接；内嵌 favicon 避免无关 404。既有跨章实验链接补全 `index.html`，兼容 VuePress dev 的 public 文件服务。
- `25-ocr-engine/browser.js`：仅将模型、权重基准 URL 和跨章样例改为当前实验 URL 的相对解析；算法、首次预测、来源、模型标识、流程标识和存储调用保持原样。
- `17-cnn-classifier/train.html`、`webgl-training.js`、`train-webgl.js`：明确本地数据桥 URL、页面来源与独立的只读连接检查。`inference-browser.js` 已使用章内相对地址，无需修改。

package 命令由主代理接线：`node scripts/build-site.mjs`、`node scripts/dev-site.mjs`、`node scripts/preview-site.mjs`、`node scripts/prepare-labs.mjs`、`node scripts/test-labs.mjs`；原 `node scripts/build.js` 作为实验打包入口。

所有统一站点入口使用 `SITE_BASE=/`、`SITE_PORT=4173`、`SITE_HOST=127.0.0.1`、`SITE_DEST=.vuepress/dist` 默认值；支持 `/ocr/` 子目录。元信息不包含 base，浏览器实验资源继续保持 `/labs/<原目录关系>`。

## 训练桥契约

`node 17-cnn-classifier/train-webgl.js --config-only` 只提供 `GET /config` 和预检，不下载 MNIST、不生成输出目录、不训练或保存模型。响应保留原训练配置，`X-OCR-Bridge-Mode: config-only` 可被浏览器读取；其它数据/训练接口返回 405。

`OCR_TRAIN_PORT` 默认 4174，服务只绑定 127.0.0.1。`OCR_TRAIN_ORIGINS` 可用逗号分隔精确本机来源，默认由 `SITE_HOST` / `SITE_PORT` 生成；只允许 http/https 的 127.0.0.1、localhost、[::1]，来源不得带 `/ocr/` 等页面路径。未列出的 Origin 返回 403。正常命令携带新的输出目录，保留原训练过程与已有模型拒绝覆盖规则。

训练页可以使用 `?bridge=http%3A%2F%2F127.0.0.1%3A4474` 预填本机桥，也可手动修改地址。只读按钮不创建模型，不调用训练接口；点击真实训练时也会识别只读模式并提示重启桥。C 已补充第 17 章 README 步骤。

## 实际验证与证据

`node --test --test-reporter=tap scripts/test-labs.mjs`：退出 0，10/10 通过。证据为 `artifacts/vuepress-integration/B/test-labs.tap`，覆盖：

1. 78 资源存在，26/22 入口与实际源码相符，HTML 内部依赖完整，模型 shard 均声明；静态链接保留 `/ocr/` 并显式访问实验 HTML。
2. 所有资源复制后 SHA-256 一致，原目录关系不变，旧垃圾文件被清理。
3. 缺失资源列出具体文件，调用进程非零；失败保留上一版装配。
4. 模拟实验构建退出 37，统一入口传播该码，不运行后续阶段；模拟缺模型时不启动 VuePress。
5. 根路径和 `/ocr/` 的隔离预览产物：200/HEAD/308 正确，原始二进制一致，源码和错 base 不会被服务。
6. 只读桥准确来源 200、不允许来源 403、训练/数据接口 405；未创建模型目录。
7. 基线中 20 份模型与历史评估文件的字节数及 SHA-256 全部保持。

主代理在 `http://127.0.0.1:4173/` 启动整合 dev 后，B 用独立 `vuepress-b` 浏览器会话验证：

| 页面/操作 | 实际结果 | B 证据 |
| --- | --- | --- |
| 11 选择 7 并提取特征 | 共享 UMD 脚本 200；最佳匹配 7，距离 0；HOG 324 维 | `11-browser.json`、`11-lab.png` |
| 11 返回本章阅读 | 打开 `/11-feature-extraction/`，正文标题正确；未请求模型 | `11-return-reading.json` |
| 17 验证样本推理 | 原 model/weights/report/sample 全部 200；预测 0；25 次推理前后张量数均 8 | `17-inference-browser.json`、`17-inference.png` |
| 17 只读桥连接 | 端口 4474，当前页来源 4173，成功读到配置和 config-only；训练日志为空 | `17-bridge-browser.json`、`17-bridge.png` |
| 20 加载权重并识别 | 原权重 200；Prefix beam 与 greedy 都为 001，前导零保留 | `20-browser.json`、`20-lab.png` |
| 25 加载合成样例并首次识别、标注、保存 | 图像/模型/权重均 200；001208；来源 synthetic-mnist | `25-first-browser.json`、`25-recognition.png` |
| 25 正文链接进入 26 | 读取同一 `ocr-photo-evaluation-v1` 记录；原预测/答案 001208；CER 0、整串 100%；model/pipeline 不变 | `26-record-browser.json`、`26-record.png` |

浏览器运行错误输出为空：`browser-errors.txt`。这次结果只属于所用单张合成样例，不能解释为实拍准确率。隔离会话最初存储为空，未读取或修改用户常用浏览器记录。

实际发现并修正：原章节正文链接 `../26-validation/` 在旧服务器和静态 preview 可用，但 VuePress dev 不为 public 目录自动补 index，因而进入文档 404；已把所有实验跨章目录链接改为显式 HTML，并加入回归断言。内嵌 favicon 也消除了首次实验请求的 favicon 404。

## 整合边界与后续验收

主代理独占统一 build/dev 和 `.vuepress/public` / dist 生成物，B 测试只装配到独立临时目录。主代理已确认开发监听能捕捉本模块共享/入口变更并重打 22 bundle、同步 78 文件。B 未执行真实训练，也未改任何历史权重或评估报告。

最终 `/ocr/` 完整 VuePress 产物、导出后重新导入、26 章全覆盖、移动端阅读和全部算法复跑仍由 D/主代理统一验收；本报告不冒充这些整站检查已完成。暂无已知 B 阻塞项。
