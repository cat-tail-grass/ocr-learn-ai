## Why

项目26章课程已完成生成和正确性复核，但讲义分散在README中，缺少连续阅读导航和统一实验入口。用户希望用VuePress整合课程，并明确要求由多个子代理实施局部模块、主代理输送上下文并完成集成，以控制上下文长度和交付质量。

## What Changes

- 采用VuePress 2、Vite及官方默认主题，将26章现有README作为唯一正文来源，提供完整知识讲解、阶段目录、本章目录、上下章导航和正文搜索。
- 完善数学公式、代码、宽表格、自测答案和移动端阅读，保持现有讲解颗粒度与已复核理论。
- 各章提供交互实验与Node命令入口，实验HTML、共享脚本、模型和样例随文档一起构建为同一静态站点。
- **BREAKING** 统一站点中的原章节URL用于阅读，交互实验迁至`/labs/<chapter>/index.html`；同步适配文档与实验链接、base和公共导航。
- 统一开发、构建及产物预览，精确锁定兼容的VuePress依赖；保留现有CommonJS课程代码、模型标识和评估数据语义。
- 强制采用主代理统筹、A布局导航/B实验资源/C正文兼容与搜索并行实施、D独立验收的工作方式；模块完成须有具体文件与验证证据，主代理负责最终集成。

## Capabilities

### New Capabilities

- `ocr-course-site`: 课程正文展示、统一目录、上下章、本章定位、数学排版与搜索。
- `ocr-lab-site-integration`: 同站点实验资源、路径/base适配、构建流程与模型/评估兼容。
- `ocr-course-parallel-delivery`: 子代理分工、上下文与写入边界、模块交付、独立验证及主代理最终验收。

### Modified Capabilities

无。现有`ocr-learning-curriculum`、`handwritten-digit-string-recognition`、`ocr-demo-evaluation`继续作为课程深度、算法及评分约束；本轮增加阅读和整合能力。

## Impact

- 新增`.vuepress/`站点配置、课程元信息、布局和必要插件，以及实验资源装配/开发/构建/验证脚本。
- 更新`package.json`、lockfile、公共导航及必要的实验路径；对课程README仅做确有必要的渲染与导航适配，算法和理论修改须单独说明及验证。
- 以现有26个Node入口、33组525项测试及冻结模型为回归基线，新增面向阅读、路由、资源和实验流转的验证。
- 前序任务已按用户指示归档，保留51/56的实际状态；5项实拍验收记录在`openspec/backlog/real-photo-validation.md`。VuePress交付不等于实拍验收，也不改变学习者已掌握01–13章的状态。
- 本轮建立proposal/design/specs/tasks；实施从任务清单开始，提案文件齐全不代表代码已完成。技术方案见`docs/VUEPRESS_INTEGRATION_PLAN.md`。
