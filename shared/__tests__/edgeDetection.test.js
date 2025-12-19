/**
 * 边缘检测模块单元测试
 * 
 * 测试内容：
 * - Sobel 和 Prewitt 卷积核
 * - 梯度计算
 * - Sobel 和 Prewitt 边缘检测
 * - Canny 边缘检测及其各步骤
 */

const { MockImageData, setPixel, getPixel, createImageData } = require('../core');
const {
    createSobelKernelX,
    createSobelKernelY,
    createPrewittKernelX,
    createPrewittKernelY,
    computeGradient,
    sobelEdgeDetection,
    prewittEdgeDetection,
    nonMaxSuppression,
    doubleThreshold,
    hysteresisTracking,
    cannyEdgeDetection
} = require('../08-edge-detection');

// ==================== 辅助函数 ====================

/**
 * 创建有边缘的测试图像
 */
function createEdgeImage() {
    const img = createImageData(10, 10, 0, 0, 0);
    // 右半部分设为白色，形成垂直边缘
    for (let y = 0; y < 10; y++) {
        for (let x = 5; x < 10; x++) {
            setPixel(img, x, y, 255, 255, 255);
        }
    }
    return img;
}

/**
 * 创建方块图像（用于测试边缘）
 */
function createSquareImage() {
    const img = createImageData(20, 20, 0, 0, 0);
    // 中间放一个白色方块
    for (let y = 5; y < 15; y++) {
        for (let x = 5; x < 15; x++) {
            setPixel(img, x, y, 255, 255, 255);
        }
    }
    return img;
}

// ==================== 卷积核测试 ====================

describe('卷积核创建', () => {
    test('createSobelKernelX 正确形状', () => {
        const kernel = createSobelKernelX();
        
        expect(kernel.length).toBe(3);
        expect(kernel[0].length).toBe(3);
        
        // 检查特征值
        expect(kernel[0][0]).toBe(-1);
        expect(kernel[0][2]).toBe(1);
        expect(kernel[1][0]).toBe(-2);
        expect(kernel[1][2]).toBe(2);
        expect(kernel[1][1]).toBe(0); // 中心为0
    });
    
    test('createSobelKernelY 正确形状', () => {
        const kernel = createSobelKernelY();
        
        expect(kernel.length).toBe(3);
        expect(kernel[0].length).toBe(3);
        
        // 检查特征值
        expect(kernel[0][0]).toBe(-1);
        expect(kernel[0][1]).toBe(-2);
        expect(kernel[2][0]).toBe(1);
        expect(kernel[2][1]).toBe(2);
        expect(kernel[1][1]).toBe(0); // 中心为0
    });
    
    test('createPrewittKernelX 正确形状', () => {
        const kernel = createPrewittKernelX();
        
        expect(kernel.length).toBe(3);
        
        // Prewitt 所有列权重相等
        expect(kernel[0][0]).toBe(-1);
        expect(kernel[1][0]).toBe(-1);
        expect(kernel[2][0]).toBe(-1);
        expect(kernel[0][2]).toBe(1);
        expect(kernel[1][2]).toBe(1);
        expect(kernel[2][2]).toBe(1);
    });
    
    test('createPrewittKernelY 正确形状', () => {
        const kernel = createPrewittKernelY();
        
        expect(kernel.length).toBe(3);
        
        // Prewitt 所有行权重相等
        expect(kernel[0][0]).toBe(-1);
        expect(kernel[0][1]).toBe(-1);
        expect(kernel[0][2]).toBe(-1);
        expect(kernel[2][0]).toBe(1);
        expect(kernel[2][1]).toBe(1);
        expect(kernel[2][2]).toBe(1);
    });
});

// ==================== 梯度计算测试 ====================

describe('梯度计算', () => {
    test('computeGradient 返回正确结构', () => {
        const img = createEdgeImage();
        const kernelX = createSobelKernelX();
        const kernelY = createSobelKernelY();
        
        const result = computeGradient(img, kernelX, kernelY);
        
        expect(result.gx).toBeInstanceOf(Float32Array);
        expect(result.gy).toBeInstanceOf(Float32Array);
        expect(result.magnitude).toBeInstanceOf(Float32Array);
        expect(result.direction).toBeInstanceOf(Float32Array);
        expect(result.width).toBe(10);
        expect(result.height).toBe(10);
    });
    
    test('computeGradient 检测垂直边缘', () => {
        const img = createEdgeImage();
        const kernelX = createSobelKernelX();
        const kernelY = createSobelKernelY();
        
        const result = computeGradient(img, kernelX, kernelY);
        
        // 边缘位置（x=4或5）应该有较大的 gx
        const edgeIdx = 5 * 10 + 4; // y=5, x=4
        expect(Math.abs(result.gx[edgeIdx])).toBeGreaterThan(0);
        
        // 非边缘位置应该 gx 较小
        const nonEdgeIdx = 5 * 10 + 1; // y=5, x=1
        expect(Math.abs(result.gx[nonEdgeIdx])).toBeLessThan(Math.abs(result.gx[edgeIdx]));
    });
    
    test('computeGradient 梯度幅值', () => {
        const img = createEdgeImage();
        const kernelX = createSobelKernelX();
        const kernelY = createSobelKernelY();
        
        const result = computeGradient(img, kernelX, kernelY);
        
        // 边缘处梯度幅值应该最大
        let maxMagnitude = 0;
        let maxIdx = 0;
        for (let i = 0; i < result.magnitude.length; i++) {
            if (result.magnitude[i] > maxMagnitude) {
                maxMagnitude = result.magnitude[i];
                maxIdx = i;
            }
        }
        
        // 最大梯度应该在边缘附近
        const x = maxIdx % 10;
        expect(x).toBeGreaterThanOrEqual(3);
        expect(x).toBeLessThanOrEqual(6);
    });
});

// ==================== Sobel 边缘检测测试 ====================

describe('Sobel 边缘检测', () => {
    test('sobelEdgeDetection 基本功能', () => {
        const img = createSquareImage();
        
        const result = sobelEdgeDetection(img);
        
        expect(result.imageData).toBeDefined();
        expect(result.imageData.width).toBe(20);
        expect(result.imageData.height).toBe(20);
        expect(result.magnitude).toBeDefined();
        expect(result.direction).toBeDefined();
    });
    
    test('sobelEdgeDetection 检测边缘', () => {
        const img = createSquareImage();
        
        const result = sobelEdgeDetection(img);
        
        // 边缘处应该有较高的值
        const edgePixel = getPixel(result.imageData, 5, 10);
        const innerPixel = getPixel(result.imageData, 10, 10);
        
        expect(edgePixel.r).toBeGreaterThan(innerPixel.r);
    });
    
    test('sobelEdgeDetection 归一化', () => {
        const img = createSquareImage();
        
        const resultNormalized = sobelEdgeDetection(img, true);
        const resultNotNormalized = sobelEdgeDetection(img, false);
        
        // 归一化后最大值应该接近255
        let maxNormalized = 0;
        for (let y = 0; y < 20; y++) {
            for (let x = 0; x < 20; x++) {
                const value = getPixel(resultNormalized.imageData, x, y).r;
                if (value > maxNormalized) maxNormalized = value;
            }
        }
        expect(maxNormalized).toBe(255);
    });
});

// ==================== Prewitt 边缘检测测试 ====================

describe('Prewitt 边缘检测', () => {
    test('prewittEdgeDetection 基本功能', () => {
        const img = createSquareImage();
        
        const result = prewittEdgeDetection(img);
        
        expect(result.imageData).toBeDefined();
        expect(result.magnitude).toBeDefined();
        expect(result.direction).toBeDefined();
    });
    
    test('prewittEdgeDetection 与 Sobel 类似结果', () => {
        const img = createSquareImage();
        
        const sobelResult = sobelEdgeDetection(img);
        const prewittResult = prewittEdgeDetection(img);
        
        // 边缘处两者都应该有响应
        const sobelEdge = getPixel(sobelResult.imageData, 5, 10).r;
        const prewittEdge = getPixel(prewittResult.imageData, 5, 10).r;
        
        expect(sobelEdge).toBeGreaterThan(0);
        expect(prewittEdge).toBeGreaterThan(0);
    });
});

// ==================== 非极大值抑制测试 ====================

describe('非极大值抑制', () => {
    test('nonMaxSuppression 细化边缘', () => {
        // 创建模拟的梯度数据
        const width = 5;
        const height = 5;
        const magnitude = new Float32Array(width * height);
        const direction = new Float32Array(width * height);
        
        // 设置一条垂直边缘（水平梯度方向）
        for (let y = 1; y < 4; y++) {
            magnitude[y * width + 1] = 50;
            magnitude[y * width + 2] = 100;
            magnitude[y * width + 3] = 50;
            direction[y * width + 2] = 0; // 水平方向
        }
        
        const result = nonMaxSuppression(magnitude, direction, width, height);
        
        // 只有局部最大值（中间列）应该被保留
        expect(result[2 * width + 2]).toBe(100);
    });
});

// ==================== 双阈值检测测试 ====================

describe('双阈值检测', () => {
    test('doubleThreshold 分类正确', () => {
        const width = 5;
        const height = 1;
        const magnitude = new Float32Array([10, 30, 60, 80, 110]);
        
        const result = doubleThreshold(magnitude, 50, 100, width, height);
        
        // 强边缘：>= 100
        expect(result.strong[4]).toBe(1);
        
        // 弱边缘：50-99
        expect(result.weak[2]).toBe(1);
        expect(result.weak[3]).toBe(1);
        
        // 非边缘：< 50
        expect(result.strong[0]).toBe(0);
        expect(result.weak[0]).toBe(0);
    });
});

// ==================== 边缘连接测试 ====================

describe('边缘连接', () => {
    test('hysteresisTracking 连接弱边缘', () => {
        const width = 5;
        const height = 5;
        const strong = new Uint8Array(width * height);
        const weak = new Uint8Array(width * height);
        
        // 中心是强边缘
        strong[2 * width + 2] = 1;
        
        // 周围是弱边缘
        weak[2 * width + 1] = 1;
        weak[2 * width + 3] = 1;
        weak[1 * width + 2] = 1;
        weak[3 * width + 2] = 1;
        
        // 孤立的弱边缘
        weak[0 * width + 0] = 1;
        
        const result = hysteresisTracking(strong, weak, width, height);
        
        // 与强边缘相连的弱边缘应该被保留
        expect(result[2 * width + 1]).toBe(1);
        expect(result[2 * width + 3]).toBe(1);
        
        // 孤立的弱边缘应该被舍弃
        expect(result[0 * width + 0]).toBe(0);
    });
});

// ==================== Canny 边缘检测测试 ====================

describe('Canny 边缘检测', () => {
    test('cannyEdgeDetection 基本功能', () => {
        const img = createSquareImage();
        
        const result = cannyEdgeDetection(img);
        
        expect(result.imageData).toBeDefined();
        expect(result.steps).toBeDefined();
        expect(result.edgeCount).toBeDefined();
    });
    
    test('cannyEdgeDetection 返回中间步骤', () => {
        const img = createSquareImage();
        
        const result = cannyEdgeDetection(img);
        
        expect(result.steps.blurred).toBeDefined();
        expect(result.steps.magnitude).toBeDefined();
        expect(result.steps.nms).toBeDefined();
        expect(result.steps.threshold).toBeDefined();
        expect(result.steps.final).toBeDefined();
    });
    
    test('cannyEdgeDetection 检测边缘', () => {
        const img = createSquareImage();
        
        const result = cannyEdgeDetection(img);
        
        // 应该检测到一些边缘
        expect(result.edgeCount).toBeGreaterThan(0);
    });
    
    test('cannyEdgeDetection 参数调整', () => {
        const img = createSquareImage();
        
        const resultLow = cannyEdgeDetection(img, {
            lowThreshold: 10,
            highThreshold: 50
        });
        
        const resultHigh = cannyEdgeDetection(img, {
            lowThreshold: 100,
            highThreshold: 200
        });
        
        // 低阈值应该检测到更多边缘
        expect(resultLow.edgeCount).toBeGreaterThanOrEqual(resultHigh.edgeCount);
    });
    
    test('cannyEdgeDetection 高斯参数', () => {
        const img = createSquareImage();
        
        // 不同的高斯参数
        const result1 = cannyEdgeDetection(img, {
            gaussianSize: 3,
            gaussianSigma: 1.0
        });
        
        const result2 = cannyEdgeDetection(img, {
            gaussianSize: 5,
            gaussianSigma: 1.4
        });
        
        // 两者都应该成功
        expect(result1.imageData.width).toBe(20);
        expect(result2.imageData.width).toBe(20);
    });
});

// ==================== 边界情况测试 ====================

describe('边界情况', () => {
    test('处理全黑图像', () => {
        const img = createImageData(10, 10, 0, 0, 0);
        
        const result = sobelEdgeDetection(img);
        
        // 全黑图像没有边缘
        let hasEdge = false;
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                if (getPixel(result.imageData, x, y).r > 0) {
                    hasEdge = true;
                    break;
                }
            }
        }
        expect(hasEdge).toBe(false);
    });
    
    test('处理全白图像', () => {
        const img = createImageData(10, 10, 255, 255, 255);
        
        const result = sobelEdgeDetection(img);
        
        // 全白图像没有内部边缘（可能有边界效应）
        const centerPixel = getPixel(result.imageData, 5, 5);
        expect(centerPixel.r).toBe(0);
    });
    
    test('处理小图像', () => {
        const img = createImageData(3, 3, 128, 128, 128);
        
        expect(() => {
            cannyEdgeDetection(img);
        }).not.toThrow();
    });
});
