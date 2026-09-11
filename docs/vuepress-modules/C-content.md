# C：正文兼容与搜索实施记录

日期：2026-09-11。对应任务4.1–4.5；任务勾选及整站验收由主代理负责。本记录是完整正文的结构、格式与渲染核对，不代替已经完成的课程理论复核。

## 交付与接线

- `.vuepress/content-config.mjs` 导出 `createCourseContentPlugins()`，依次接入 KaTeX、Markdown 链接、正文兼容与 SlimSearch；主配置已经调用这个接口。
- `.vuepress/plugins/markdown-links.mjs` 仅处理 Markdown 的链接/图片 token，保留所有正文、公式、代码和 ASCII 的 token 内容。读取 `env.filePathRelative`，无该字段时由 `env.filePath` 相对项目根目录解析。
- 课程 README 与辅助阅读文档映射站内页面；章节 `index.html`、训练页和原固定 `127.0.0.1:4173` 实验地址映射 `/labs/`，实验输出原生 `<a target="_blank" rel="noopener noreferrer">`，不交给 Vue Router。
- 文件/图片等实际课程资源映射 `/labs/<原相对路径>`。未进入 `pagePatterns` 的 Markdown、OpenSpec 和 `artifacts/**` 历史证据映射 GitHub `blob/main`（目录为 `tree/main`）；不生成内部任务页面，不把历史日志放进最终站点资源。
- 固定本机4173的首页链接也映射当前站点首页。普通外链、锚点、查询参数保留。根路径与 `/ocr/` 两套局部渲染均通过：实际 VuePress 输出的 `RouteLink to` 不含 base，原生实验链接包含且仅包含一次 base。
- `.vuepress/plugins/markdown-compat.mjs` 固定原生 HTML 与 `markdown.vPre`，保留 details/summary 和代码中的 Vue 模板字面量；KaTeX 用 `delimiters:'all'` 支持 bracket/dollar、矩阵、aligned、cases。代码和宽表格的实际滚动样式由 A 负责。
- `.vuepress/search/options.mjs` 配置 `indexContent:true`、中文界面与显式页面过滤；`tokenize.mjs` 保留中文 OCR 术语并结合 `Intl.Segmenter`，`client.mjs` 使用同一分词函数处理查询，英文大小写由 SlimSearch 归一化。

## 仅必要的 README 修正

| 文件 | 修正 | 保留范围 |
| --- | --- | --- |
| `17-cnn-classifier/README.md` | 补充 `/labs/` 训练页、子目录地址、`--config-only`、自定义端口和精确 Origin、桥地址输入/查询参数 | 理论、原模型、历史训练成绩、模型输出保护和算法说明不变 |
| `21-attention/README.md` | 遮罩 cases 公式的“允许/禁止”包入 `\text{}` | 数学含义、数值和公式结构不变；消除4条中文数学模式警告 |
| `25-ocr-engine/README.md` | 运行说明的预览端口变量 `OCR_PORT` 改为 `SITE_PORT` | 同源首次结果、模型成绩和全部理论不变 |

其余23章无需源格式修正；没有另建或复制讲义，没有删减正文或为搜索插入答案摘要。课程目录与章首/章末导航由 A 和统一元信息提供。

## 逐章完整核对

以下每行均读取该章整份 README，在 `/` 与 `/ocr/` 下使用实际 VuePress Markdown 与 KaTeX 渲染，比较链接转换前后的全部 token 内容、原始代码块/行内代码内容，核对标题数量与唯一锚点、表格、details/summary、公式数量，检查所有 Vue 模板编译错误及 KaTeX 错误。完整源哈希、行数、体积、首末标题和链接分类保存在 `artifacts/vuepress-integration/C/content-verification.json`。

“公式”仅统计实际 LaTeX；0表示该章原本用代码/ASCII表达算式，不进行强制改写。13、18–20章原本使用展开的问答，因此折叠数为0。

| 章 | 行数 | 二/三级标题 | 代码块 | 表格 | 折叠答案 | LaTeX公式 | 结果 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 01 | 232 | 17 | 8 | 4 | 1 | 0 | 通过 |
| 02 | 252 | 19 | 10 | 5 | 1 | 0 | 通过 |
| 03 | 243 | 17 | 11 | 6 | 1 | 0 | 通过 |
| 04 | 681 | 41 | 27 | 10 | 1 | 0 | 通过 |
| 05 | 391 | 25 | 16 | 7 | 1 | 0 | 通过 |
| 06 | 339 | 20 | 15 | 6 | 1 | 0 | 通过 |
| 07 | 423 | 22 | 19 | 4 | 1 | 0 | 通过 |
| 08 | 446 | 22 | 18 | 6 | 1 | 0 | 通过 |
| 09 | 439 | 22 | 17 | 4 | 1 | 0 | 通过 |
| 10 | 606 | 32 | 17 | 6 | 1 | 0 | 通过 |
| 11 | 1100 | 36 | 19 | 7 | 1 | 0 | 通过 |
| 12 | 700 | 29 | 15 | 6 | 1 | 0 | 通过 |
| 13 | 215 | 17 | 6 | 2 | 0 | 0 | 通过 |
| 14 | 520 | 34 | 21 | 12 | 1 | 0 | 通过 |
| 15 | 637 | 46 | 31 | 10 | 1 | 0 | 通过 |
| 16 | 392 | 36 | 14 | 5 | 1 | 5 | 通过 |
| 17 | 581 | 43 | 12 | 11 | 1 | 11 | 通过 |
| 18 | 335 | 18 | 6 | 7 | 0 | 7 | 通过 |
| 19 | 480 | 29 | 10 | 9 | 0 | 13 | 通过 |
| 20 | 476 | 36 | 10 | 7 | 0 | 9 | 通过 |
| 21 | 397 | 30 | 8 | 7 | 1 | 11 | 通过 |
| 22 | 441 | 36 | 12 | 6 | 1 | 9 | 通过 |
| 23 | 468 | 43 | 8 | 4 | 1 | 11 | 通过 |
| 24 | 862 | 45 | 18 | 17 | 14 | 16 | 通过 |
| 25 | 590 | 40 | 18 | 14 | 1 | 0 | 通过 |
| 26 | 627 | 46 | 21 | 15 | 1 | 0 | 通过 |

合计：12,873行、688,104字节、801个二/三级标题、387代码块、197表格、35折叠答案、92公式。另有专用夹具验证原文没有使用的 dollar 数学语法，以及 bracket 行内、bmatrix、aligned、cases、折叠答案内 Markdown、ASCII 与代码中的原地址/双花括号；夹具HTML位于 `artifacts/vuepress-integration/C/compatibility-fixture.html`，不是课程内容。

## 正文搜索与热更新

测试通过已安装的 SlimSearch 插件自身 HTML 提取、索引生成和加载流程执行；临时输出留在测试内存，不覆盖共享 `.vuepress/.temp`、`public` 或 `dist`。使用实际索引的 `t` 字段匹配验证正文命中，并验证每个结果的小节锚点真实存在。

| 查询 | 命中小节数 | 一个实际正文结果 |
| --- | ---: | --- |
| 类间方差 | 9 | `/04-binarization/#类间方差公式解读` |
| 梯度消失 | 2 | `/18-rnn-basics/#知识点与三个入口对应` |
| CTC | 42 | `/19-ctc-loss/#_6-原理、三个主文件与运行对应` |
| blank | 33 | `/19-ctc-loss/#_3-1-为什么要插入-blank-状态` |

查询结果包含标题之外的正文证据；不是用硬编码返回课程地址实现。表中命中数量来自仅26章的独立局部索引，整站加入辅助页后会有所增加。

发现并复现 rc.134 的增量更新缺陷：内部编号1的页面更新时，插件用字符串前缀删除旧条目，也会删除10–19号页面；26页各2条的最小复现从52条降为32条。本站包装插件的 `onPageUpdated`，在课程变动时调用现有完整索引生成/写出流程；没有修改依赖源码。实际26章索引在第二章更新前后均为 **871条**，所有文档ID一致，四项查询在更新后仍通过。

## 实际验证与协作交接

- `node scripts/test-course-content.mjs`，退出0，D回流修正后最后一次输出：`PASS 64 checks; 26 complete chapters; 92 formulas; 4 body queries.`
- 代表章及全部26章的独立 Markdown/KaTeX 渲染和 `compileTemplate` 检查，退出0；初次发现21章4条中文标签警告，格式修正后复跑无警告。
- 根路径和 `/ocr/` 的 README、附录、固定实验地址、首页、图片/文件、OpenSpec/历史证据、外链、锚点及 `filePath` 回退测试通过；真实 VuePress Markdown 结果明确是无base的 `RouteLink to` 与带base的原生 `/labs/` 链接。
- B 已确认将正文引用的24章QA JSON/截图、25/26 Node文件、17章模型报告、26章开发/测试/冻结/清单、共享24–26源码纳入78项显式资源清单。B另报告17章桥的配置/Origin/只读模式协议测试通过；这属于B验证，不冒充C的浏览器实测。
- C没有运行整站构建、共享开发服务、模型训练或原始评估文件写入；没有修改模型、历史报告、OpenSpec清单或主配置。

## 待主代理 / D 完成

1. 在统一站点浏览器中核对搜索框中文界面、四项查询的实际点击跳转、子目录首次进入/刷新、根首页链接；局部测试已验证生成的路由与锚点。
2. 实际观察移动端表格/代码/公式横向滚动、details展开；这些视觉行为依赖A布局和CSS。
3. 构建后对正文引用的 `/labs/` 文件进行HTTP检查。显式清单已与B对齐，C不单独覆盖装配产物。
4. 根/子目录开发与最终静态搜索Worker加载、正文热更新后的搜索结果由D独立复验。

## D回流：搜索摘要实体修正

D在实际浏览器查询“类间方差”时发现摘要显示 `&quot;距离&quot;`，对应DOM包含 `&amp;quot;`。定位安装源码确认：`@vuepress/helper` 的 Cheerio 实例设定 `decodeEntities:false`；SlimSearch rc.134 的 `generatePageIndex` 将HTML文本节点的原始 `node.data` 写入正文 `t` 字段，搜索组件再以Vue文本节点安全渲染，因此把HTML实体当作可见文字。

最小修正位于 `.vuepress/search/text.mjs` 与 `options.mjs`：通过已经由rc.134传给 `slimsearch.createIndex` 的 `extractField` 钩子，对来自HTML的正文 `t` 和带小节锚点的标题 `h` 单层解码；顶层 `page.title`、自定义字段和ID保持原样。使用 `entities` 的 `decodeHTML`，主代理已将现装版本4.5.0在根依赖中精确声明。解码同时用于分词和存储摘要，保证查询与高亮使用同一文本；不修改源README、页面HTML、Worker匹配算法或Vue渲染组件，也不引入 `innerHTML`。

增补3项局部检查并复跑全套，退出0、64项通过：

- 从26章真实索引查询Otsu段落，摘要含正确的 `"距离"`，没有多余 `&quot;距离&quot;`。
- 验证具名、十进制与十六进制实体；`&amp;quot;`只解成字面 `&quot;`，不递归解码；原字段未突变，已是纯文本的标题/自定义字段不再次解码。
- 通过与SlimSearch `SearchResult`相同的Vue文本/`mark`节点构造进行SSR，保留“类间方差”高亮。解码后的`<img onerror=…>`与`<script>`仍是文本，输出没有img/script元素；没有将用户文字解释为HTML。

结果记录在 `content-verification.json` 的 `searchText` 字段。C没有自行启动或构建公共站点；已通知主代理改动就绪，由D在开发站点重载后复验可见摘要。

## 版本与来源

按本次锁定安装源码核对：VuePress/Vite bundler rc.31，主题/math/slimsearch rc.134，KaTeX0.16.38；Vue根依赖已由主代理统一至3.5.42。参考的主来源为 [VuePress Markdown](https://vuepress.vuejs.org/guide/markdown)、[官方 SlimSearch 配置](https://ecosystem.vuejs.press/plugins/search/slimsearch.html)、[官方数学插件配置](https://ecosystem.vuejs.press/plugins/markdown/markdown-math.html)。实际API与边界以本仓库安装版本的类型定义、Markdown renderer和SlimSearch索引源码为准。
