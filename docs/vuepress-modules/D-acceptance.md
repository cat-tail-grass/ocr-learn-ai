# D 模块：独立验收

日期：2026-09-11。对应 `integrate-vuepress-course-site` 6.1–6.5。D 只写本报告、两个验收脚本及 `artifacts/vuepress-integration/D/`，没有改 A/B/C 源码，没有构建、提交、推送、重训或覆盖历史权重/评估 JSON。

6.1–6.5 已完成，已发现的站点问题均已回流并复验通过，无未决站点阻塞项。最终根路径静态站通过271项站点检查和21项实际流程，`/ocr/` 静态站通过272项站点检查和21项实际流程；开发模式的完整与补充证据见下表。

## 方法和可复跑入口

`scripts/verify-course-site.mjs` 使用独立的 `vuepress-d` agent-browser 会话，从根目录实际 01–26 源文件建立预期；在真实浏览器中比较正文、标题序列、全部代码块和长文字片段，实际点击导航、搜索、目录、主题与自测，遍历实验 HTML，再以 HTTP 检查同源链接、运行资源和显式资源清单。脚本不启动或改写站点，不拦截/重写网络请求，`--url` 必须包含部署 base。

`scripts/verify-course-flows.mjs` 通过真实网页控件执行 17 推理以及 25→26 保存和导入导出，使用单独实现的 Levenshtein 距离核对 CER。只允许 `vuepress-d*` 隔离会话；读取并临时清空该会话的 `ocr-photo-evaluation-v1`，结束时恢复原值。下载文件保存在本模块证据目录，上传实际下载的文件；没有模拟识别结果或直接注入首次记录。

本机实际命令采用：

```sh
AGENT_BROWSER_BIN=/Users/wuxiuran/.npm/_npx/6de2aa2fded2970c/node_modules/agent-browser/bin/agent-browser.js node scripts/verify-course-site.mjs --url http://127.0.0.1:4173/ --label dev-root-verified
AGENT_BROWSER_BIN=/Users/wuxiuran/.npm/_npx/6de2aa2fded2970c/node_modules/agent-browser/bin/agent-browser.js node scripts/verify-course-flows.mjs --url http://127.0.0.1:4173/ --label dev-root-flow-pass
```

主代理已提供使用固定 `agent-browser@0.37.1` 的可移植 npm 入口。最终静态验收实际运行并退出0的命令为：

```sh
npm run verify:site -- --url http://127.0.0.1:4173/ --label static-root --session vuepress-d-static-root --deployment-only
npm run verify:flows -- --url http://127.0.0.1:4173/ --label static-root-flows --session vuepress-d-static-root
npm run verify:site -- --url http://127.0.0.1:4175/ocr/ --label static-ocr --session vuepress-d-static-ocr --deployment-only
npm run verify:flows -- --url http://127.0.0.1:4175/ocr/ --label static-ocr-flows --session vuepress-d-static-ocr-flow
```

对新版本重新进行正文完整比对时去掉 `--deployment-only`；站点需已启动且URL包含正确base。每次运行在本地保留完整 `*-commands.jsonl`、结果 JSON、关键快照和截图。命令原始日志及截图由仓库忽略规则留在本地，不要求克隆者具有本机路径；可移植复跑入口是上述 npm 命令。截图是本机人工视觉复核证据，不把截图文件存在等同于已检查。D 最后还实际查看了静态 `/ocr/` 的25手机目录和11浅色三栏截图，确认窄屏目录及桌面文字布局可读。

## 已独立验证

- 全部 26 章：871 个标题、801 个 h2/h3 本章锚点、387 个代码块、1,524 个长正文文本片段、35 个自测 details、92 个 KaTeX 公式。逐章对照原 README，保留完整代码字面、ASCII 图、正文末尾及自测；八阶段侧栏和当前章、01 无上一章/26 无下一章、实验新标签与对应 Node 命令均检查。
- 手机 390×844 和桌面 1536×1000：所有章节页面宽度、代表章目录折叠/展开、侧栏开关、宽表格/代码局部滚动；11 的 HOG/矩阵与18的多行数学、浅深色均检查。章节锚点以真实点击、实际滚动和直接刷新验证。
- 17：读取已有 `ocr-mnist-cnn-v1-9c7b0b8e8224` 模型完成单字推理，25 次重复预测的张量数不变，空白画布明确拒识；未请求训练桥。
- 25→26：通过“加载手写样例”识别 `001208`，录入字符串答案后保存首次结果，改变预处理参数重试不能覆盖首次记录。26 从同一存储键读取，来源 `synthetic-mnist`、模型 ID、流程 `4cdf19a96839` 与 `ocr-photo-v2-2026-09-11` 均保持，前导零仍为字符串。
- 26：实际导出 JSON → 清空隔离会话记录 → 刷新空状态 → 上传该文件，值完整恢复；重复导入不重复计数，预测冲突的同 ID 文件拒绝覆盖；缺来源的合法记录显示“来源未标注”，不归为实拍；通过控件修改标注不改变原预测和来源/模型/流程。

合成样例的单条 CER 为 0.0%，这里只证明操作链、评分口径及数据保存正常，**不是实拍准确率**。真实照片采集和现场预演仍待办。

## 发现、回流与复验

1. D 在 `/25-ocr-engine/` 390×844 下发现文档宽度 476px：长行内概率数组没有断行。向主代理报告后，由主代理在 A 已结束的范围内接管 CSS 修复；之后所有 26 章 390px 宽度检查通过。原证据 `D/dev-root/25-ocr-engine-mobile.json` 和截图保留。
2. D 发现“类间方差”搜索摘要把引号呈现成 `&quot;` 字面。主代理回流 C，以安全文本方式解码索引实体。重载后搜索摘要不再出现实体字面，正文仍保持。
3. B 自测发现的实验目录链接在开发 public 服务不自动补 `index.html`，已统一为显式 HTML；D 在后续 26 实验遍历与25→26实际点击中复验。
4. 主代理发现 `/ocr/` 开发首个页面在 Vue 挂载前会请求根 `/favicon.ico`，在 Vite 的开发 HTML 阶段注入相同带 base 图标后，D 用全新会话首次访问04验证：原始HTML含 `/ocr/favicon.svg`、无根 favicon 请求、资源前缀/HTTP及运行错误检查5/5通过。此开发专用修复不改变静态产物。
5. 验收脚本开发时修正了本机 CLI 稳定 tab ID、CSS 定位语法、绝对/相对 URL 比较、SPA 等待目标正文及 JSON 键顺序比较。对应早期运行的中断或假失败不作为站点缺陷，也不作为通过证据。

## 训练桥证据审阅

D 独立阅读 B 的实现报告、`17-bridge-browser.json` 与只读契约：真实页面来源 `http://127.0.0.1:4173`，桥 `http://127.0.0.1:4474/config` 返回200、模式 `config-only`，日志为空；B 的局部测试另覆盖明确来源403、训练/数据端点405、不创建输出目录。D 的17实际推理已证明普通推理无桥依赖。桥连接本身是 B 的真实浏览器证据审阅，不冒充 D 再次启动桥或执行训练。

## 权威结果与范围

| 环境 | 权威证据 | 当前状态 |
| --- | --- | --- |
| 根路径开发：25/26 和17流程 | `D/dev-root-flow-pass/flow-results.json` | 20/20 通过，另已核对 console error 为空 |
| 根路径开发：阅读/实验 | `D/dev-root-verified/chapters.json`、`home.json`、`labs.json`、`http-resources.json` 和浏览器命令记录 | 阅读/实验阶段全部通过；312条同源观测URL均200；完整脚本随后在旧多标签会话的搜索点击处中断，因此不用不存在的总汇结果代替分项证据 |
| 根路径开发：搜索单独复验 | `D/dev-root-search-final/site-results.json` | 全新 `vuepress-d-search-final` 会话15/15；四词真实鼠标点击均进入对应正文与真实锚点；无运行/console errors |
| 根路径最终静态产物 | `D/static-root/site-results.json`、`D/static-root-flows/flow-results.json` | 271/271站点检查、21/21真实流程通过；145条同源URL全200且78清单资源MIME正确 |
| `/ocr/` 最终静态产物 | `D/static-ocr/site-results.json`、`D/static-ocr-flows/flow-results.json` | 272/272站点检查、21/21真实流程通过；145条同源URL全200且78清单资源MIME正确，所有同源资源均保留`/ocr/`前缀 |
| `/ocr/` 开发模式：D独立复验 | `D/dev-ocr/smoke-results.json`、`D/dev-ocr-favicon/favicon-results.json` | 35/35：9个代表阅读/实验页逐一直接刷新，全26阅读页/26实验/78清单资源与观察模块共291 URL成功；另全新会话首次04图标补验5/5 |
| `/ocr/` 开发模式：主代理运行D脚本 | `D/dev-subdir/site-results.json` | 原始完整运行270/272；唯一根favicon请求同时触发HTTP和前缀两项失败。原结果保留，修复后由上行D独立首次打开5/5及主代理`final/dev-favicon-subdir.json`共同补验；不把旧结果改写成272/272 |

早期 `dev-root`、`dev-root-attempt1`、`dev-root-pass`、`dev-root-flows`、`dev-root-flows-complete`、`dev-root-search`、`dev-root-search-keyboard` 目录保留问题和脚本适配记录，**不作为最终通过证据**。旧会话对长搜索列表的点击未实际导航；主代理确认目标在嵌套结果容器外（目标y995–1019，容器y195–835，scrollTop=0），CLI没有正确滚动该容器。D 将匹配项瞬时滚入视口后，在全新会话真实点击成功。等待条件另修正为严格布尔值。后续完整站点检查使用独立搜索会话；无须因此修改生产代码。

D 不勾选 OpenSpec，由主代理结合全项目回归审查更新实际状态。`--deployment-only` 仍遍历26章与26实验、完整标题/代码块数量/目录/路径/资源、四个代表章手机阅读以及四词正文搜索和真实点击，复用此前已完成的代码与长正文比对。根与`/ocr/`静态站都重新完成17和25→26流程；所有实际浏览器运行错误及console error检查均为空。

为让中断前已完成的根开发阅读证据也可复查，`D/review-root-evidence.mjs` 从保存的真实浏览器命令结果重新对照原 README，并联合已通过的搜索/流程结果：`D/root-development-evidence-review.json` **214/214** 通过。该脚本依赖本机保留的原始命令日志，是对已保存浏览器证据的本地复核，不把中断的完整进程说成退出0；克隆仓库后请用npm入口重新获得完整证据。

最终仅将七份 `D/**/chapters.json` 调整为合法JSON数组、每章一个紧凑JSON行，没有删除或改变字段；脚本后续保存采用相同格式。格式调整前后逐份进行深度值相等校验，结果与规范化SHA见 `D/chapters-formatting.json`。这次排版调整没有重跑已通过的浏览器逻辑。
