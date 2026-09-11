/**
 * 连通域分析模块
 * 
 * 提供连通域标记、区域属性提取等功能
 * 
 * 来源：09. 连通域分析
 */

const { createImageData } = require('../core/imageData');
const { getPixel, setPixel } = require('../core/pixelAccess');

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
        this.parent = Array.from({ length: size }, (_, i) => i);
        this.rank = new Array(size).fill(0);
    }
    
    /**
     * 查找元素所属集合的根（代表元素）
     * 使用路径压缩优化
     * 
     * @param {number} x - 要查找的元素
     * @returns {number} 元素所属集合的根
     */
    find(x) {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]);
        }
        return this.parent[x];
    }
    
    /**
     * 合并两个元素所属的集合
     * 使用按秩合并优化
     * 
     * @param {number} x - 第一个元素
     * @param {number} y - 第二个元素
     */
    union(x, y) {
        const rootX = this.find(x);
        const rootY = this.find(y);
        
        if (rootX !== rootY) {
            if (this.rank[rootX] < this.rank[rootY]) {
                this.parent[rootX] = rootY;
            } else if (this.rank[rootX] > this.rank[rootY]) {
                this.parent[rootY] = rootX;
            } else {
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
 * - Pass 1：从左到右、从上到下扫描，初始标记并记录等价关系
 * - Pass 2：使用并查集解析等价关系，统一标签
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number} connectivity - 连通性：4 或 8（默认 8）
 * @param {number} foregroundThreshold - 前景像素值判断阈值（默认 < 128 为前景）
 * @returns {{labels: Int32Array, numLabels: number, width: number, height: number}} 标记结果
 */
function labelConnectedComponents(imageData, connectivity = 8, foregroundThreshold = 128) {
    const { width, height } = imageData;
    const labels = new Int32Array(width * height);
    if (connectivity !== 4 && connectivity !== 8) throw new RangeError('connectivity须为4或8');
    const maxLabels = width * height + 1; // 0保留给背景，前景标签从1开始
    const uf = new UnionFind(maxLabels);
    let nextLabel = 1;
    
    // Pass 1: 初始标记
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pixel = getPixel(imageData, x, y);
            
            // 检查是否为前景像素
            if (pixel.r >= foregroundThreshold) {
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
                labels[idx] = nextLabel++;
            } else {
                const minLabel = Math.min(...neighborLabels);
                labels[idx] = minLabel;
                
                for (const label of neighborLabels) {
                    if (label !== minLabel) {
                        uf.union(minLabel, label);
                    }
                }
            }
        }
    }
    
    // Pass 2: 合并等价标签
    const labelMap = new Map();
    let finalLabelCount = 0;
    
    for (let i = 0; i < labels.length; i++) {
        if (labels[i] > 0) {
            const root = uf.find(labels[i]);
            
            if (!labelMap.has(root)) {
                labelMap.set(root, ++finalLabelCount);
            }
            
            labels[i] = labelMap.get(root);
        }
    }
    
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
            const bboxWidth = region.maxX - region.minX + 1;
            const bboxHeight = region.maxY - region.minY + 1;
            const centroidX = region.sumX / region.area;
            const centroidY = region.sumY / region.area;
            const fillRatio = region.area / (bboxWidth * bboxHeight);
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
                centroid: { x: centroidX, y: centroidY },
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
 * 生成视觉上容易区分的颜色
 * 
 * @param {number} n - 需要的颜色数量
 * @returns {{r: number, g: number, b: number}[]} 颜色数组
 */
function generateDistinctColors(n) {
    const colors = [];
    
    for (let i = 0; i < n; i++) {
        const hue = (i * 137.508) % 360;
        const saturation = 0.7 + (i % 3) * 0.1;
        const value = 0.8 + (i % 2) * 0.1;
        colors.push(hsvToRgb(hue, saturation, value));
    }
    
    return colors;
}

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

/**
 * 获取区域边界框内的图像
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像
 * @param {object} boundingBox - 边界框 {x, y, width, height}
 * @returns {MockImageData} 裁剪后的图像
 */
function extractRegionImage(imageData, boundingBox) {
    const { x, y, width: bw, height: bh } = boundingBox;
    const result = createImageData(bw, bh, 255, 255, 255);
    
    for (let dy = 0; dy < bh; dy++) {
        for (let dx = 0; dx < bw; dx++) {
            const pixel = getPixel(imageData, x + dx, y + dy);
            setPixel(result, dx, dy, pixel.r, pixel.g, pixel.b, pixel.a);
        }
    }
    
    return result;
}

// ==================== 导出模块 ====================

module.exports = {
    // 并查集
    UnionFind,
    
    // 连通域标记
    labelConnectedComponents,
    
    // 区域属性
    extractRegionProperties,
    filterRegions,
    
    // 可视化
    generateDistinctColors,
    colorizeLabels,
    extractRegionMask,
    extractRegionImage
};
