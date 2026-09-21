# 运行与验证

## 站点模板

随包 assets/course-site 来自已打磨的课程阅读框架：阶段目录、本章目录、阅读位置、上下章、中文正文搜索、数学公式、答案折叠和移动端样式。原章节 README 是唯一正文，不需要复制一份网站专用讲义。

先写好 course.json，再用 scripts/init-course.mjs 初始化新目录。首次运行需 Node.js ≥22.18.0；在生成项目根目录执行：

```sh
npm ci
npm run check
npm run check:examples
npm run dev
```

默认地址 http://127.0.0.1:4173/。dev 会更新讲义，并同步已有章节和 shared 中的实验资源；刷新实验页查看新逻辑。变更 course.json 的目录、入口或搜索词后重启 dev。

完成后构建并预览静态产物：

```sh
npm run build
npm run preview
```

dev 与 preview 使用同一默认端口，依次运行。模板附带已验证的 package-lock.json，首次和后续干净安装都用 npm ci。新增依赖时更新锁文件并重新验收；避免仅替换为浮动版本。

SITE_PORT 可更换端口，SITE_HOST 默认只监听本机。子目录部署时，构建和预览使用相同 SITE_BASE，例如 /course/；真正发布应使用最终 .vuepress/dist 目录。这里不自动部署网站。

## 讲义与实验路径

- 讲义源：<slug>/README.md；阅读地址：/<slug>/。
- 网页练习：<slug>/index.html；地址：/labs/<slug>/index.html。
- 讲义链接网页使用 `[本章练习](index.html)`；站点自动转换到实验路径。
- 跨章讲义使用 `../<slug>/README.md`，只链接已经存在的讲义；计划章节在大纲写标题即可。
- 脚本/数据/图片使用相对路径；支持的学习资源由准备脚本同步到 labs，Markdown 源文件也可作为下载链接。
- 浏览器领域代码采用原生 ESM，可从 `../shared/<模块>.js` 导入，与 Node 实验共用。模板未预置浏览器打包器；引入必须打包的依赖时补上构建流程并实际验证。
- 默认 index.js 应快速完成，输出输入、中间步骤、结果和边界。有实际算法时以独立可手算结果作断言；运行成功不代表自动证明理论正确。

## 自动检查边界

npm run check 检查目录依赖、必要入口、空文件、明显模板占位和 Markdown 相对文件链接；忽略代码块中的示例路径。npm run check:examples 另运行声明 node=true 的实验，单章默认30秒超时。它不执行讲义中的任意命令，不检查所有网络链接与锚点，也不代替内容和浏览器复核。结果在 .course-checks/report.json。

对 Python、Java 或其他学科工具，在讲义写明对应命令，用可用工具单独执行，并在章级审查记录实际结果。

## 浏览器检查

使用宿主提供的浏览器工具，或已安装的自动化工具，无需特定插件。检查首页目录、标杆课、术语搜索、公式、答案折叠、至少一个真实练习流程，以及约390px窄屏。发布前还要打开 build 的最终静态产物，确保没有借开发服务回退掩盖404。

浏览器或依赖安装不可用时记录未验证原因，完成其他有依据的检查。不得将静态阅读、构建成功或结构通过报告成完整交互验收。

实现依据：[VuePress入门](https://vuepress.vuejs.org/guide/getting-started.html)、[数学插件](https://ecosystem.vuejs.press/plugins/markdown/markdown-math.html)。
