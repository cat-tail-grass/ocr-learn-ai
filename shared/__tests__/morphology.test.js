/**
 * 形态学操作模块单元测试
 * 
 * 测试内容：
 * - 结构元素创建
 * - 腐蚀和膨胀
 * - 开运算和闭运算
 * - 形态学梯度、顶帽和黑帽变换
 */

const { MockImageData, setPixel, getPixel, createImageData } = require('../core');
const {
    createStructuringElement,
    erode,
    dilate,
    morphOpen,
    morphClose,
    morphGradient,
    topHat,
    blackHat
} = require('../06-morphology');

// ==================== 辅助函数 ====================

/**
 * 创建二值图像（白色前景、黑色背景）
 */
function createBinaryImage(pattern) {
    const height = pattern.length;
    const width = pattern[0].length;
    const img = createImageData(width, height, 0, 0, 0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (pattern[y][x] === 1) {
                setPixel(img, x, y, 255, 255, 255);
            }
        }
    }
    
    return img;
}

// ==================== 结构元素测试 ====================

describe('结构元素创建', () => {
    test('createStructuringElement rect', () => {
        const se = createStructuringElement('rect', 3);
        
        expect(se.length).toBe(3);
        expect(se[0].length).toBe(3);
        
        // 所有位置都是1
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                expect(se[y][x]).toBe(1);
            }
        }
    });
    
    test('createStructuringElement cross', () => {
        const se = createStructuringElement('cross', 3);
        
        // 十字形状
        expect(se[0][0]).toBe(0);
        expect(se[0][1]).toBe(1); // 中心列
        expect(se[0][2]).toBe(0);
        expect(se[1][0]).toBe(1); // 中心行
        expect(se[1][1]).toBe(1); // 中心
        expect(se[1][2]).toBe(1); // 中心行
        expect(se[2][0]).toBe(0);
        expect(se[2][1]).toBe(1); // 中心列
        expect(se[2][2]).toBe(0);
    });
    
    test('createStructuringElement ellipse', () => {
        const se = createStructuringElement('ellipse', 3);
        
        // 椭圆应该包含中心
        expect(se[1][1]).toBe(1);
        
        // 角落可能是0或1，取决于具体实现
    });
    
    test('createStructuringElement 偶数变奇数', () => {
        const se = createStructuringElement('rect', 4);
        
        expect(se.length).toBe(5);
    });
});

// ==================== 腐蚀测试 ====================

describe('腐蚀操作', () => {
    test('erode 缩小前景', () => {
        // 创建 5x5 的白色方块
        const pattern = [
            [0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 1, 1, 1, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0]
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = erode(img, se);
        
        // 边缘应该被腐蚀掉，只剩中心
        expect(getPixel(result, 2, 2).r).toBe(255); // 中心保留
        expect(getPixel(result, 1, 1).r).toBe(0);   // 边缘被腐蚀
        expect(getPixel(result, 3, 3).r).toBe(0);   // 边缘被腐蚀
    });
    
    test('erode 去除小噪点', () => {
        // 创建单个像素的噪点
        const pattern = [
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0]
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = erode(img, se);
        
        // 噪点应该被完全去除
        expect(getPixel(result, 1, 1).r).toBe(0);
    });
});

// ==================== 膨胀测试 ====================

describe('膨胀操作', () => {
    test('dilate 扩大前景', () => {
        // 创建单个像素
        const pattern = [
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0]
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = dilate(img, se);
        
        // 周围应该都变成白色
        expect(getPixel(result, 0, 0).r).toBe(255);
        expect(getPixel(result, 1, 1).r).toBe(255);
        expect(getPixel(result, 2, 2).r).toBe(255);
    });
    
    test('dilate 填补空洞', () => {
        // 创建有空洞的形状
        const pattern = [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1]
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = dilate(img, se);
        
        // 中心空洞应该被填补
        expect(getPixel(result, 1, 1).r).toBe(255);
    });
});

// ==================== 开运算和闭运算测试 ====================

describe('开运算和闭运算', () => {
    test('morphOpen 去除噪点', () => {
        // 大方块 + 小噪点
        const pattern = [
            [0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 1]  // 右下角噪点
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = morphOpen(img, se);
        
        // 噪点应该被去除
        expect(getPixel(result, 6, 6).r).toBe(0);
        
        // 大方块的中心应该保留
        expect(getPixel(result, 3, 3).r).toBe(255);
    });
    
    test('morphClose 填补空洞', () => {
        // 有小空洞的方块
        const pattern = [
            [0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 0, 1, 1, 0],  // 中心有空洞
            [0, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0]
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = morphClose(img, se);
        
        // 空洞应该被填补
        expect(getPixel(result, 3, 3).r).toBe(255);
    });
});

// ==================== 形态学梯度测试 ====================

describe('形态学梯度', () => {
    test('morphGradient 提取边缘', () => {
        // 创建实心方块
        const pattern = [
            [0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 1, 1, 1, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0]
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = morphGradient(img, se);
        
        // 边缘应该被提取出来
        // 外部边缘（膨胀 - 原图的部分）应该有值
        // 内部边缘（原图 - 腐蚀的部分）应该有值
        // 中心应该是0（因为膨胀和腐蚀的中心都是白色）
        expect(getPixel(result, 2, 2).r).toBe(0);
    });
});

// ==================== 顶帽和黑帽测试 ====================

describe('顶帽和黑帽变换', () => {
    test('topHat 提取亮点', () => {
        // 暗背景上的亮点
        const pattern = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = topHat(img, se);
        
        // 亮点应该被提取出来
        expect(getPixel(result, 2, 2).r).toBe(255);
    });
    
    test('blackHat 提取暗点', () => {
        // 亮背景上的暗点
        const pattern = [
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1],
            [1, 1, 0, 1, 1],
            [1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1]
        ];
        const img = createBinaryImage(pattern);
        const se = createStructuringElement('rect', 3);
        
        const result = blackHat(img, se);
        
        // 暗点应该被提取出来
        expect(getPixel(result, 2, 2).r).toBe(255);
    });
});

// ==================== 边界情况测试 ====================

describe('边界情况', () => {
    test('处理全黑图像', () => {
        const img = createImageData(5, 5, 0, 0, 0);
        const se = createStructuringElement('rect', 3);
        
        const eroded = erode(img, se);
        const dilated = dilate(img, se);
        
        // 全黑图像腐蚀后还是全黑
        expect(getPixel(eroded, 2, 2).r).toBe(0);
        // 全黑图像膨胀后还是全黑
        expect(getPixel(dilated, 2, 2).r).toBe(0);
    });
    
    test('处理全白图像', () => {
        const img = createImageData(5, 5, 255, 255, 255);
        const se = createStructuringElement('rect', 3);
        
        const eroded = erode(img, se);
        const dilated = dilate(img, se);
        
        // 全白图像腐蚀后中心还是白（边缘可能变黑）
        expect(getPixel(eroded, 2, 2).r).toBe(255);
        // 全白图像膨胀后还是全白
        expect(getPixel(dilated, 2, 2).r).toBe(255);
    });
});
