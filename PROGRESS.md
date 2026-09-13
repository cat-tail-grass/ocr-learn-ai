# OCR 学习进度追踪

## 当前状态

| 项目 | 状态 |
|------|------|
| 当前阶段 | VuePress课程站整合与独立验收完成；课程正确性复核已完成 |
| 用户确认已掌握 | 第 01–13 章（13/26） |
| 下一学习知识点 | 14. 神经网络基础 |
| 课程材料与验证 | 第01–26章三件套齐全；26个Node入口、33组525项测试及根/子目录开发与静态站点通过 |
| 首次分享 | 2026-09-22，可分多节 |

## 2026-09-13 其余 18 章可读性修订

- 按用户认可的第05–12章标准，完成第01–04、13–26章讲义优化；全部26章现已覆盖。保留原有知识点、推导、代码、反例与历史报告，补充“为什么需要这一步 → 输入和符号 → 同一组数逐步计算 → 结果含义 → 接口与边界”的讲解。
- 基础章补齐RGBA、透明度、索引、灰度与Otsu算例；神经网络章按预测、损失、反向、更新组织学习，解释张量轴、门、CTC状态与软后验；现代OCR章追踪Q/K/V、图像块、位置与文本生成；工程章用具体照片记录讲清掩膜、首次预测、拒识、计数和评估分母。长接口表与部分进阶推导可展开查阅。
- 31组新增/改写算例与当前共享函数核对通过；本次18个Node教学入口全部通过；33组525项算法测试、64项正文/链接/搜索检查通过，覆盖26章和92个公式。同步更新搜索测试所引用的旧Otsu原句，查询沿用实际中文分词流程，保留引号实体检查。
- 本次18个阅读页与18个实验入口完成浏览器检查；704像素视口下阅读页没有整页横向溢出或公式错误，字段参考可以展开。实际检查位置编码改变注意力权重、编辑距离插入示例与CNN样例识别；内置合成行读出001208，不新增实拍成绩或保存现场评估记录。
- 20份受保护的模型与历史报告逐字节一致。第16章保存/加载实验的核对产物写到临时目录。用户已掌握01–13章、下一章14以及实拍待办保持原状态。

## 2026-09-13 第 05–12 章可读性修订

- 保留原有知识范围，按具体问题、符号与单位、逐步算例、结果解释、共享实现与适用边界重写八章主体。RGBA 与透明度、前景与标签、校正角、梯度、区域属性、Hu/HOG 和匹配分数均补足上下文。
- 用同一组输入比较去噪方法，用小像素图串起区域筛选、分行与字符排序；补齐 48 道自测及解释。修正第 12 章默认 85 维特征组成及居中、归一化说明，更新文档中的代码片段与实验访问方式。
- 25 组手算与共享算法核对通过；八章开发页面的新正文、表格、代码、实验链接均完成浏览器检查，当前 704 像素视口没有整页横向溢出，浏览器未记录错误；长代码可展开阅读。全课程 64 项正文/搜索检查与 44 页静态构建通过。
- 本次修改课程讲义与编写标准，不更改算法、模型或用户已掌握状态。用户仍已掌握 01–13 章，下一章为 14；实拍验证待办仍保留。

## 2026-09-11 VuePress课程站交付

- 八阶段26章统一阅读入口完成：原README直接渲染，侧栏、本章目录、阅读定位、上下章、实验新标签和Node命令复制可用；完整公式、代码、自测与参考资料保留。
- 中文正文搜索、浅深色和移动端阅读通过；修正长行内代码溢出、搜索摘要实体和热更新索引丢失、实验目录链接及开发首屏图标路径。
- `npm run dev`统一开发，`npm run build`生成包含44个阅读页面和78项实验资源的完整静态产物，`npm run preview` / `npm start`只预览产物。根路径和`/ocr/`的开发、静态、直接刷新均通过。
- 全量33组525项算法测试、26个Node入口、64项正文/搜索检查、10项资源/桥契约检查通过。D静态根路径271项、子目录272项站点检查通过；两者各21项实际推理、首次记录、评分、导出与恢复流程通过。
- 20份模型与历史报告字节保持一致；验收使用合成样例，不产生新训练成绩或实拍成绩。用户已掌握01–13章、下一章14的状态不变。
- 见[整合报告](docs/VUEPRESS_INTEGRATION_REPORT.md)、[独立验收](docs/vuepress-modules/D-acceptance.md)和[完成清单](openspec/changes/integrate-vuepress-course-site/tasks.md)。

## 2026-09-11 VuePress整合准备记录

- 按用户要求归档旧课程任务，保留51/56的实际状态，5项实拍工作未勾选为完成；见[归档说明](openspec/changes/archive/2026-09-11-complete-ocr-course-and-handwritten-digit-demo/ARCHIVE_NOTES.md)和[实拍待办](openspec/backlog/real-photo-validation.md)。
- 建立[integrate-vuepress-course-site](openspec/changes/integrate-vuepress-course-site/tasks.md)提案、设计、规格和实施清单；本节记录实施前的准备工作，随后实施结果见上方交付记录。
- [技术方案](docs/VUEPRESS_INTEGRATION_PLAN.md)已明确A布局导航、B实验资源、C正文兼容与搜索、D独立验收；主代理负责接口、上下文、互斥写入协调与最终集成验收。
- 准备阶段只完成方案与OpenSpec任务管理；后续迁移继续保护模型、现有课程验证数据和用户学习状态。

## 2026-09-11 正确性复核完成

- 六个子代理分模块审读01–24章，主代理审查25–26并集成；子代理因额度中断后，主代理接管剩余修复和验收。
- 讲义、HTML、Node同步修正：Otsu分组/方差、卷积与互相关、旋转角、NMS、Hu/NCC、KNN验证选参、Dropout种子、交叉熵裁剪、CTC稳定性和评估来源等。
- 全量33组525项测试通过，26个Node入口通过，22个浏览器入口构建及26页装载通过；关键交互和照片识别到保存评分流程已验证。
- 17/20章历史模型和报告保持原值；新照片流程标识为ocr-photo-v2-2026-09-11。12张合成开发图回归仍为CER1/64、整串11/12，实拍数仍0。
- 逐章勘误与证据见[本轮复核报告](docs/reviews/2026-09-11/README.md)。以下2026-09-08交付数据保留历史语义，不代表新训练配方或新版实拍成绩。

## 2026-09-08 重启与并行实施

- 最终 demo：照片中的单行手写数字串；白纸深色笔、数字留有基本间隔、完整入镜，允许轻微倾斜和光照不均。
- 子代理按基础网络、训练、序列模型、现代架构、后处理五组并行准备；主代理负责接口、25–26 章、审查与最终验证。
- 本次用户授权提前并行生成课程；用户学习仍按 14–26 章顺序，材料通过测试不会自动标记为用户已掌握。
- 起始验证：已有 11 组、247 项 Jest 测试通过。第 13 章合成数据成绩不代表真实照片识别效果。
- 接口与写入约定：`docs/IMPLEMENTATION_CONTRACT.md`；实施状态：OpenSpec `tasks.md`。

## 第14–26章材料交付（用户学习状态另记）

| 范围 | 已交付材料 | 审查证据 |
|---|---|---|
| 14–15 网络基础 | 完整讲义、真实MLP训练、卷积工作台、Node分步实验 | 14章 IMPLEMENTATION_REPORT.md |
| 16–17 框架与训练 | 张量/训练/保存课程、实际MNIST CNN模型、特征图与独立评估 | 17章 IMPLEMENTATION_REPORT.md |
| 18–20 序列模型 | RNN/LSTM、CTC、完整可训练的小型CRNN | 20章 IMPLEMENTATION_REPORT.md |
| 21–23 现代架构 | Attention、检测网络、Transformer核心计算与交互 | 23章 IMPLEMENTATION_REPORT.md |
| 24 后处理 | 对齐、CER/WER、先验、置信度与独立评分 | 24章 browser-qa-results.json |
| 25–26 整合评估 | 照片导入、分割/CNN、首次预测、标注、导出恢复与完整讲义 | docs/COURSE_REVIEW.md |

- 每章三个主要入口：README.md、index.html、index.js；浏览器与Node共用shared算法。统一尺度见 [COURSE_STANDARD.md](docs/COURSE_STANDARD.md)，首次交付见 [COURSE_REVIEW.md](docs/COURSE_REVIEW.md)，最新正确性复核见[2026-09-11报告](docs/reviews/2026-09-11/README.md)。
- 实际模型：MNIST单数字9769/10000（97.69%）；合成开发行CER1/64、整串11/12；冻结合成测试行CER0/64、整串12/12。三者都不是手机实拍照片成绩。
- 真实照片数目前0，独立采集、开发分析、冻结预演与实拍报告仍待完成，原未勾选项保存在归档任务及[实拍待办](openspec/backlog/real-photo-validation.md)。
- 用户仍已掌握01–13章，下一章为14；下面各阶段的学习统计沿用这一口径。

---

## 已完成知识点列表

### 01. 数字图像基础 ✅
- 完成日期：2024-12-18
- 核心收获：像素、RGB、矩阵表示、索引计算
- 关键代码文件：`01-image-fundamentals/`

---

### 02. JavaScript 图像处理基础 ✅
- 完成日期：2024-12-18
- 核心收获：Canvas API、ImageData、像素遍历
- 关键代码文件：`02-js-image-basics/`

---

### 03. 灰度化 ✅
- 完成日期：2024-12-18
- 核心收获：加权灰度公式、直方图计算
- 关键代码文件：`03-grayscale/`

---

### 04. 二值化 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. 理解二值化是 OCR 预处理的关键步骤
  2. 掌握固定阈值二值化方法
  3. **深入理解 Otsu 算法**：基于类间方差最大化自动计算最佳阈值
  4. 理解自适应阈值的原理和适用场景
  5. 理解阈值选择对 OCR 效果的影响
- 关键代码文件：
  - `04-binarization/README.md` - 知识点说明
  - `04-binarization/index.html` - 浏览器交互演示（三种方法对比、直方图可视化）
  - `04-binarization/index.js` - Node.js 代码示例
- 可复用模块（已添加到 shared/）：
  - `binarizeFixed(imageData, threshold)` - 固定阈值二值化
  - `binarizeOtsu(imageData)` - Otsu 自动阈值二值化
  - `calculateOtsuThreshold(histogram)` - 计算 Otsu 阈值
  - `binarizeAdaptive(imageData, blockSize, C)` - 自适应阈值二值化
- 与下一知识点的关联：
  - 二值化后的图像可能产生噪点
  - 下一章将学习去噪方法处理这些噪点

---

### 05. 图像去噪 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. 理解常见噪声类型：高斯噪声（连续分布）、椒盐噪声（极值点）
  2. **区分卷积与互相关**：均为滑动加权和，卷积需翻转核；对称均值/高斯核两者结果相同
  3. 掌握均值滤波：简单平均，速度快但模糊边缘
  4. 掌握高斯滤波：按空间距离加权平滑，仍会模糊边缘；不是边缘保持滤波器
  5. **掌握中值滤波**：取邻域中值，对椒盐噪声效果极佳
  6. 了解边界处理策略：补零、边缘复制、镜像反射
  7. 学会根据噪声类型选择合适的滤波器
- 关键代码文件：
  - `05-denoising/README.md` - 知识点说明
  - `05-denoising/index.html` - 浏览器交互演示（噪声添加、滤波对比、PSNR计算）
  - `05-denoising/index.js` - Node.js 代码示例（详细注释的算法实现）
- 可复用模块（已添加到 shared/）：
  - `createMeanKernel(size)` - 生成均值核
  - `createGaussianKernel(size, sigma)` - 生成高斯核
  - `convolve(imageData, kernel)` - 通用卷积操作
  - `meanFilter(imageData, size)` - 均值滤波
  - `gaussianFilter(imageData, size, sigma)` - 高斯滤波
  - `medianFilter(imageData, size)` - 中值滤波
  - `addGaussianNoise(imageData, sigma)` - 添加高斯噪声（测试用）
  - `addSaltPepperNoise(imageData, density)` - 添加椒盐噪声（测试用）
- 与下一知识点的关联：
  - 两者都使用邻域，但卷积是线性加权和，腐蚀/膨胀是集合或极值操作，不能混同
  - 去噪后的图像更适合进行形态学处理

---

### 06. 形态学操作 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. **理解结构元素（Structuring Element）**：形态学操作的"模板"，定义操作的形状（矩形、十字、椭圆）
  2. **掌握腐蚀（Erosion）**：只有当结构元素完全匹配前景时保留，效果是缩小区域、去除噪点
  3. **掌握膨胀（Dilation）**：只要结构元素有任意部分与前景重叠就扩展，效果是扩大区域、填补空洞
  4. **掌握开运算（Opening）**：先腐蚀后膨胀，去除小噪点同时保持主体形状
  5. **掌握闭运算（Closing）**：先膨胀后腐蚀，填补小空洞同时保持主体形状
  6. 了解形态学梯度：膨胀减去腐蚀，提取边缘轮廓
  7. 了解顶帽/黑帽变换：提取亮/暗细节
  8. 理解结构元素大小对效果的影响
- 关键代码文件：
  - `06-morphology/README.md` - 知识点说明
  - `06-morphology/index.html` - 浏览器交互演示（结构元素可视化、操作对比）
  - `06-morphology/index.js` - Node.js 代码示例（详细注释的算法实现）
- 可复用模块（已添加到 shared/imageUtils.js）：
  - `createStructuringElement(shape, size)` - 创建结构元素
  - `erode(imageData, structuringElement)` - 腐蚀操作
  - `dilate(imageData, structuringElement)` - 膨胀操作
  - `morphOpen(imageData, structuringElement)` - 开运算
  - `morphClose(imageData, structuringElement)` - 闭运算
  - `morphGradient(imageData, structuringElement)` - 形态学梯度
  - `topHat(imageData, structuringElement)` - 顶帽变换
  - `blackHat(imageData, structuringElement)` - 黑帽变换
- 与下一知识点的关联：
  - 形态学操作后的图像更干净，适合进行倾斜校正
  - 连通域分析（第9章）会用到形态学处理后的结果

---

### 07. 倾斜校正 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. **理解文档倾斜的影响**：倾斜会导致文本行检测失败、字符分割错误、OCR识别率大幅下降
  2. **掌握投影分析法搜索校正角**：比较候选旋转后的水平投影方差，最优候选是直接施加的校正角；原图估计倾斜角与它相反
  3. 了解霍夫变换检测直线：将图像空间的点映射到参数空间，检测累加器峰值找到直线
  4. **理解仿射变换**：图像旋转的数学基础，绕中心点旋转使用逆变换公式
  5. **掌握双线性插值**：旋转后像素值的计算方法，使用周围4个像素的加权平均，效果比最近邻插值更平滑
  6. 理解为什么使用逆变换：正向变换会导致目标图像有空洞，逆变换确保每个目标像素都有值
  7. 掌握两阶段搜索优化：粗搜索 + 细化搜索，提高效率和精度
- 关键代码文件：
  - `07-deskewing/README.md` - 知识点说明（投影分析法、霍夫变换、仿射变换、双线性插值）
  - `07-deskewing/index.html` - 浏览器交互演示（实时倾斜模拟、检测校正、投影可视化、角度-方差曲线）
  - `07-deskewing/index.js` - Node.js 代码示例（完整的倾斜检测与校正流程）
- 可复用模块（已添加到 shared/imageUtils.js）：
  - `calculateHorizontalProjection(imageData)` - 计算水平投影直方图
  - `calculateVerticalProjection(imageData)` - 计算垂直投影直方图
  - `calculateProjectionVariance(projection)` - 计算投影方差
  - `bilinearInterpolate(imageData, x, y)` - 双线性插值
  - `rotateImage(imageData, angle, interpolation)` - 旋转图像
  - `detectSkewAngle(imageData, options)` - 检测倾斜角度
  - `deskew(imageData, options)` - 完整的倾斜校正
- 与下一知识点的关联：
  - 倾斜校正后的图像是水平的，适合进行边缘检测
  - 投影分析的概念将在文本区域定位中再次使用

---

### 08. 边缘检测 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. **理解图像梯度**：梯度描述图像亮度的变化率和变化方向，边缘就是梯度幅值较大的地方
  2. **掌握 Sobel 算子**：使用 3×3 卷积核计算 X 和 Y 方向的梯度，检测垂直和水平边缘
  3. **掌握 Prewitt 算子**：类似 Sobel 但权重更简单，计算更快但噪声敏感度更高
  4. **深入理解 Canny 边缘检测算法**（五步经典算法）：
     - Step 1: 高斯滤波去噪
     - Step 2: 使用 Sobel 算子计算梯度幅值和方向
     - Step 3: 非极大值抑制（NMS），细化边缘至单像素宽
     - Step 4: 双阈值检测，区分强边缘、弱边缘、非边缘
     - Step 5: 滞后阈值边缘连接，保留与强边缘相连的弱边缘
  5. 理解梯度幅值和方向的计算：G = √(Gx² + Gy²)，θ = atan2(Gy,Gx)，保留象限信息；零梯度方向无定义，可在代码中约定为0
  6. 理解不同边缘检测算法的适用场景：Sobel 快速、Canny 精确
- 关键代码文件：
  - `08-edge-detection/README.md` - 知识点说明（梯度、Sobel、Prewitt、Canny 详解）
  - `08-edge-detection/index.html` - 浏览器交互演示（三种算法对比、Canny 五步可视化、参数调节）
  - `08-edge-detection/index.js` - Node.js 代码示例（完整的边缘检测算法实现）
- 可复用模块（已添加到 shared/imageUtils.js）：
  - `createSobelKernelX()` - 创建 Sobel X 方向核
  - `createSobelKernelY()` - 创建 Sobel Y 方向核
  - `createPrewittKernelX()` - 创建 Prewitt X 方向核
  - `createPrewittKernelY()` - 创建 Prewitt Y 方向核
  - `computeGradient(imageData, kernelX, kernelY)` - 计算梯度幅值和方向
  - `sobelEdgeDetection(imageData)` - Sobel 边缘检测
  - `prewittEdgeDetection(imageData)` - Prewitt 边缘检测
  - `nonMaxSuppression(magnitude, direction, width, height)` - 非极大值抑制
  - `doubleThreshold(magnitude, low, high, width, height)` - 双阈值处理
  - `hysteresisTracking(strong, weak, width, height)` - 滞后阈值边缘连接
  - `cannyEdgeDetection(imageData, options)` - Canny 边缘检测
- 与下一知识点的关联：
  - 边缘检测的结果可以用于连通域分析
  - 检测到的边缘帮助定位文字笔画的边界

---

### 09. 连通域分析 ✅
- 完成日期：2024-12-18
- 核心收获：
  1. **理解连通性概念**：4 连通只考虑上下左右，8 连通还包括对角线；OCR 推荐使用 8 连通
  2. **深入掌握 Two-Pass 标记算法**：
     - Pass 1：从左到右、从上到下扫描，初始标记并记录等价关系
     - Pass 2：使用并查集解析等价关系，统一所有等价标签
  3. **掌握并查集（Union-Find）数据结构**：高效管理等价类，支持 Find（查找根）和 Union（合并集合）操作，使用路径压缩和按秩合并优化
  4. **学会区域属性提取**：面积、边界框、质心、填充率、宽高比等
  5. **理解区域筛选在 OCR 中的应用**：通过面积、宽高比、填充率等特征过滤噪点和非文字区域
  6. 理解连通域分析是 OCR 字符分割的核心技术
- 关键代码文件：
  - `09-connected-components/README.md` - 知识点说明（Two-Pass 算法、并查集、区域属性）
  - `09-connected-components/index.html` - 浏览器交互演示（可视化标记结果、区域属性展示、过滤功能）
  - `09-connected-components/index.js` - Node.js 代码示例（完整的连通域分析流程）
- 可复用模块（已添加到 shared/09-connected-components/）：
  - `UnionFind` - 并查集数据结构类
  - `labelConnectedComponents(imageData, connectivity)` - 连通域标记
  - `extractRegionProperties(labels, numLabels, width, height)` - 提取区域属性
  - `filterRegions(regions, options)` - 按条件过滤区域
  - `colorizeLabels(labels, numLabels, width, height)` - 可视化标记结果
  - `extractRegionMask(labels, labelId, width, height)` - 提取单个区域掩码
  - `extractRegionImage(imageData, boundingBox)` - 提取区域图像
- 与下一知识点的关联：
  - 连通域分析提取的区域属性用于文本区域定位
  - 区域的边界框、质心等信息用于字符排序和行检测

---

### 10. 文本区域定位 ✅
- 完成日期：2024-12-19
- 核心收获：
  1. **理解文本区域定位的作用**：从图像中找出包含文字的区域，是 OCR 流程中连接预处理和识别的桥梁
  2. **掌握 RLSA 游程平滑算法**：
     - 水平 RLSA：连接同一行的字符，形成文字行块
     - 垂直 RLSA：连接上下相邻的内容
     - 阈值选择：水平阈值为字符宽度的 1~2 倍，垂直阈值为行高的 0.5~1 倍
  3. **掌握投影分析法**：
     - 水平投影：统计每行前景像素数，峰值对应文字行位置
     - 垂直投影：统计每列前景像素数，谷值对应字符间隔
  4. **掌握区域特征筛选**：基于面积、宽高比、填充率等属性筛选候选字符区域
  5. **学会文字行检测**：使用投影分析或 RLSA + 连通域方法检测文字行
  6. **学会字符分割**：使用垂直投影或连通域分析分割单个字符
  7. **理解字符排序**：按从左到右、从上到下的阅读顺序排列字符
- 关键代码文件：
  - `10-text-localization/README.md` - 知识点说明（RLSA、投影分析、行检测、字符分割）
  - `10-text-localization/index.html` - 浏览器交互演示（可视化定位过程、参数调节、投影图）
  - `10-text-localization/index.js` - Node.js 代码示例（完整的文本定位流程）
- 可复用模块（已添加到 shared/10-text-localization/）：
  - `horizontalRLSA(imageData, threshold)` - 水平 RLSA
  - `verticalRLSA(imageData, threshold)` - 垂直 RLSA
  - `filterCandidateCharacters(regions, options)` - 筛选候选字符区域
  - `detectTextLines(imageData, options)` - 检测文字行
  - `groupRegionsIntoLines(regions, options)` - 按行分组区域
  - `segmentCharacters(imageData, lineRegion, options)` - 垂直投影分割字符
  - `segmentCharactersByCC(imageData, options)` - 连通域分割字符
  - `sortCharacters(characters)` - 按阅读顺序排序
  - `extractLineImage(imageData, lineRegion)` - 提取行图像
  - `calculateRegionStats(regions)` - 计算区域统计信息
  - `localizeText(imageData, options)` - 完整文本定位流程
- 与下一知识点的关联：
  - 文本区域定位后，得到有序的字符区域列表
  - 下一章将学习如何提取字符的特征向量，用于识别

---

### 11. 特征提取基础 ✅
- 完成日期：2024-12-19
- 核心收获：
  1. **理解特征的概念**：特征是用一组数值来描述图像属性的方式，是连接图像和分类器的桥梁
  2. **掌握像素级特征**：最简单的特征，将像素值展开为向量，维度高但信息完整
  3. **掌握统计特征**：均值、方差、填充率、质心等，维度低、计算快
  4. **深入理解图像矩**：
     - 原始矩：M_pq = Σ Σ x^p y^q I(x,y)
     - 中心矩：平移不变
     - 归一化中心矩：尺度不变
     - Hu 矩：连续模型下对平移/尺度/旋转不变；栅格重采样下近似，反射会改变第7矩符号；接近的矩不保证形状相同
  5. **掌握投影特征**：水平投影（每行前景像素数）+ 垂直投影（每列前景像素数），捕获形状轮廓
  6. **掌握网格特征**：将图像划分为 N×N 网格，统计每个区域的填充率
  7. **深入理解 HOG 特征**（方向梯度直方图）：
     - 计算每个像素的梯度幅值和方向
     - 划分 Cell，计算梯度方向直方图
     - Block 归一化，提高光照鲁棒性
     - 拼接所有 Block 特征
  8. **学会特征归一化**：Min-Max、Z-Score、L2 归一化方法
  9. **学会组合多种特征**：将不同类型特征拼接成完整特征向量
  10. **掌握距离度量**：欧氏距离、余弦相似度、曼哈顿距离
- 关键代码文件：
  - `11-feature-extraction/README.md` - 知识点说明（特征类型、Hu矩、HOG详解）
  - `11-feature-extraction/index.html` - 浏览器交互演示（特征可视化、模板匹配）
  - `11-feature-extraction/index.js` - Node.js 代码示例（完整特征提取流程）
- 可复用模块（已添加到 shared/11-feature-extraction/）：
  - `extractPixelFeatures(imageData, options)` - 像素级特征
  - `extractStatisticalFeatures(imageData)` - 统计特征
  - `statisticalFeaturesToVector(stats)` - 统计特征转向量
  - `calculateRawMoment(imageData, p, q)` - 原始矩
  - `calculateCentralMoments(imageData)` - 中心矩
  - `calculateHuMoments(imageData)` - Hu 不变矩
  - `logTransformHuMoments(huMoments)` - Hu 矩对数变换
  - `extractProjectionFeatures(imageData, options)` - 投影特征
  - `extractZoneFeatures(imageData, gridSize)` - 网格特征
  - `computeImageGradients(imageData)` - 梯度计算
  - `extractHOGFeatures(imageData, options)` - HOG 特征
  - `normalizeFeatures(features, method)` - 特征归一化
  - `resizeImage(imageData, width, height)` - 图像缩放
  - `getBoundingBox(imageData)` - 边界框计算
  - `cropAndCenter(imageData, targetSize)` - 裁剪居中
  - `extractCombinedFeatures(imageData, options)` - 组合特征
  - `euclideanDistance(a, b)` - 欧氏距离
  - `cosineSimilarity(a, b)` - 余弦相似度
  - `manhattanDistance(a, b)` - 曼哈顿距离
- 与下一知识点的关联：
  - 特征提取后，得到描述字符的数值向量
  - 下一章将学习如何使用这些特征进行模板匹配识别

---

### 12. 模板匹配 ✅
- 完成日期：2024-12-19
- 核心收获：
  1. **理解模板匹配原理**：将待识别字符与预存模板逐一比较，选择最相似的模板作为识别结果
  2. **掌握多种相似度度量方法**：
     - 欧氏距离：直观，对尺度敏感
     - 曼哈顿距离：计算快，抗噪声
     - 余弦相似度：只关注方向，对尺度不敏感
     - 归一化相关系数：对亮度/对比度变化鲁棒
  3. **学会构建模板库**：
     - 单模板法：每类一个模板，简单快速
     - 多模板法：每类多个模板，更好的泛化能力
  4. **理解预处理的重要性**：尺寸归一化、居中对齐、特征归一化
  5. **掌握匹配决策策略**：
     - 最近邻匹配：选择距离最小的模板
     - 拒绝阈值：超过阈值拒绝识别（处理未知字符）
     - 置信度计算：Softmax 归一化
  6. **理解模板匹配的局限性**：
     - 对变形敏感（旋转、倾斜）
     - 对字体变化敏感
     - 对手写体效果差
     - 无法识别新类别
  7. **了解适用场景**：标准印刷体、OCR-A/B 字体、固定格式文档
- 关键代码文件：
  - `12-template-matching/README.md` - 知识点说明（相似度度量、模板库构建、匹配策略）
  - `12-template-matching/index.html` - 浏览器交互演示（实时识别、距离比较、拒绝阈值）
  - `12-template-matching/index.js` - Node.js 代码示例（完整识别流程）
- 可复用模块（已添加到 shared/12-template-matching/）：
  - `TemplateMatcher` - 模板匹配器类
  - `normalizedCrossCorrelation(a, b)` - 归一化相关系数
  - `calculateDistance(a, b, metric)` - 通用距离计算
  - `createTemplate(imageData, label, options)` - 从图像创建模板
  - `buildTemplateLibrary(samples, options)` - 批量构建模板库
  - `matchTemplate(features, library, options)` - 单次模板匹配
  - `calculateConfidence(results, options)` - 计算置信度
  - `recognizeCharacter(imageData, matcher)` - 识别单个字符
  - `evaluateMatcher(matcher, testSet)` - 评估匹配器准确率
- 与下一知识点的关联：
  - 模板匹配只能选择单个最近模板，容易受噪声影响
  - 下一章将学习 KNN 分类器，通过多个最近邻投票决定类别

---

### 13. KNN 分类器 ✅
- 完成日期：2026-02-11
- 核心收获：
  1. **理解 KNN 分类原理**：不再只看单个最近模板，而是使用 K 个最近邻进行投票决策
  2. **掌握投票策略**：
     - 多数投票：每个邻居等权计票
     - 加权投票：距离越近权重越高（`1 / (d + ε)`）
  3. **掌握 K 值选择思路**：
     - K 过小：对噪声敏感，容易过拟合
     - K 过大：决策边界过于平滑，可能欠拟合
     - 通过验证集比较候选 K 值选择最优参数
  4. **掌握机器学习评估流程**：训练集存样本，验证集选K与参数，独立测试集计算准确率与混淆矩阵
  5. **实现拒识机制**：当最近邻距离超过阈值时输出“未知字符”，降低误识别风险
  6. **理解与模板匹配的关系**：同特征、同距离的最近模板对应1-NN；更大K的效果取决于样本覆盖与噪声
- 关键代码文件：
  - `13-knn-classifier/README.md` - 知识点说明（KNN原理、K值选择、评估方法）
  - `13-knn-classifier/index.html` - 浏览器交互演示（手绘输入、K值调参、投票可视化）
  - `13-knn-classifier/index.js` - Node.js 示例（训练、评估、调参、拒识）
- 可复用模块（已添加到 `shared/13-knn-classifier/`）：
  - `KNNClassifier` - KNN 分类器类（训练、预测、评估、调参）
  - `calculateDistance(a, b, metric)` - 多距离度量统一封装
  - `getKNearestNeighbors(features, trainingSet, k, metric)` - K近邻搜索
  - `voteByNeighbors(neighbors, options)` - 多数/加权投票
  - `splitTrainTest(samples, options)` - 训练集/测试集划分
  - `calculateAccuracy(trueLabels, predictedLabels)` - 准确率计算
  - `buildConfusionMatrix(trueLabels, predictedLabels, labels)` - 混淆矩阵构建
  - `createKNNSample(imageData, label, options)` - 图像样本特征化
  - `buildKNNDataset(samples, options)` - 批量构建 KNN 数据集
  - `evaluateKValues(classifier, validationSet, candidateKs)` - K 值评估
- 与下一知识点的关联：
  - 你已建立“传统机器学习分类”完整闭环（特征 -> 分类 -> 评估）
  - 下一章将进入神经网络基础，学习端到端特征学习能力

---

## 下一步学习

### 下一个知识点：14. 神经网络基础

| 属性 | 内容 |
|------|------|
| **学术名称** | Artificial Neural Network (ANN) / Multi-Layer Perceptron (MLP) |
| **学习目的** | 理解深度学习核心机制，为后续 CNN/CRNN OCR 打基础 |
| **前置知识** | 01-13 全部完成 ✅ |

**学习建议：**

1. 理解神经元、权重、偏置、激活函数的数学意义
2. 学习前向传播（Forward Propagation）计算过程
3. 学习损失函数与反向传播（Backpropagation）原理
4. 掌握梯度下降（Gradient Descent）参数更新
5. 从零实现一个简单多层感知机（MLP）

**核心概念预览：**

- **Perceptron（感知机）**：神经网络最基础单元
- **Activation Function（激活函数）**：引入非线性表达能力
- **Loss Function（损失函数）**：量化预测误差
- **Backpropagation（反向传播）**：高效计算梯度
- **Gradient Descent（梯度下降）**：基于梯度更新参数

**学完后你将能够：**

- 从零实现一个基础神经网络分类器
- 理解神经网络如何自动学习特征
- 为第15章 CNN 做好理论与工程准备

---

## 知识点依赖关系

```
01.数字图像基础 ✅
    ↓
02.JS图像处理基础 ✅
    ↓
03.灰度化 ✅
    ↓
04.二值化 ✅
    ↓
05.图像去噪 ✅
    ↓
06.形态学操作 ✅
    ↓
07.倾斜校正 ✅
    ↓
08.边缘检测 ✅
    ↓
09.连通域分析 ✅
    ↓
10.文本区域定位 ✅
    ↓
11.特征提取 ✅
    ↓
12.模板匹配 ✅
    ↓
13.KNN分类器 ✅
    ↓
14.神经网络基础 ← 当前目标
```

---

## 共享模块更新记录

| 日期 | 章节 | 新增模块 |
|------|------|----------|
| 2024-12-18 | 01-02 | 基础工具函数 |
| 2024-12-18 | 03 | 灰度化函数、直方图函数 |
| 2024-12-18 | 04 | 二值化函数（固定/Otsu/自适应） |
| 2024-12-18 | 05 | 卷积操作、滤波函数（均值/高斯/中值） |
| 2024-12-18 | 06 | 形态学操作（腐蚀/膨胀/开运算/闭运算/梯度/顶帽/黑帽） |
| 2024-12-18 | 07 | 倾斜校正（投影分析/旋转变换/双线性插值） |
| 2024-12-18 | 08 | 边缘检测（Sobel/Prewitt/Canny/梯度计算/NMS/双阈值） |
| 2024-12-18 | 09 | 连通域分析（Two-Pass/并查集/区域属性/区域筛选） |
| 2024-12-19 | 10 | 文本区域定位（RLSA/投影分析/行检测/字符分割/排序） |
| 2024-12-19 | 11 | 特征提取（像素/统计/Hu矩/投影/网格/HOG/归一化/距离度量） |
| 2024-12-19 | 12 | 模板匹配（相似度度量/模板库/匹配器类/置信度计算） |
| 2026-02-11 | 13 | KNN分类器（K近邻搜索/投票策略/数据划分/评估/调参） |

### shared/imageUtils.js 函数列表

| 分类 | 函数 | 说明 |
|------|------|------|
| **类** | `MockImageData` | 模拟 ImageData 类 |
| **像素访问** | `getPixel` | 获取像素值 |
| | `setPixel` | 设置像素值 |
| | `getGray` | 获取灰度值 |
| **图像操作** | `cloneImageData` | 克隆图像数据 |
| | `createImageData` | 创建空白图像 |
| **像素遍历** | `forEachPixel` | 按索引遍历像素 |
| | `forEachPixelXY` | 按坐标遍历像素 |
| **颜色转换** | `rgbToHex` | RGB 转十六进制 |
| | `hexToRgb` | 十六进制转 RGB |
| | `rgbToGray` | RGB 转灰度值 |
| | `rgbToHsv` | RGB 转 HSV |
| **灰度化** | `grayscaleWeighted` | 加权平均法（推荐） |
| | `grayscaleAverage` | 平均值法 |
| | `grayscaleMax` | 最大值法 |
| | `grayscaleMin` | 最小值法 |
| | `grayscaleSingleChannel` | 单通道法 |
| **直方图** | `calculateHistogram` | 计算灰度直方图 |
| | `calculateHistogramStats` | 计算统计信息 |
| **二值化** | `binarizeFixed` | 固定阈值 |
| | `binarizeOtsu` | Otsu 自动阈值 |
| | `calculateOtsuThreshold` | 计算 Otsu 阈值 |
| | `binarizeAdaptive` | 自适应阈值 |
| **滤波核** | `createMeanKernel` | 生成均值核 |
| | `createGaussianKernel` | 生成高斯核 |
| **卷积与滤波** | `convolve` | 通用卷积操作 |
| | `meanFilter` | 均值滤波 |
| | `gaussianFilter` | 高斯滤波 |
| | `medianFilter` | 中值滤波 |
| **噪声（测试用）** | `addGaussianNoise` | 添加高斯噪声 |
| | `addSaltPepperNoise` | 添加椒盐噪声 |
| **形态学操作** | `createStructuringElement` | 创建结构元素 |
| | `erode` | 腐蚀操作 |
| | `dilate` | 膨胀操作 |
| | `morphOpen` | 开运算 |
| | `morphClose` | 闭运算 |
| | `morphGradient` | 形态学梯度 |
| | `topHat` | 顶帽变换 |
| | `blackHat` | 黑帽变换 |
| **倾斜校正** | `calculateHorizontalProjection` | 计算水平投影 |
| | `calculateVerticalProjection` | 计算垂直投影 |
| | `calculateProjectionVariance` | 计算投影方差 |
| | `bilinearInterpolate` | 双线性插值 |
| | `rotateImage` | 旋转图像 |
| | `detectSkewAngle` | 检测倾斜角度 |
| | `deskew` | 完整倾斜校正 |
| **边缘检测** | `createSobelKernelX` | Sobel X 方向核 |
| | `createSobelKernelY` | Sobel Y 方向核 |
| | `createPrewittKernelX` | Prewitt X 方向核 |
| | `createPrewittKernelY` | Prewitt Y 方向核 |
| | `computeGradient` | 计算梯度幅值和方向 |
| | `sobelEdgeDetection` | Sobel 边缘检测 |
| | `prewittEdgeDetection` | Prewitt 边缘检测 |
| | `nonMaxSuppression` | 非极大值抑制 |
| | `doubleThreshold` | 双阈值检测 |
| | `hysteresisTracking` | 滞后阈值边缘连接 |
| | `cannyEdgeDetection` | Canny 边缘检测 |
| **连通域分析** | `UnionFind` | 并查集数据结构类 |
| | `labelConnectedComponents` | 连通域标记（Two-Pass） |
| | `extractRegionProperties` | 提取区域属性 |
| | `filterRegions` | 按条件过滤区域 |
| | `colorizeLabels` | 可视化标记结果 |
| | `extractRegionMask` | 提取单个区域掩码 |
| | `extractRegionImage` | 提取区域图像 |
| **文本区域定位** | `horizontalRLSA` | 水平 RLSA |
| | `verticalRLSA` | 垂直 RLSA |
| | `filterCandidateCharacters` | 筛选候选字符区域 |
| | `detectTextLines` | 检测文字行 |
| | `groupRegionsIntoLines` | 按行分组区域 |
| | `segmentCharacters` | 垂直投影分割字符 |
| | `segmentCharactersByCC` | 连通域分割字符 |
| | `sortCharacters` | 按阅读顺序排序 |
| | `extractLineImage` | 提取行图像 |
| | `calculateRegionStats` | 计算区域统计 |
| | `localizeText` | 完整文本定位流程 |
| **特征提取** | `extractPixelFeatures` | 像素级特征 |
| | `extractStatisticalFeatures` | 统计特征 |
| | `statisticalFeaturesToVector` | 统计特征转向量 |
| | `calculateRawMoment` | 原始矩 |
| | `calculateCentralMoments` | 中心矩 |
| | `calculateHuMoments` | Hu 不变矩 |
| | `logTransformHuMoments` | Hu 矩对数变换 |
| | `extractProjectionFeatures` | 投影特征 |
| | `extractZoneFeatures` | 网格特征 |
| | `computeImageGradients` | 梯度计算 |
| | `extractHOGFeatures` | HOG 特征 |
| | `normalizeFeatures` | 特征归一化 |
| | `resizeImage` | 图像缩放 |
| | `getBoundingBox` | 边界框计算 |
| | `cropAndCenter` | 裁剪居中 |
| | `extractCombinedFeatures` | 组合特征 |
| | `euclideanDistance` | 欧氏距离 |
| | `cosineSimilarity` | 余弦相似度 |
| | `manhattanDistance` | 曼哈顿距离 |
| **模板匹配** | `TemplateMatcher` | 模板匹配器类 |
| | `normalizedCrossCorrelation` | 归一化相关系数 |
| | `calculateDistance` | 通用距离计算 |
| | `createTemplate` | 从图像创建模板 |
| | `buildTemplateLibrary` | 批量构建模板库 |
| | `matchTemplate` | 单次模板匹配 |
| | `calculateConfidence` | 计算置信度 |
| | `recognizeCharacter` | 识别单个字符 |
| | `evaluateMatcher` | 评估匹配器准确率 |
| **KNN分类器** | `KNNClassifier` | KNN 分类器类 |
| | `calculateDistance` | 多距离度量封装 |
| | `getKNearestNeighbors` | K近邻搜索 |
| | `voteByNeighbors` | 多数/加权投票 |
| | `splitTrainTest` | 训练集/测试集划分 |
| | `calculateAccuracy` | 分类准确率计算 |
| | `buildConfusionMatrix` | 混淆矩阵构建 |
| | `createKNNSample` | 图像转 KNN 样本 |
| | `buildKNNDataset` | 批量构建 KNN 数据集 |
| | `evaluateKValues` | K 值对比评估 |
| **工具** | `clamp` | 限制值在范围内 |
| | `lerp` | 线性插值 |

---

## 统计信息

| 阶段 | 知识点范围 | 状态 |
|------|-----------|------|
| 第一阶段：基础准备 | 01-02 | ✅ 已完成 (2/2) |
| 第二阶段：图像预处理 | 03-07 | ✅ 已完成 (5/5) |
| 第三阶段：文本检测 | 08-10 | ✅ 已完成 (3/3) |
| 第四阶段：传统识别 | 11-13 | ✅ 已完成 (3/3) |
| 第五阶段：深度学习基础 | 14-16 | 🔄 进行中 (0/3) |
| 第六阶段：深度学习OCR | 17-21 | 未开始 |
| 第七阶段：现代OCR | 22-23 | 未开始 |
| 第八阶段：自主OCR引擎开发与验证 | 24-26 | 未开始 |

---

## 🎉 阶段里程碑

### 第四阶段：传统识别 - 已完成！

你已经完成 OCR 第四阶段——**传统识别方法**（3/3）：

在这个阶段，你已完成：

1. **特征提取**（✅ 已完成）：掌握多种特征提取方法
   - 像素级特征、统计特征、Hu 矩
   - 投影特征、网格特征、HOG 特征
   - 特征归一化与距离度量

2. **模板匹配**（✅ 已完成）：最直观的字符识别方法
   - 多种相似度度量（欧氏距离、余弦相似度、相关系数）
   - 模板库构建与管理
   - 匹配决策与置信度计算
   - 拒绝阈值处理未知字符

3. **KNN 分类器**（✅ 已完成）：传统机器学习分类方法
   - K近邻搜索与多数/加权投票
   - 训练/验证/测试划分，验证集调参后评估独立测试集
   - 混淆矩阵分析与 K 值调参
   - 拒识阈值处理未知字符

现在你已经能够：
- 从字符图像中提取多种类型的特征
- 构建标准字符模板库
- 使用模板匹配与 KNN 两种传统方法进行字符识别
- 完成“训练—验证集调参—冻结—独立测试评估”的机器学习流程

接下来学习：
- **神经网络基础**：从手工特征进入端到端学习范式
