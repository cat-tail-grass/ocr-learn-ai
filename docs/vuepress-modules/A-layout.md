# A 模块：课程布局与导航

交接日期：2026-09-11。对应 OpenSpec `integrate-vuepress-course-site` 任务 2.1–2.5；此报告不代替整站与 D 独立验收，也不勾选 OpenSpec 清单。

## 交付与接线

- `.vuepress/components/CourseCatalog.vue`：消费首页 `courseStages` / `courseCatalog`，生成八阶段、26 章阅读目录、阶段锚点和各章新标签实验链接。数量、编号、分组、标题、顺序、路径全部来自公共目录元信息。
- `.vuepress/components/CourseLayout.vue`：导入默认主题 `Layout.vue`，扩展 `sidebar-top`、`page-top`、`page-content-top` 三个插槽。保留主题完整 `Content`、移动侧栏及 `VPPageNav`。只从客户端页面数据消费 `course` / `headers`，没有导入含 `node:fs` 的 catalog。
- `.vuepress/components/CourseToc.vue`：共享二／三级标题列表，原生锚点链接、当前小节 `aria-current="location"`，供宽屏右侧目录和折叠目录复用。
- `.vuepress/styles/course.css`：由 `CourseLayout.vue` 自动导入；中文字体、段落与标题节奏、主题颜色变量、阅读条、移动布局、代码／ASCII图／宽表格／KaTeX 矩阵局部滚动。
- `artifacts/vuepress-integration/A/check-components.mjs` 与 `component-check.json`：可复跑的编译检查及结果。

主代理在 `.vuepress/client.mjs` 注册 `layouts: { Layout: CourseLayout }` 和全局 `CourseCatalog`，根 README 插入 `<CourseCatalog />`；不必重复导入样式。主代理的 sidebar、`frontmatter.prev/next` 与组件共用 catalog。已向主代理确认：课程 `page.data.headers = page.headers`；主题 `prev` / `next` / `pageNavbarLabel` 使用中文。

## 行为与关键决定

1. 章首显示当前编号和阶段，提供带 `target="_blank"` / `rel="noopener noreferrer"` 的真实 HTML 实验链接，使用 `withBase(course.labPath)`。文档使用 VuePress `RouteLink`，由其自动拼 base，避免重复 `/ocr/`。
2. Node 命令直接取 `course.nodeCommand`，支持剪贴板复制与选择复制后备；结果用中文状态提示。只展示、复制命令，不自动执行。
3. 本章目录优先消费构建期 `headers`，保证静态 HTML 可见；正文更新后读取原 `#content h2/h3` 作为后备并刷新位置引用。原生可引用锚点保留。
4. 阅读条显示当前章、小节与 0–100% 阅读位置；滚动事件使用动画帧合并，正文高度变化后重新计算。进度仅代表页面阅读位置，不作为掌握或完成学习记录。
5. 宽度至少 1440px 时使用可独立滚动的右侧目录，当前位置自动留在目录可视范围；较小屏幕使用可折叠目录，顶部提供目录入口。默认主题移动侧栏继续负责八阶段章级导航。
6. 章末沿用主题 `VPPageNav`，消费主代理已接入的统一 `frontmatter.prev/next`；第01章 `prev=false`、第26章 `next=false`，不另造一条导航链，保留默认主题 Alt+方向键行为。
7. 浅色／深色跟随默认主题颜色模式；移动端命令、代码块、表格和显示公式局部滚动；自测 `details/summary` 保留，并增加可读的边框和间距。

本地源码依据：`node_modules/@vuepress/theme-default/dist/client/layouts/Layout.vue`、`VPPage.vue`、`VPPageNav.vue` 及 VuePress `RouteLink` 实现。已交叉核对[默认主题扩展文档](https://ecosystem.vuejs.press/themes/default/extending.html)。

## 已执行验证

```text
node artifacts/vuepress-integration/A/check-components.mjs
```

实际结果：退出 0，Vue 3.5.42；三个 SFC 的 script 与 template 均编译通过，CSS 解析通过，主题 Layout 公共导出可解析，组件没有 Node-only catalog/fs 导入。完整结果见 `artifacts/vuepress-integration/A/component-check.json`。

同时已读取 04 / 11 原 README 与主题内容样式，确认原文中存在长代码、ASCII 图、矩阵与表格场景，并按这些容器设置局部溢出规则；没有修改原章节正文。

## 待整站复核

交接时主代理尚未提供统一验证服务地址。按共享工作区契约，没有自行启动服务、运行完整构建或覆盖 public/dist；尚未宣称浏览器验收通过。为释放并发名额供 D 启动，先交付可接线组件与此报告。

整站服务就绪后，主代理／D 应验证：

- 首页八阶段26章链接；04/11 正文完整、二／三级目录数量与锚点匹配、固定条当前标题／百分比、复制实际值、实验新标签保留阅读位置。
- 01无上一章、26无下一章、07→08跨阶段和侧栏高亮；默认主题移动侧栏展开／折叠。
- 1440px及以上右侧目录、390px手机折叠目录、深色模式；长代码、HOG/Hu矩、多列表格局部滚动且页面无横向溢出。
- `/` 与 `/ocr/` 两种 base 下，阅读与实验跳转、直接刷新及浏览器错误；检查无 hydration / 客户端运行异常。

当前已知待办仅为上述运行时复核；若 D 回流布局缺陷，由 A 在所属文件范围修复。
