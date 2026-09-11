# VuePress 实施契约与责任登记

冻结日期：2026-09-11。任务：`integrate-vuepress-course-site`。根目录为项目 sourceDir，原 26 份 README 是唯一正文；全程共享工作区，依文件所有权协作。

## 公共契约

- `.vuepress/catalog.mjs`（仅 Node 侧导入）导出 `chapters`、`stages`、`pagePatterns`、`auxiliarySources`、`sidebar`、`projectRoot`、`siteBase`、`normalizeBase(value)`、`withSiteBase(route, base)`。
- chapter 字段：`id`（两位字符串）、`slug`、`stage`、`stageIndex`、`source`（根目录相对 README 路径）、`title`/`chapterTitle`、`shortTitle`、`docPath`、`labPath`、`nodeCommand`。标题从原 README 一级标题提取。
- 课程页的 `usePageData().value.course` 包含 chapter 全部字段及 `courseId`、`prev`/`next`（chapter + `text`/`link` 或 null）。首页 `page.data.courseStages` 与 `page.data.courseCatalog` 供组件消费；客户端不能导入含 fs 的 catalog。主题 sidebar 与 frontmatter prev/next 从同一目录生成；附录没有上下章。
- 文档地址 `/<slug>/`，实验 `/labs/<slug>/index.html`，资源 `/labs/<原相对路径>`。`SITE_BASE` 默认 `/`，验证 `/ocr/`。元信息路径不含 base；Vue 组件用 `withBase`；静态实验相对地址或装配注入 base；不跳出子目录。
- C 导出 `.vuepress/content-config.mjs` 的 `createCourseContentPlugins()`（返回 math、search、Markdown 兼容插件数组）；主代理 config 统一调用。转换仅作用 Markdown token，不改代码块字面内容；辅助页面见 `auxiliarySources`，不生成内部 OpenSpec 页面。
- A 导出 `.vuepress/components/CourseLayout.vue`（默认主题布局插槽扩展）和 `CourseCatalog.vue`；主代理在 client 注册 `layouts.Layout` 和全局 `CourseCatalog`。章首/本章目录从 course、headers 消费，正文保留；首页由主代理在根 README 插入组件。
- B 提供 `scripts/lab-assets.mjs` 显式资源清单，`prepare-labs.mjs` 导出 `prepareLabs(options = {})` 并可 CLI 运行，输出 `.vuepress/public/labs`；缺失资源必须 throw/非零退出。`build-site.mjs` 依序构建 labs、装配、VuePress；`dev-site.mjs` 准备后启动 VuePress 并监听实验；`preview-site.mjs` 仅服务最终产物。命令接线由主代理修改 package。
- 环境约定：`SITE_BASE=/ocr/`、`SITE_PORT`（默认 4173）、`SITE_HOST`（默认 127.0.0.1）、`SITE_DEST`（默认 `.vuepress/dist`）；开发与构建共享同一 base。最终 dist 不包含 MNIST 下载缓存或历史日志。新增工具 `.mjs`，根 CommonJS 不变。
- 依赖锁定：VuePress/Vite bundler `2.0.0-rc.31`，默认主题/math/slimsearch `2.0.0-rc.134`，Vue `3.5.42`、实体解码 `entities@4.5.0`，Sass `1.104.0`，KaTeX `0.16.38`；Node ≥22.18.0（当前 24.11.1）。已核验 npm peerDependencies，主题要求 Vue ^3.5.42，统一实例；安装由主代理进行。

## 互斥写入

| 角色 | 独占写入范围 | 报告 |
| --- | --- | --- |
| 主代理 | package/lock、config/client/catalog/course-pages、根 README/PROGRESS、全局文档、OpenSpec | `docs/VUEPRESS_INTEGRATION_REPORT.md`、`artifacts/vuepress-integration/baseline/` 与 `final/` |
| A | `.vuepress/components/**`、`.vuepress/styles/**` | `docs/vuepress-modules/A-layout.md`、`artifacts/vuepress-integration/A/` |
| B | `scripts/lab-assets.mjs`、`scripts/prepare-labs.mjs`、`scripts/build-site.mjs`、`scripts/dev-site.mjs`、`scripts/preview-site.mjs`、`scripts/test-labs.mjs`、`shared/course.js`、26 章 `index.html`、`17-cnn-classifier/train.html`、`17-cnn-classifier/inference-browser.js`、`17-cnn-classifier/webgl-training.js`、`17-cnn-classifier/train-webgl.js`、`25-ocr-engine/browser.js`；只作路径/训练桥适配 | `docs/vuepress-modules/B-labs.md`、`artifacts/vuepress-integration/B/` |
| C | `.vuepress/content-config.mjs`、`.vuepress/plugins/markdown-links.mjs`、`.vuepress/plugins/markdown-compat.mjs`、`.vuepress/search/**`、`scripts/test-course-content.mjs`；26 章 README 仅必要格式兼容 | `docs/vuepress-modules/C-content.md`、`artifacts/vuepress-integration/C/` |
| D | `scripts/verify-course-site.mjs`、`scripts/verify-course-flows.mjs`；独立读取实现，不修改 A/B/C 文件 | `docs/vuepress-modules/D-acceptance.md`、`artifacts/vuepress-integration/D/` |

构建产物由主代理协调，不能同时构建覆盖相同 dist/public。A/B/C 按此契约派发、先验证 04/11/17/25，模块完成后由 D 独立验收。受并发名额限制，D 在首个模块结束释放名额后派发；先准备脚本，再验收整站。

实际派发：`/root/a_layout`、`/root/b_labs`、`/root/c_content` 已分别接收仅模块所需的新上下文（不继承历史）；`/root/d_acceptance` 在 A 阶段交付后获得名额并已启动。所有模块已收到基线结果和依赖版本同步。主代理另接管 `shared/__tests__/11-13-correctnessRegression.test.js` 的 VM 浏览器环境适配：补 URL/currentScript，保留全部原算法断言；回归仍为 33 组 525 项。

## 保护与验收

实施前文件清单、SHA-256、工作区 diff/状态、模型与报告哈希记录在 `artifacts/vuepress-integration/baseline/`；不覆盖用户已有内容，不训练或覆盖 17/20 模型、26 评估 JSON。525 项算法测试和 26 Node 入口单独复跑并留新日志；历史报告不重写。25/26 复用原存储键、首次预测与来源，测试只用隔离浏览器会话和合成数据。

模块报告包含：完成需求/任务、改动文件、接线与关键决定、实际运行命令/退出结果、证据、限制和未决项。只有主代理审查改动及 D 验证后勾选任务。最终检查包括根/子路径的开发与静态产物、26 章正文/目录/锚点/实验、公式/代码/details、移动端、中文与英文正文搜索、17 推理/桥配置、25→26 首次记录/评分/JSON 导出导入、资源与浏览器错误、构建失败传播、现有算法/Node 和 OpenSpec 严格校验。

真实照片采集及现场预演仍在 `openspec/backlog/real-photo-validation.md`，用户已掌握 01–13 章状态保留。用户本次授权验证后推送指定远端 main；推送使用正常快进且不包含系统杂项或生成缓存。

## 集成阶段责任转移

- A 阶段交付结束后，D在390px发现第25章长行内概率向量导致整页476px溢出。主代理接管 `course.css` 两处规则，允许行内code断行，保留pre/矩阵局部滚动；独立浏览器初复验已恢复390px，最终交D复验。
- C按D反馈修复搜索摘要双重实体显示，索引单层解码并保留Vue安全文本渲染，局部检查增至64条；依赖由主代理显式锁定。
- B按实际VuePress开发服务行为将实验跨章目录链接明确为index.html，避免落入文档404。
