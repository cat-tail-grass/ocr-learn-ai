/**
 * 09. 连通域分析 (Connected Component Analysis) - Node.js 示例
 * 
 * 本文件演示连通域分析的核心算法实现：
 * 1. Two-Pass 标记算法
 * 2. 并查集（Union-Find）数据结构
 * 3. 区域属性提取
 * 4. 区域筛选与可视化
 * 
 * 前置知识：
 * - 04. 二值化（连通域分析的输入是二值图像）
 * - 08. 边缘检测（边缘信息辅助）
 * 
 * 运行方式：node index.js
 */

// 引入共享工具函数
const {
    MockImageData,
    getPixel,
    setPixel,
    createImageData,
    cloneImageData,
    clamp
} = require('../shared');

// ==================== 并查集（Union-Find）====================

/**
 * 并查集数据结构
 * 
 * 原理说明：
 * - 用于管理不相交集合（等价类）
 * - 支持两个操作：Find（查找根）和 Union（合并集合）
 * - 使用路径压缩和按秩合并优化，接近 O(1) 的时间复杂度
 * 
 * @class
 */
class UnionFind {
    /**
     * 创建并查集
     * @param {number} size - 元素数量
     */
    constructor(size) {
        // 每个元素的父节点，初始时自己是自己的父节点
        this.parent = Array.from({ length: size }, (_, i) => i);
        // 每个集合的秩（树的高度估计），用于按秩合并
        this.rank = new Array(size).fill(0);
    }
    
    /**
     * 查找元素所属集合的根（代表元素）
     * 
     * 原理说明：
     * - 沿着 parent 链向上找到根
     * - 路径压缩：将路径上所有节点直接连接到根
     * 
     * @param {number} x - 要查找的元素
     * @returns {number} 元素所属集合的根
     */
    find(x) {
        if (this.parent[x] !== x) {
            // 路径压缩：递归查找的同时直接连接到根
            this.parent[x] = this.find(this.parent[x]);
        }
        return this.parent[x];
    }
    
    /**
     * 合并两个元素所属的集合
     * 
     * 原理说明：
     * - 找到两个元素的根
     * - 如果不同，将秩较小的树连接到秩较大的树
     * - 按秩合并可以保持树的平衡
     * 
     * @param {number} x - 第一个元素
     * @param {number} y - 第二个元素
     */
    union(x, y) {
        const rootX = this.find(x);
        const rootY = this.find(y);
        
        if (rootX !== rootY) {
            // 按秩合并：将较矮的树连接到较高的树
            if (this.rank[rootX] < this.rank[rootY]) {
                this.parent[rootX] = rootY;
            } else if (this.rank[rootX] > this.rank[rootY]) {
                this.parent[rootY] = rootX;
            } else {
                // 秩相同时，任选一个作为根，并增加其秩
                this.parent[rootY] = rootX;
                this.rank[rootX]++;
            }
        }
    }
    
    /**
     * 检查两个元素是否在同一集合
     * 
     * @param {number} x - 第一个元素
     * @param {number} y - 第二个元素
     * @returns {boolean} 是否在同一集合
     */
    connected(x, y) {
        return this.find(x) === this.find(y);
    }
}

// ==================== 连通域标记算法 ====================

/**
 * Two-Pass 连通域标记算法
 * 
 * 原理说明：
 * - Pass 1：从左到右、从上到下扫描，初始标记
 *   - 检查已扫描的邻居（左、上、左上、右上）
 *   - 无邻居则分配新标签
 *   - 有邻居则取最小标签，并记录等价关系
 * - Pass 2：使用并查集解析等价关系，统一标签
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number} connectivity - 连通性：4 或 8（默认 8）
 * @param {number} foregroundValue - 前景像素值判断阈值（默认 < 128 为前景）
 * @returns {{labels: Int32Array, numLabels: number, width: number, height: number}} 标记结果
 */
function labelConnectedComponents(imageData, connectivity = 8, foregroundValue = 128) {
    const { width, height } = imageData;
    const labels = new Int32Array(width * height);
    
    // 初始化并查集，预留足够空间
    const maxLabels = width * height;
    const uf = new UnionFind(maxLabels);
    
    let nextLabel = 1; // 从 1 开始标记（0 表示背景）
    
    console.log(`\n=== Two-Pass 连通域标记 (${connectivity}连通) ===`);
    console.log(`图像尺寸: ${width}×${height}`);
    
    // ========== Pass 1: 初始标记 ==========
    console.log('\n[Pass 1] 初始标记...');
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pixel = getPixel(imageData, x, y);
            
            // 检查是否为前景像素
            if (pixel.r >= foregroundValue) {
                labels[idx] = 0; // 背景
                continue;
            }
            
            // 收集邻居的标签
            const neighborLabels = [];
            
            // 左邻居
            if (x > 0 && labels[idx - 1] > 0) {
                neighborLabels.push(labels[idx - 1]);
            }
            
            // 上邻居
            if (y > 0 && labels[idx - width] > 0) {
                neighborLabels.push(labels[idx - width]);
            }
            
            // 8 连通额外检查对角线
            if (connectivity === 8) {
                // 左上邻居
                if (x > 0 && y > 0 && labels[idx - width - 1] > 0) {
                    neighborLabels.push(labels[idx - width - 1]);
                }
                // 右上邻居
                if (x < width - 1 && y > 0 && labels[idx - width + 1] > 0) {
                    neighborLabels.push(labels[idx - width + 1]);
                }
            }
            
            if (neighborLabels.length === 0) {
                // 情况1：无标记邻居，分配新标签
                labels[idx] = nextLabel;
                nextLabel++;
            } else {
                // 情况2/3：有标记邻居，取最小标签
                const minLabel = Math.min(...neighborLabels);
                labels[idx] = minLabel;
                
                // 如果有多个不同标签，记录等价关系
                for (const label of neighborLabels) {
                    if (label !== minLabel) {
                        uf.union(minLabel, label);
                    }
                }
            }
        }
    }
    
    console.log(`初始标签数: ${nextLabel - 1}`);
    
    // ========== Pass 2: 合并等价标签 ==========
    console.log('\n[Pass 2] 合并等价标签...');
    
    // 建立从旧标签到新标签的映射
    const labelMap = new Map();
    let finalLabelCount = 0;
    
    for (let i = 0; i < labels.length; i++) {
        if (labels[i] > 0) {
            const root = uf.find(labels[i]);
            
            if (!labelMap.has(root)) {
                finalLabelCount++;
                labelMap.set(root, finalLabelCount);
            }
            
            labels[i] = labelMap.get(root);
        }
    }
    
    console.log(`最终区域数: ${finalLabelCount}`);
    
    return {
        labels,
        numLabels: finalLabelCount,
        width,
        height
    };
}

// ==================== 区域属性提取 ====================

/**
 * 提取所有区域的属性
 * 
 * 原理说明：
 * - 遍历标记图像，统计每个区域的像素
 * - 计算面积、边界框、质心等属性
 * 
 * @param {Int32Array} labels - 标记数组
 * @param {number} numLabels - 区域数量
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {object[]} 区域属性数组
 */
function extractRegionProperties(labels, numLabels, width, height) {
    // 初始化每个区域的统计数据
    const regions = [];
    for (let i = 0; i <= numLabels; i++) {
        regions.push({
            label: i,
            area: 0,
            pixels: [],
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
            sumX: 0,
            sumY: 0
        });
    }
    
    // 遍历所有像素，统计区域信息
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const label = labels[idx];
            
            if (label > 0) {
                const region = regions[label];
                region.area++;
                region.pixels.push({ x, y });
                region.minX = Math.min(region.minX, x);
                region.maxX = Math.max(region.maxX, x);
                region.minY = Math.min(region.minY, y);
                region.maxY = Math.max(region.maxY, y);
                region.sumX += x;
                region.sumY += y;
            }
        }
    }
    
    // 计算派生属性
    const result = [];
    for (let i = 1; i <= numLabels; i++) {
        const region = regions[i];
        
        if (region.area > 0) {
            // 边界框
            const bboxWidth = region.maxX - region.minX + 1;
            const bboxHeight = region.maxY - region.minY + 1;
            
            // 质心
            const centroidX = region.sumX / region.area;
            const centroidY = region.sumY / region.area;
            
            // 填充率
            const fillRatio = region.area / (bboxWidth * bboxHeight);
            
            // 宽高比
            const aspectRatio = bboxWidth / bboxHeight;
            
            result.push({
                label: region.label,
                area: region.area,
                boundingBox: {
                    x: region.minX,
                    y: region.minY,
                    width: bboxWidth,
                    height: bboxHeight
                },
                centroid: {
                    x: centroidX,
                    y: centroidY
                },
                fillRatio,
                aspectRatio,
                pixels: region.pixels
            });
        }
    }
    
    return result;
}

/**
 * 按条件过滤区域
 * 
 * @param {object[]} regions - 区域属性数组
 * @param {object} options - 过滤选项
 * @param {number} options.minArea - 最小面积
 * @param {number} options.maxArea - 最大面积
 * @param {number} options.minAspectRatio - 最小宽高比
 * @param {number} options.maxAspectRatio - 最大宽高比
 * @param {number} options.minFillRatio - 最小填充率
 * @returns {object[]} 过滤后的区域
 */
function filterRegions(regions, options = {}) {
    const {
        minArea = 0,
        maxArea = Infinity,
        minAspectRatio = 0,
        maxAspectRatio = Infinity,
        minFillRatio = 0
    } = options;
    
    return regions.filter(region => {
        if (region.area < minArea || region.area > maxArea) return false;
        if (region.aspectRatio < minAspectRatio || region.aspectRatio > maxAspectRatio) return false;
        if (region.fillRatio < minFillRatio) return false;
        return true;
    });
}

// ==================== 可视化函数 ====================

/**
 * 为连通域标记结果着色
 * 
 * @param {Int32Array} labels - 标记数组
 * @param {number} numLabels - 区域数量
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {MockImageData} 彩色可视化图像
 */
function colorizeLabels(labels, numLabels, width, height) {
    const result = createImageData(width, height, 255, 255, 255);
    
    // 生成随机颜色（确保颜色足够区分）
    const colors = generateDistinctColors(numLabels);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const label = labels[idx];
            
            if (label > 0 && label <= numLabels) {
                const color = colors[label - 1];
                setPixel(result, x, y, color.r, color.g, color.b);
            }
        }
    }
    
    return result;
}

/**
 * 生成视觉上容易区分的颜色
 * 
 * @param {number} n - 需要的颜色数量
 * @returns {{r: number, g: number, b: number}[]} 颜色数组
 */
function generateDistinctColors(n) {
    const colors = [];
    
    for (let i = 0; i < n; i++) {
        // 使用黄金角度在色轮上均匀分布
        const hue = (i * 137.508) % 360;
        const saturation = 0.7 + (i % 3) * 0.1;
        const value = 0.8 + (i % 2) * 0.1;
        
        const rgb = hsvToRgb(hue, saturation, value);
        colors.push(rgb);
    }
    
    return colors;
}

/**
 * HSV 转 RGB
 */
function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    
    switch (i) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/**
 * 提取单个区域的掩码
 * 
 * @param {Int32Array} labels - 标记数组
 * @param {number} labelId - 要提取的区域标签
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {MockImageData} 区域掩码（白色为区域，黑色为背景）
 */
function extractRegionMask(labels, labelId, width, height) {
    const result = createImageData(width, height, 0, 0, 0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (labels[idx] === labelId) {
                setPixel(result, x, y, 255, 255, 255);
            }
        }
    }
    
    return result;
}

// ==================== 测试代码 ====================

/**
 * 创建测试用的二值图像
 * 
 * 创建包含多个分离形状的测试图像
 */
function createTestImage() {
    const width = 20;
    const height = 15;
    const testImage = createImageData(width, height, 255, 255, 255); // 白色背景
    
    // 绘制几个分离的形状（黑色前景）
    
    // 形状 1：左上角的矩形
    for (let y = 1; y < 4; y++) {
        for (let x = 1; x < 5; x++) {
            setPixel(testImage, x, y, 0, 0, 0);
        }
    }
    
    // 形状 2：右上角的 L 形
    for (let y = 1; y < 4; y++) {
        setPixel(testImage, 15, y, 0, 0, 0);
    }
    for (let x = 15; x < 19; x++) {
        setPixel(testImage, x, 3, 0, 0, 0);
    }
    
    // 形状 3：中间的点
    setPixel(testImage, 10, 7, 0, 0, 0);
    
    // 形状 4：底部的对角线（测试 8 连通）
    for (let i = 0; i < 5; i++) {
        setPixel(testImage, 2 + i, 10 + i % 2, 0, 0, 0);
    }
    
    // 形状 5：右下角的正方形
    for (let y = 11; y < 14; y++) {
        for (let x = 15; x < 18; x++) {
            setPixel(testImage, x, y, 0, 0, 0);
        }
    }
    
    return testImage;
}

/**
 * 打印图像的简化表示
 */
function printImage(imageData, title) {
    console.log(`\n${title}:`);
    const { width, height } = imageData;
    
    let output = '';
    for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) {
            const pixel = getPixel(imageData, x, y);
            if (pixel.r < 128) {
                row += '██';
            } else {
                row += '  ';
            }
        }
        output += row + '\n';
    }
    console.log(output);
}

/**
 * 打印标记结果
 */
function printLabels(labels, width, height, title) {
    console.log(`\n${title}:`);
    
    let output = '';
    for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const label = labels[idx];
            if (label === 0) {
                row += ' . ';
            } else {
                row += ` ${label} `;
            }
        }
        output += row + '\n';
    }
    console.log(output);
}

/**
 * 打印区域属性
 */
function printRegionProperties(regions) {
    console.log('\n区域属性统计:');
    console.log('┌───────┬──────┬─────────────────────────┬──────────────┬──────────┬──────────┐');
    console.log('│ Label │ Area │ BoundingBox             │ Centroid     │ FillRate │ AspRatio │');
    console.log('├───────┼──────┼─────────────────────────┼──────────────┼──────────┼──────────┤');
    
    for (const region of regions) {
        const bbox = `(${region.boundingBox.x},${region.boundingBox.y},${region.boundingBox.width}×${region.boundingBox.height})`;
        const centroid = `(${region.centroid.x.toFixed(1)},${region.centroid.y.toFixed(1)})`;
        console.log(`│ ${String(region.label).padStart(5)} │ ${String(region.area).padStart(4)} │ ${bbox.padEnd(23)} │ ${centroid.padEnd(12)} │ ${region.fillRatio.toFixed(2).padStart(8)} │ ${region.aspectRatio.toFixed(2).padStart(8)} │`);
    }
    
    console.log('└───────┴──────┴─────────────────────────┴──────────────┴──────────┴──────────┘');
}

// ==================== 主程序 ====================

function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║      09. 连通域分析 (Connected Component Analysis)          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    // 创建测试图像
    console.log('\n>>> 创建测试图像');
    const testImage = createTestImage();
    printImage(testImage, '原始二值图像（黑色=前景）');
    
    // 测试 8 连通标记
    console.log('\n' + '='.repeat(60));
    console.log('>>> 测试 8 连通标记');
    console.log('='.repeat(60));
    
    const result8 = labelConnectedComponents(testImage, 8);
    printLabels(result8.labels, result8.width, result8.height, '8 连通标记结果');
    
    // 提取区域属性
    const regions8 = extractRegionProperties(
        result8.labels, 
        result8.numLabels, 
        result8.width, 
        result8.height
    );
    printRegionProperties(regions8);
    
    // 测试 4 连通标记
    console.log('\n' + '='.repeat(60));
    console.log('>>> 测试 4 连通标记');
    console.log('='.repeat(60));
    
    const result4 = labelConnectedComponents(testImage, 4);
    printLabels(result4.labels, result4.width, result4.height, '4 连通标记结果');
    
    const regions4 = extractRegionProperties(
        result4.labels, 
        result4.numLabels, 
        result4.width, 
        result4.height
    );
    console.log(`\n4 连通检测到 ${regions4.length} 个区域（对角线像素被分割）`);
    console.log(`8 连通检测到 ${regions8.length} 个区域（对角线像素相连）`);
    
    // 区域过滤示例
    console.log('\n' + '='.repeat(60));
    console.log('>>> 区域过滤示例');
    console.log('='.repeat(60));
    
    const filteredRegions = filterRegions(regions8, {
        minArea: 5,  // 过滤掉面积小于 5 的区域
        maxArea: 100,
        minFillRatio: 0.3
    });
    
    console.log(`\n过滤条件: minArea=5, maxArea=100, minFillRatio=0.3`);
    console.log(`过滤前: ${regions8.length} 个区域`);
    console.log(`过滤后: ${filteredRegions.length} 个区域`);
    
    if (filteredRegions.length > 0) {
        printRegionProperties(filteredRegions);
    }
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('>>> 在 OCR 中的应用');
    console.log('='.repeat(60));
    
    console.log(`
连通域分析用于：
1. 字符分割：每个字符通常是一个独立的连通域
2. 噪点去除：过滤掉面积过小的区域
3. 非文字过滤：根据宽高比、填充率筛选文字区域
4. 文字行检测：根据质心位置对字符分组

推荐流程：
灰度化 → 二值化 → 形态学处理 → 连通域分析 → 属性筛选 → 字符提取
`);
    
    console.log('\n✅ 连通域分析示例完成！');
    console.log('提示：运行 index.html 可以看到更直观的可视化效果。');
}

// 运行主程序
main();

// 导出函数供其他模块使用
module.exports = {
    UnionFind,
    labelConnectedComponents,
    extractRegionProperties,
    filterRegions,
    colorizeLabels,
    generateDistinctColors,
    extractRegionMask
};
