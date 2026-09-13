# 02. JavaScript 图像处理基础 (Canvas API / ImageData Manipulation)

## 学习目标

本章将教你如何在 JavaScript 环境中实际操作图像数据。你将掌握：

1. **Canvas API 基础** - 创建画布、获取上下文
2. **图像加载** - 将图片绘制到 Canvas 上
3. **ImageData 操作** - 获取和修改像素数据
4. **像素遍历** - 高效遍历所有像素
5. **图像导出** - 将处理结果保存为图片

---

## 前置知识

| 知识点 | 状态 | 说明 |
|--------|------|------|
| 01. 数字图像基础 | 需了解 | 像素、RGB、矩阵表示、索引计算 |

---

## 从图片到可修改的数字

本章把第 01 章的像素数组接到真实图片上。完整过程是：**加载图片 → 画到 Canvas → 读出像素 → 修改数组 → 写回 Canvas → 导出图片**。Canvas 是浏览器里的一块画布；ImageData 是我们从画布取出的像素数据。修改数据后，要写回去，画面才会改变。

## 核心概念

### 1. Canvas 元素

Canvas（画布）是 HTML5 提供的绘图容器，可以通过 JavaScript 动态绘制图形和处理图像。

```html
<!-- 创建 Canvas 元素 -->
<canvas id="myCanvas" width="400" height="300"></canvas>
```

```javascript
// 获取 Canvas 和 2D 上下文
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
```

### 2. CanvasRenderingContext2D

上节的 `canvas` 指向画布元素，`ctx` 是我们给“2D 绘图上下文”起的变量名，可以把它当作操作这块画布的一组工具。不是新建一个 ctx 就有图片：先用 `drawImage` 画进去，再读像素。

| 方法 | 作用 |
|------|------|
| `drawImage()` | 将图片绘制到画布上 |
| `getImageData()` | 获取指定区域的像素数据 |
| `putImageData()` | 将像素数据写回画布 |
| `createImageData()` | 创建新的空白 ImageData |

### 3. ImageData 对象

ImageData 是像素数据的容器，本课程使用默认 8-bit RGBA，主要读取以下三个属性（不是完整 API 列表）：

```javascript
const imageData = ctx.getImageData(0, 0, width, height);

console.log(imageData.width);  // 图像宽度
console.log(imageData.height); // 图像高度
console.log(imageData.data);   // Uint8ClampedArray，存储 RGBA 值
```

**data 数组结构：**
```
[R₀, G₀, B₀, A₀, R₁, G₁, B₁, A₁, R₂, G₂, B₂, A₂, ...]
 ←─ 像素0 ─→   ←─ 像素1 ─→   ←─ 像素2 ─→
```

### 4. Uint8ClampedArray

本章默认 rgba-unorm8 的 ImageData.data 是一个类型数组：
- **Uint8** = 无符号8位整数（0-255）
- **Clamped** = 饱和限幅，超出范围会被限制（-10 → 0，300 → 255）

```javascript
const arr = new Uint8ClampedArray(4);
arr[0] = 300;  // 实际存储 255（自动截断）
arr[1] = -10;  // 实际存储 0（自动截断）
arr[2] = 128.5; // 舍入至 128：恰好 .5 时取相邻偶数
arr[3] = 129.5; // 舍入至 130，不是向下取整
```

小数按最近整数舍入，平局取偶数；`Math.round(128.5)` 则为 129。限幅处理颜色数值，不会替你检查坐标、图像尺寸和邻域边界。

### 5. 像素遍历模式

如果只是给所有像素反色，只需依次访问每四个数；如果要判断“这是第几行、第几列”，就要用坐标。两种写法访问的是同一份数据。

例如宽度为 3 的图，坐标 `(x=1,y=1)` 表示第二行第二列。前面有 `1×3+1=4` 个像素，所以它的 R 在 `data[16]`，A 在 `data[19]`。这里的像素序号 4 和数组起点 16 要分清。

遍历图像像素有两种常用模式：

**模式一：按像素索引遍历**
```javascript
const data = imageData.data;
const pixelCount = imageData.width * imageData.height;

for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    
    // 处理像素...
}
```

**模式二：按坐标遍历**
```javascript
const { width, height, data } = imageData;

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 处理像素...
    }
}
```

### 6. 图像加载流程

加载图片是异步操作：设置 `img.src` 只表示“开始读取”，不表示已经拿到了宽高和像素。因此下面把绘制、读取放进 `onload`；Promise 让调用者可以等待整套流程完成。`src` 是图片地址或上传文件生成的地址，`resolve` 返回处理所需的三个对象，`reject` 把加载失败交给调用者处理。

```javascript
// 完整的图像加载和处理流程
function loadAndProcessImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            // 1. 创建 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            // 2. 获取上下文并绘制图片
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // 3. 获取像素数据
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            
            resolve({ canvas, ctx, imageData });
        };
        
        img.onerror = reject;
        img.src = src;
    });
}
```

---

### 7. 跟一个像素走完“读取—修改—显示—导出”

下面接着使用上一节的加载函数。设图中某个像素是 `[30,100,200,255]`，反色后应为 `[225,155,55,255]`：三个颜色通道分别用 255 减去原值，透明度保持 255。

```javascript
async function invertImage(src) {
    const { canvas, ctx, imageData } = await loadAndProcessImage(src);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
        data[index] = 255 - data[index];
        data[index + 1] = 255 - data[index + 1];
        data[index + 2] = 255 - data[index + 2];
        // index + 3 是透明度，不参与反色。
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
}
```

`getImageData` 得到的是一次像素读取结果，修改 `data` 不会自动修改画布。`putImageData(...,0,0)` 才把结果放回左上角；`toDataURL` 随后把当前画布编码成可保存的 PNG 地址。较大的图片也可以用异步 `toBlob` 获取文件数据，避免生成很长的字符串。

在实验里先用内置样例，依次尝试反色、恢复、亮度调整和导出。观察的重点是“像素值改变”和“画面改变”能否对应起来。

## 代码示例

### 文件说明

| 文件 | 说明 | 运行环境 |
|------|------|---------|
| `index.html` | 浏览器交互演示，包含多个实践示例 | 浏览器 |
| `index.js` | Node.js 示例（概念讲解） | Node.js |

### 运行方式

在项目根目录运行：

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:4173/`，从目录进入本章，再打开[本章交互实验](index.html)。如果服务已经在运行，直接访问即可。实验有内置样例，不需要先准备图片。

Node 示例也在项目根目录运行：

```bash
node 02-js-image-basics/index.js
```

先读本章的小算例，再在页面改变一个参数，对照 Node 输出中的对应步骤。

---

## 与 OCR 的关联

Canvas API 是我们 OCR 引擎的基础设施：

| 功能 | OCR 应用 |
|------|---------|
| 图像加载 | 读取待识别的图片 |
| getImageData | 获取像素用于预处理 |
| 像素遍历 | 执行灰度化、二值化等操作 |
| putImageData | 显示处理结果 |
| toDataURL | 导出处理后的图片 |

---

## 可复用模块

共享实现位于 `shared/core`，`shared/imageUtils.js` 是兼容入口。浏览器里直接用上面的 Canvas API；Node 没有浏览器画布，课程用 `MockImageData` 承载同样的 width、height、data，方便共享算法。

例如，想把所有像素的红通道增加 20，可以写：

```javascript
const { forEachPixel } = require('../shared/core'); // 章节目录中的 index.js
const result = forEachPixel(imageData, pixel => ({ r: pixel.r + 20 }));
```

输入像素 `[30,100,200,255]` 得到 `[50,100,200,255]`。回调只返回 r，表示只改红通道；未返回的 g、b、a 保持原值。`result` 是一张新图，原图保持原样，所以实验可以随时恢复。

| 工具 | 读代码时要注意的含义 |
|---|---|
| `forEachPixel(image, (pixel, index) => patch)` | index 是数组起点 0、4、8…，不是第几个像素；patch 是本次要修改的通道 |
| `forEachPixelXY(image, (pixel, x, y, index) => patch)` | 额外给出坐标，适合按位置处理 |
| `getPixel` / `setPixel` | 非整数或越界坐标，前者返回透明黑，后者忽略写入 |
| `cloneImageData(image)` | 复制整个像素数组，适合保存独立副本 |
| `new MockImageData(data,w,h)` | 直接引用传入数组；改这个数组也会影响容器中的数据 |

### Canvas 边界与 Alpha：为什么代码运行了，画面却不对？

**画布是透明的。** 新 Canvas 和原生 ImageData 默认是 `[0,0,0,0]`。反色只把 RGB 变成 `[255,255,255]`，A 仍是 0，所以像素仍然看不见。本章保留上传图透明度；03–05 章为模拟白纸，会先画白底再加载图片。课程 Node 容器默认白色不透明，是另一种初始化约定。

**读取颜色时，透明度是单独的一项。** ImageData 使用非预乘 RGB，即数值还没有乘以 A/255。要计算白底上实际看见的颜色，使用第 01 章的背景合成公式；仅保留 A 的通道操作并没有完成这一步。

**画面大小不一定等于像素大小。** 假设画布实际宽 400 像素，CSS 把它显示成 200 像素宽。鼠标距显示区域左边 50 像素，对应画布 x=`50×400/200=100`。换算要减去画布在页面中的位置；只改变 CSS 尺寸不会改变像素数组，重新设置 canvas.width/height 则会清空图像和绘制状态。

**写像素与画图片的规则不同。** `putImageData` 直接按像素位置写入，忽略当前缩放、旋转、globalAlpha 和合成设置；`drawImage` 会遵守这些绘制设置。若透明度或缩放似乎“没有生效”，先核对用了哪个方法。

**读取远程图还涉及跨域权限。** 远程服务器要允许 CORS（跨域资源共享），并在给 img.src 赋值前设置 `img.crossOrigin='anonymous'`。否则图片可能显示成功，但读取像素或导出时报错。内置样例与本地上传不依赖远程图片服务器。PNG 能保存 alpha；JPEG 没有透明度通道，导出前应先确定背景颜色。

---

## 自测问题

1. 宽 3 的图中，坐标 `(1,1)` 的 R 和 A 分别在哪里？
2. `[30,100,200,255]` 反色后是什么？
3. 修改 getImageData 返回的 data 后，为什么画布还没变化？
4. 给 Uint8ClampedArray 写入 300、−10、128.5 会存下什么？
5. 400 像素宽的画布显示成 200 像素宽，距显示区域左边 50 像素对应哪个 x？
6. 为什么透明像素反色后仍可能看不见？

<details>
<summary>展开答案与计算依据</summary>

1. 起点 `(1×3+1)×4=16`，R 在 16，A 在 19；像素序号则是 4。
2. `[225,155,55,255]`。三个颜色通道用 255 减，A 保持不变。
3. 像素数组和画布是分开的；需要 `ctx.putImageData(imageData,0,0)` 写回。
4. 255、0、128。前两项被限幅；128.5 恰在两个整数之间，类型数组取相邻偶数。Math.round 的半整数规则不同。
5. `50×400/200=100`，要用实际像素尺寸与显示尺寸的比例换算。
6. 如果 A=0，改变 RGB 后 A 仍为 0，背景仍会透过。只有明确合成背景或改变 A 才会改变这一点。

</details>

---

## 下一步

学完本章后，继续学习 **03. 灰度化**，开始第一个实际的图像预处理操作！


## 三种产物对应与依赖

| 知识点 | 文档位置 | HTML 实验 | Node 实验/函数 |
|---|---|---|---|
| ImageData/舍入 | 核心概念3/4 | 内置样例、像素读数 | 演示1/2 |
| 遍历/通道/修改 | 核心概念5、可复用模块 | 通道、反色、亮度、恢复 | 演示3–5/7 |
| 加载/导出/alpha | 核心概念6、Canvas边界 | 上传/拖放、导出 | 演示6（API说明） |

安装与启动方式见上面的“运行方式”。本章 Node 示例不触发模型训练；需要预览发布后的静态站时，再使用 `npm run build` 和 `npm start`。

02–05 的 `browser.js` 调用共享模块，构建为同目录 `bundle.js`；HTML 只保留交互和展示，算法步骤请对照共享源文件。

## 参考来源

- [WHATWG Canvas 像素操作](https://html.spec.whatwg.org/multipage/canvas.html#pixel-manipulation)
- [ECMAScript ToUint8Clamp](https://tc39.es/ecma262/2023/multipage/abstract-operations.html#sec-touint8clamp)
