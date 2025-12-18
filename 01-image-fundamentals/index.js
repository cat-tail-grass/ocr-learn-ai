/**
 * 01. 数字图像基础 (Digital Image Fundamentals)
 * 
 * 本文件演示数字图像的核心概念，帮助你理解：
 * 1. 像素（Pixel）是什么
 * 2. RGB 色彩空间
 * 3. 图像的矩阵表示
 * 4. 位深度与数据大小
 * 
 * 运行方式：node index.js
 */

// ==================== 常量定义 ====================

/**
 * 常见颜色的 RGB 值
 * 用于演示 RGB 色彩空间的工作原理
 */
const COLORS = {
    RED: { r: 255, g: 0, b: 0 },       // 红色：只有红色通道有值
    GREEN: { r: 0, g: 255, b: 0 },     // 绿色：只有绿色通道有值
    BLUE: { r: 0, g: 0, b: 255 },      // 蓝色：只有蓝色通道有值
    WHITE: { r: 255, g: 255, b: 255 }, // 白色：所有通道都是最大值
    BLACK: { r: 0, g: 0, b: 0 },       // 黑色：所有通道都是 0
    YELLOW: { r: 255, g: 255, b: 0 },  // 黄色：红 + 绿
    CYAN: { r: 0, g: 255, b: 255 },    // 青色：绿 + 蓝
    MAGENTA: { r: 255, g: 0, b: 255 }, // 品红：红 + 蓝
    GRAY: { r: 128, g: 128, b: 128 }   // 灰色：R=G=B 时为灰色
};

// ==================== 核心概念演示 ====================

/**
 * 演示 1：像素（Pixel）的概念
 * 
 * 原理解释：
 * - 像素是图像的最小单位
 * - 每个像素包含颜色信息
 * - 一张图像由大量像素组成
 */
function demonstratePixel() {
    console.log('\n' + '='.repeat(60));
    console.log('📍 演示 1：什么是像素（Pixel）');
    console.log('='.repeat(60));
    
    console.log(`
【定义】
像素（Pixel）= Picture Element（图像元素）的缩写
是构成数字图像的最小单位，每个像素存储一个颜色值。

【类比】
把图像想象成一幅马赛克画：
- 每一个小方块 = 一个像素
- 小方块的颜色 = 像素的颜色值
- 所有小方块组合起来 = 完整的图像

【示例】
一个 4×3 的小图像：
┌───┬───┬───┬───┐
│ R │ G │ B │ Y │   R=红, G=绿, B=蓝, Y=黄
├───┼───┼───┼───┤
│ C │ M │ W │ K │   C=青, M=品红, W=白, K=黑
├───┼───┼───┼───┤
│ G │ G │ G │ G │   G=灰色
└───┴───┴───┴───┘
这张图像有 4×3 = 12 个像素
`);
}

/**
 * 演示 2：分辨率（Resolution）
 * 
 * 原理解释：
 * - 分辨率 = 图像的宽度 × 高度（单位：像素）
 * - 分辨率越高，图像越清晰，文件越大
 */
function demonstrateResolution() {
    console.log('\n' + '='.repeat(60));
    console.log('📐 演示 2：分辨率（Resolution）');
    console.log('='.repeat(60));
    
    // 常见分辨率及其像素数量
    const resolutions = [
        { name: 'VGA', width: 640, height: 480 },
        { name: 'HD (720p)', width: 1280, height: 720 },
        { name: 'Full HD (1080p)', width: 1920, height: 1080 },
        { name: '2K', width: 2560, height: 1440 },
        { name: '4K', width: 3840, height: 2160 },
        { name: '8K', width: 7680, height: 4320 }
    ];
    
    console.log('\n【常见分辨率对比】\n');
    console.log('分辨率名称      宽度    高度    像素总数        RGB数据大小');
    console.log('-'.repeat(65));
    
    resolutions.forEach(res => {
        const totalPixels = res.width * res.height;
        // RGB图像：每个像素 3 字节
        const rgbSize = totalPixels * 3;
        const rgbSizeMB = (rgbSize / (1024 * 1024)).toFixed(2);
        
        console.log(
            `${res.name.padEnd(16)}${String(res.width).padStart(4)}  × ${String(res.height).padStart(4)}` +
            `    ${totalPixels.toLocaleString().padStart(12)}    ${rgbSizeMB.padStart(6)} MB`
        );
    });
    
    console.log('\n【重要公式】');
    console.log('像素总数 = 宽度 × 高度');
    console.log('RGB图像数据大小（字节） = 像素总数 × 3');
    console.log('RGBA图像数据大小（字节） = 像素总数 × 4');
}

/**
 * 演示 3：RGB 色彩空间
 * 
 * 原理解释：
 * - RGB = Red（红）+ Green（绿）+ Blue（蓝）
 * - 每个通道取值范围：0-255（8位）
 * - 三原色混合可以产生各种颜色
 */
function demonstrateRGB() {
    console.log('\n' + '='.repeat(60));
    console.log('🎨 演示 3：RGB 色彩空间');
    console.log('='.repeat(60));
    
    console.log(`
【什么是 RGB？】
RGB 是一种加色模型（Additive Color Model）：
- R（Red）  = 红色通道
- G（Green）= 绿色通道
- B（Blue） = 蓝色通道

每个通道的取值范围：0 ~ 255（共 256 个级别）
一个像素可以表示的颜色数：256 × 256 × 256 = 16,777,216 种

【颜色混合原理】
红 + 绿 = 黄
红 + 蓝 = 品红
绿 + 蓝 = 青
红 + 绿 + 蓝 = 白

【常见颜色的 RGB 值】
`);
    
    // 打印常见颜色
    Object.entries(COLORS).forEach(([name, color]) => {
        const hex = rgbToHex(color.r, color.g, color.b);
        console.log(`  ${name.padEnd(10)} RGB(${String(color.r).padStart(3)}, ${String(color.g).padStart(3)}, ${String(color.b).padStart(3)})  ${hex}`);
    });
}

/**
 * 演示 4：灰度（Grayscale）
 * 
 * 原理解释：
 * - 灰度图只有一个通道
 * - 取值 0-255：0=纯黑，255=纯白
 * - 当 R=G=B 时，显示为灰色
 */
function demonstrateGrayscale() {
    console.log('\n' + '='.repeat(60));
    console.log('⬛ 演示 4：灰度（Grayscale）');
    console.log('='.repeat(60));
    
    console.log(`
【什么是灰度图？】
灰度图是只有一个通道的图像，每个像素只有一个值（0-255）。

0   = 纯黑 ████
64  = 深灰 ░░░░
128 = 中灰 ▒▒▒▒
192 = 浅灰 ▓▓▓▓
255 = 纯白 ⬜⬜⬜⬜

【灰度的特点】
1. 数据量是 RGB 的 1/3（每像素1字节 vs 3字节）
2. 当 R = G = B 时，彩色图显示为灰色
3. OCR 通常先将彩色图转为灰度图，简化处理

【灰度转换公式（标准加权法）】
Gray = 0.299 × R + 0.587 × G + 0.114 × B

为什么权重不同？
- 人眼对绿色最敏感（权重最大：0.587）
- 对红色次之（0.299）
- 对蓝色最不敏感（0.114）
`);
    
    // 演示几种颜色的灰度值
    console.log('【颜色转灰度示例】\n');
    
    const testColors = [
        { name: '纯红', r: 255, g: 0, b: 0 },
        { name: '纯绿', r: 0, g: 255, b: 0 },
        { name: '纯蓝', r: 0, g: 0, b: 255 },
        { name: '黄色', r: 255, g: 255, b: 0 },
        { name: '白色', r: 255, g: 255, b: 255 }
    ];
    
    testColors.forEach(color => {
        const gray = Math.round(0.299 * color.r + 0.587 * color.g + 0.114 * color.b);
        console.log(`  ${color.name}: RGB(${color.r}, ${color.g}, ${color.b}) → 灰度值: ${gray}`);
    });
}

/**
 * 演示 5：图像的矩阵表示
 * 
 * 原理解释：
 * - 图像在计算机中以矩阵形式存储
 * - 灰度图：二维矩阵
 * - 彩色图：三维矩阵（或展开为一维数组）
 */
function demonstrateMatrix() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 演示 5：图像的矩阵表示');
    console.log('='.repeat(60));
    
    // 创建一个 3x3 的灰度图像示例
    const grayImage = [
        [50, 100, 150],
        [75, 125, 175],
        [100, 150, 200]
    ];
    
    console.log('\n【灰度图的二维矩阵表示】\n');
    console.log('一个 3×3 的灰度图像：\n');
    console.log('JavaScript 代码：');
    console.log('const grayImage = [');
    grayImage.forEach((row, i) => {
        console.log(`    [${row.map(v => String(v).padStart(3)).join(', ')}]${i < 2 ? ',' : ''}`);
    });
    console.log('];');
    
    console.log('\n可视化（数值越大越亮）：');
    console.log('┌─────┬─────┬─────┐');
    grayImage.forEach((row, i) => {
        const visualRow = row.map(v => String(v).padStart(3)).join(' │ ');
        console.log(`│ ${visualRow} │`);
        if (i < 2) console.log('├─────┼─────┼─────┤');
    });
    console.log('└─────┴─────┴─────┘');
    
    // 创建一个 2x2 的 RGB 图像示例
    console.log('\n【RGB图的一维数组表示（ImageData格式）】\n');
    
    const rgbPixels = [
        { r: 255, g: 0, b: 0, a: 255 },     // 红色
        { r: 0, g: 255, b: 0, a: 255 },     // 绿色
        { r: 0, g: 0, b: 255, a: 255 },     // 蓝色
        { r: 255, g: 255, b: 0, a: 255 }    // 黄色
    ];
    
    console.log('一个 2×2 的 RGBA 图像：');
    console.log('┌─────────────┬─────────────┐');
    console.log('│   红色      │   绿色      │');
    console.log('├─────────────┼─────────────┤');
    console.log('│   蓝色      │   黄色      │');
    console.log('└─────────────┴─────────────┘\n');
    
    console.log('在 Canvas 的 ImageData.data 中的存储方式：');
    console.log('（一个一维的 Uint8ClampedArray）\n');
    
    // 展开为一维数组
    const flatArray = [];
    rgbPixels.forEach((pixel, i) => {
        flatArray.push(pixel.r, pixel.g, pixel.b, pixel.a);
    });
    
    console.log('索引:  ' + flatArray.map((_, i) => String(i).padStart(3)).join(' '));
    console.log('值  :  ' + flatArray.map(v => String(v).padStart(3)).join(' '));
    console.log('通道:  ' + rgbPixels.flatMap(() => ['  R', '  G', '  B', '  A']).join(' '));
    console.log('像素:  ' + '  ←─── 像素0 ───→    ←─── 像素1 ───→    ←─── 像素2 ───→    ←─── 像素3 ───→');
}

/**
 * 演示 6：像素索引计算
 * 
 * 原理解释：
 * - 在一维数组中定位特定像素
 * - 这是图像处理的核心操作之一
 */
function demonstratePixelAccess() {
    console.log('\n' + '='.repeat(60));
    console.log('🔢 演示 6：像素索引计算');
    console.log('='.repeat(60));
    
    console.log(`
【核心问题】
图像以一维数组存储，如何访问特定位置的像素？

【二维坐标到一维索引的转换】

对于一个宽度为 width 的图像：
位置 (x, y) 的像素索引 = y × width + x

对于 RGBA 格式（每像素4字节）：
位置 (x, y) 的 R 值索引 = (y × width + x) × 4 + 0
位置 (x, y) 的 G 值索引 = (y × width + x) × 4 + 1
位置 (x, y) 的 B 值索引 = (y × width + x) × 4 + 2
位置 (x, y) 的 A 值索引 = (y × width + x) × 4 + 3
`);
    
    // 实际计算示例
    const width = 4;
    const height = 3;
    
    console.log(`【示例：${width}×${height} 图像的像素索引】\n`);
    console.log('像素坐标网格：');
    console.log('     x=0   x=1   x=2   x=3');
    
    for (let y = 0; y < height; y++) {
        let row = `y=${y}  `;
        for (let x = 0; x < width; x++) {
            const pixelIndex = y * width + x;
            const rgbaIndex = pixelIndex * 4;
            row += `[${String(pixelIndex).padStart(2)}]   `;
        }
        console.log(row);
    }
    
    console.log('\n像素索引 → RGBA数组索引：');
    console.log('像素0 的 RGBA 在数组索引 [0, 1, 2, 3]');
    console.log('像素5 的 RGBA 在数组索引 [20, 21, 22, 23]');
    console.log('像素11 的 RGBA 在数组索引 [44, 45, 46, 47]');
}

/**
 * 演示 7：位深度（Bit Depth）
 * 
 * 原理解释：
 * - 位深度决定每个通道能表示的颜色级别
 * - 位深度越高，颜色越细腻，文件越大
 */
function demonstrateBitDepth() {
    console.log('\n' + '='.repeat(60));
    console.log('💾 演示 7：位深度（Bit Depth）');
    console.log('='.repeat(60));
    
    console.log(`
【什么是位深度？】
位深度表示每个像素（或通道）使用多少位（bit）来存储颜色信息。

【常见位深度】

┌──────────┬────────────┬─────────────────────────────┐
│ 位深度   │ 颜色级别   │ 说明                        │
├──────────┼────────────┼─────────────────────────────┤
│ 1-bit    │ 2          │ 黑白（二值图像）            │
│ 8-bit    │ 256        │ 灰度图 / 每个 RGB 通道      │
│ 24-bit   │ 16,777,216 │ 真彩色（8位 × 3通道）       │
│ 32-bit   │ + Alpha    │ 带透明度（8位 × 4通道）     │
└──────────┴────────────┴─────────────────────────────┘

【计算颜色数量】
颜色数量 = 2^位深度

1-bit:  2^1  = 2 种颜色
8-bit:  2^8  = 256 种颜色
24-bit: 2^24 = 16,777,216 种颜色

【对 OCR 的影响】
- OCR 通常将图像转为二值图（1-bit）
- 文字变成纯黑，背景变成纯白
- 这大大简化了后续处理
`);
}

// ==================== 工具函数 ====================

/**
 * 将 RGB 值转换为十六进制颜色代码
 * 
 * 原理解释：
 * - 十六进制颜色格式：#RRGGBB
 * - 每个通道用两位十六进制数表示（00-FF）
 * 
 * @param {number} r - 红色通道值 (0-255)
 * @param {number} g - 绿色通道值 (0-255)
 * @param {number} b - 蓝色通道值 (0-255)
 * @returns {string} 十六进制颜色代码
 */
function rgbToHex(r, g, b) {
    // 将每个通道转为两位十六进制
    const toHex = (value) => {
        const hex = value.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * 将 RGB 转换为灰度值
 * 
 * 原理解释：
 * - 使用标准加权公式
 * - 权重基于人眼对不同颜色的敏感度
 * 
 * @param {number} r - 红色通道值 (0-255)
 * @param {number} g - 绿色通道值 (0-255)
 * @param {number} b - 蓝色通道值 (0-255)
 * @returns {number} 灰度值 (0-255)
 */
function rgbToGray(r, g, b) {
    // 标准加权公式（ITU-R BT.601）
    // 人眼对绿色最敏感，所以绿色权重最大
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * 创建一个模拟的图像数据结构
 * 
 * 原理解释：
 * - 模拟 Canvas ImageData 的结构
 * - 用于理解图像数据的存储方式
 * 
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {object} 模拟的 ImageData 对象
 */
function createImageData(width, height) {
    // 每个像素 4 个值（RGBA）
    const data = new Uint8ClampedArray(width * height * 4);
    
    // 默认填充白色，完全不透明
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;     // R
        data[i + 1] = 255; // G
        data[i + 2] = 255; // B
        data[i + 3] = 255; // A
    }
    
    return {
        width,
        height,
        data,
        
        // 辅助方法：获取指定位置的像素
        getPixel(x, y) {
            const index = (y * width + x) * 4;
            return {
                r: this.data[index],
                g: this.data[index + 1],
                b: this.data[index + 2],
                a: this.data[index + 3]
            };
        },
        
        // 辅助方法：设置指定位置的像素
        setPixel(x, y, r, g, b, a = 255) {
            const index = (y * width + x) * 4;
            this.data[index] = r;
            this.data[index + 1] = g;
            this.data[index + 2] = b;
            this.data[index + 3] = a;
        }
    };
}

/**
 * 演示模拟的 ImageData 使用
 */
function demonstrateImageData() {
    console.log('\n' + '='.repeat(60));
    console.log('🖼️ 演示 8：模拟 ImageData 操作');
    console.log('='.repeat(60));
    
    // 创建一个 3x3 的模拟图像
    const img = createImageData(3, 3);
    
    console.log('\n创建一个 3×3 的图像并设置像素：\n');
    
    // 设置一些像素
    img.setPixel(0, 0, 255, 0, 0);     // 左上角：红色
    img.setPixel(1, 0, 0, 255, 0);     // 上中：绿色
    img.setPixel(2, 0, 0, 0, 255);     // 右上角：蓝色
    img.setPixel(0, 1, 255, 255, 0);   // 左中：黄色
    img.setPixel(1, 1, 128, 128, 128); // 中心：灰色
    img.setPixel(2, 1, 0, 255, 255);   // 右中：青色
    img.setPixel(0, 2, 255, 0, 255);   // 左下角：品红
    img.setPixel(1, 2, 0, 0, 0);       // 下中：黑色
    img.setPixel(2, 2, 255, 255, 255); // 右下角：白色
    
    // 显示图像数据
    console.log('图像布局：');
    console.log('┌───────┬───────┬───────┐');
    console.log('│  红   │  绿   │  蓝   │');
    console.log('├───────┼───────┼───────┤');
    console.log('│  黄   │  灰   │  青   │');
    console.log('├───────┼───────┼───────┤');
    console.log('│ 品红  │  黑   │  白   │');
    console.log('└───────┴───────┴───────┘');
    
    console.log('\n读取每个像素的 RGB 值：\n');
    
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const pixel = img.getPixel(x, y);
            console.log(`  位置(${x}, ${y}): RGB(${String(pixel.r).padStart(3)}, ${String(pixel.g).padStart(3)}, ${String(pixel.b).padStart(3)})`);
        }
    }
    
    console.log('\n完整的 data 数组（前36个值，共9个像素）：');
    console.log('[' + Array.from(img.data.slice(0, 36)).join(', ') + ']');
}

// ==================== 主程序 ====================

/**
 * 主函数：运行所有演示
 */
function main() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           01. 数字图像基础 (Digital Image Fundamentals)    ║');
    console.log('║                   OCR 学习项目 - 第一章                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    // 运行所有演示
    demonstratePixel();
    demonstrateResolution();
    demonstrateRGB();
    demonstrateGrayscale();
    demonstrateMatrix();
    demonstratePixelAccess();
    demonstrateBitDepth();
    demonstrateImageData();
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📚 本章总结');
    console.log('='.repeat(60));
    console.log(`
【核心知识点回顾】

1. 像素（Pixel）是图像的最小单位
2. 分辨率 = 宽度 × 高度（像素数）
3. RGB 色彩空间：每个像素由 R、G、B 三个通道组成
4. 每个通道取值 0-255（8位）
5. 图像以矩阵形式存储在内存中
6. Canvas 使用一维数组存储 RGBA 数据

【与 OCR 的关联】

这些基础知识是 OCR 开发的根基：
- 后续的灰度化操作需要理解 RGB 通道
- 二值化需要理解灰度值的范围
- 所有图像处理都是对像素矩阵的数学运算

【下一步学习】

继续学习 02. JavaScript 图像处理基础，
学习如何使用 Canvas API 在浏览器中操作图像数据。
`);
}

// 运行主程序
main();
