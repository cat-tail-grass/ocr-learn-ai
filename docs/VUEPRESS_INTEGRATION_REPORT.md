# VuePress 课程站整合与验证报告

日期：2026-09-11。结论：VuePress课程站整合完成，根路径与 `/ocr/` 的开发服务、最终静态产物及关键实验流程验收通过，已知阻塞问题全部解决。

## 实施边界与基线

原 26 章 README 继续作为唯一正文来源，八阶段课程目录与阅读、实验导航由统一 catalog 生成。实验与所需模型、样例位于静态站点的 `labs/`。现有 CommonJS 算法与 Node 入口保留。

实施前记录了 379 份已存在文件的 SHA-256 和工作区状态。全量基线运行结果：33 组、525 项算法测试通过，26 个 Node 入口通过。20 份模型、训练报告和评估相关文件单独冻结字节校验；历史报告不覆盖，新证据保存在 `artifacts/vuepress-integration/`。

角色、文件所有权、接口与派发记录见 [实施契约](VUEPRESS_IMPLEMENTATION_CONTRACT.md)。A 负责布局导航，B 负责实验资源与构建，C 负责正文兼容和搜索，D 独立验收；主代理负责依赖、配置、审查与集成。

## 依赖与运行方式

锁定 VuePress/Vite bundler `2.0.0-rc.31`、主题/math/slimsearch `2.0.0-rc.134`、Vue `3.5.42`、Sass `1.104.0` 和 KaTeX `0.16.38`。按实际 npm peerDependencies 与依赖约束统一 Vue 实例；补齐现有测试工具依赖的兼容安全补丁。当前 Node 为 24.11.1，要求至少 22.18.0。

`npm run dev` 启动讲义和实验统一开发服务；`npm run build` 按实验打包→资源装配→VuePress 构建；`npm run preview` / `npm start` 只预览最终静态目录。详见 [首页启动指南](../README.md)。

配置与实现依据：[VuePress 安装](https://vuepress.vuejs.org/guide/getting-started.html)、[默认主题](https://ecosystem.vuejs.press/themes/default/config.html)、[数学插件](https://ecosystem.vuejs.press/plugins/markdown/markdown-math.html)、[正文搜索](https://ecosystem.vuejs.press/plugins/search/slimsearch.html)，并核对安装版本的源码与类型声明。

## 完成内容

- 八阶段、26章首页与侧栏，当前章标记、上下章边界、本章二/三级标题目录、锚点直达和阅读位置提示；实验在新标签打开，Node 命令可以复制。
- 26份原讲义直接参与构建：12,873行、801个二/三级标题、387个代码块、197张表格、35个折叠答案和92个公式。正文、代码、ASCII、矩阵和多行公式保留，支持移动端与浅深色。
- 中文正文搜索支持“类间方差”“梯度消失”“CTC”“blank”；实际点击进入对应正文锚点。修正插件增量更新误删索引和摘要实体显示，更新后871条课程索引完整。
- 22个浏览器入口先打包，78项显式资源再装配，最后生成44个静态页面。根路径和 `/ocr/` 使用同一配置，预览只读取最终产物；缺资源或任一构建步骤失败即返回失败。
- 17章已有模型可直接推理，训练桥地址和精确 Origin 可配置，`--config-only` 可以只检查连接。25/26同源首次记录、前导零、来源、模型/流程标识和JSON恢复语义保留。

模块报告：[A 布局](vuepress-modules/A-layout.md)、[B 实验资源](vuepress-modules/B-labs.md)、[C 正文与搜索](vuepress-modules/C-content.md)、[D 独立验收](vuepress-modules/D-acceptance.md)。

## 验证结果

环境：Node.js 24.11.1、macOS arm64、agent-browser 0.37.1 与真实 Chrome。开发和生产静态预览分别测试，不使用开发服务器回退来替代产物检查。

| 检查 | 结果 | 证据（相对 `artifacts/vuepress-integration/`） |
| --- | --- | --- |
| 算法回归 | 33组、525项全部通过 | `final/jest-results.json` |
| Node课程入口 | 26/26运行通过 | `final/lessons.json` |
| 正文、数学和搜索局部检查 | 64/64，26份完整讲义、92个公式、4项正文查询 | `C/content-verification.json` |
| 实验资源/构建/桥契约 | 10/10；78项资源包含正确类型与依赖 | `B/test-labs.tap` |
| 根路径开发阅读与实验 | 26章、26实验；312个同源URL全部成功，保存证据复核214/214 | `D/root-development-evidence-review.json`、`D/dev-root-verified/` |
| 根路径开发搜索与记录流程 | 搜索15/15；实际流程20/20 | `D/dev-root-search-final/`、`D/dev-root-flow-pass/` |
| 根路径最终静态产物 | 站点271/271、实际流程21/21，145条同源URL全部成功 | `D/static-root/`、`D/static-root-flows/` |
| `/ocr/` 开发模式 | D独立35/35、291个URL成功；首次图标复验5/5 | `D/dev-ocr/`、`D/dev-ocr-favicon/` |
| `/ocr/` 最终静态产物 | 站点272/272、实际流程21/21，全部资源前缀与类型正确 | `D/static-ocr/`、`D/static-ocr-flows/` |
| 开发更新 | 5/5；修改讲义在打开的页生效，修改实验源码重新打包并实际运行，测试后原字节恢复 | `final/hmr.json` |
| 模型与历史报告 | 20/20 SHA-256及字节数与实施前一致 | `final/protected-artifacts.json` |
| 依赖锁定 | `npm ci --dry-run --ignore-scripts --audit=false`通过 | `final/npm-ci-dry-run.log` |
| OpenSpec与源码检查 | 严格校验通过；源码空白检查通过，原始运行日志的ASCII空格保留 | `final/openspec-validation.log`、`final/source-whitespace-check.log` |

基线的525项算法测试与26个Node入口也已实际运行；对照文件在 `baseline/`。静态站点和实验资源均通过浏览器与HTTP核对，阅读页没有提前加载识别模型。D逐章比较所有标题、完整代码字面和1,524段长正文；代表章另检查移动端、目录滚动、深浅色、矩阵与自测展开。原始调试命令日志、重试过程和截图保留在本机，提交可复查的最终JSON、快照、报告与可重跑脚本。

## 修复与复验

1. 移动端25章长行内数组撑宽页面：为行内代码允许换行，代码块保留局部滚动。全部26章在390px视口无整页横向溢出。
2. 搜索摘要显示实体字面：仅在文本索引提取时单层解码，通过Vue文本节点呈现；查询高亮保留，没有使用 `innerHTML`。恶意标签仍显示为文本。
3. SlimSearch增量更新按ID字符串前缀误删其他页面索引：使用插件自身全量重建钩子，课程索引更新前后均为871条。
4. 实验跨章目录链接在开发服务返回404：改为显式 `index.html`，根/子目录的26个实验与25→26切换复验通过。
5. 子目录开发首次打开默认请求根图标：Vite开发HTML提前声明带base图标；全新浏览器会话分别在根/子目录复验，没有根部错误请求或运行错误。
6. 原回归测试的简化DOM在引入公共导航后缺少 `URL` 等浏览器环境：补齐测试环境，保留原算法断言；完整525项回归通过。

浏览器验收自身遇到的多标签ID、相对地址比较、SPA等待和长搜索结果滚动问题已修正。早期失败记录不计入最终通过结果，D报告注明权威运行目录和补验关系。

## 重现方式

```bash
npm ci
npm test -- --runInBand
npm run verify:lessons -- --execute
npm run test:site:content
npm run test:site:labs
npm run verify:protection
npm run build
npm run preview
```

另开终端，在已启动的服务上运行 `npm run verify:site -- --url http://127.0.0.1:4173/ --label manual-root` 与 `npm run verify:flows -- --url http://127.0.0.1:4173/ --label manual-root-flow`。首次浏览器安装及开发/子目录用法见[首页指南](../README.md)。

子目录独立输出使用 `SITE_BASE=/ocr/ SITE_DEST=.vuepress/dist-ocr npm run build`，随后以相同两变量及 `SITE_PORT=4175 npm run preview` 启动。产物检查地址为 `http://127.0.0.1:4175/ocr/`。构建不同base时按顺序执行，避免共享临时目录并发写入。

## 保留的工作边界

本次站点流程验证使用合成样例和隔离浏览器记录，不改变第 17/20 章历史模型或第 26 章已有报告。真实照片采集、冻结与现场预演继续保留在 [实拍待办](../openspec/backlog/real-photo-validation.md)，不属于本次站点交付。用户已掌握第 01–13 章、下一学习章节为 14 的状态保持。
