/**
 * 去噪模块单元测试
 * 
 * 测试内容：
 * - 滤波核创建（均值核、高斯核）
 * - 卷积操作
 * - 滤波算法（均值、高斯、中值）
 * - 噪声添加（高斯噪声、椒盐噪声）
 */

const { MockImageData, setPixel, getPixel, createImageData } = require('../core');
const {
    createMeanKernel,
    createGaussianKernel,
    convolve,
    meanFilter,
    gaussianFilter,
    medianFilter,
    addGaussianNoise,
    addSaltPepperNoise
} = require('../05-denoising');

// ==================== 滤波核创建测试 ====================

describe('滤波核创建', () => {
    test('createMeanKernel 3x3', () => {
        const kernel = createMeanKernel(3);
        
        expect(kernel.length).toBe(3);
        expect(kernel[0].length).toBe(3);
        
        // 所有值应该相等且和为1
        const expectedValue = 1 / 9;
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                expect(kernel[y][x]).toBeCloseTo(expectedValue, 5);
            }
        }
    });
    
    test('createMeanKernel 偶数自动变奇数', () => {
        const kernel = createMeanKernel(4); // 应该变成 5
        
        expect(kernel.length).toBe(5);
    });
    
    test('createGaussianKernel 3x3', () => {
        const kernel = createGaussianKernel(3, 1.0);
        
        expect(kernel.length).toBe(3);
        expect(kernel[0].length).toBe(3);
        
        // 中心应该是最大值
        expect(kernel[1][1]).toBeGreaterThan(kernel[0][0]);
        expect(kernel[1][1]).toBeGreaterThan(kernel[0][1]);
        
        // 角落应该是最小值
        expect(kernel[0][0]).toBeLessThan(kernel[0][1]);
        expect(kernel[0][0]).toBeLessThan(kernel[1][0]);
        
        // 总和应该为1（归一化）
        let sum = 0;
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                sum += kernel[y][x];
            }
        }
        expect(sum).toBeCloseTo(1, 5);
    });
    
    test('createGaussianKernel sigma 影响', () => {
        const kernelSmall = createGaussianKernel(5, 0.5);
        const kernelLarge = createGaussianKernel(5, 2.0);
        
        // 小 sigma 的中心权重更集中
        expect(kernelSmall[2][2]).toBeGreaterThan(kernelLarge[2][2]);
    });
});

// ==================== 卷积操作测试 ====================

describe('卷积操作', () => {
    test('convolve 使用单位核', () => {
        const img = createImageData(3, 3, 100, 100, 100);
        setPixel(img, 1, 1, 200, 200, 200);
        
        // 单位核：只保留中心像素
        const kernel = [
            [0, 0, 0],
            [0, 1, 0],
            [0, 0, 0]
        ];
        
        const result = convolve(img, kernel);
        
        expect(getPixel(result, 1, 1).r).toBe(200);
        expect(getPixel(result, 0, 0).r).toBe(100);
    });
    
    test('convolve 边界处理', () => {
        const img = createImageData(3, 3, 100, 100, 100);
        
        // 使用均值核
        const kernel = createMeanKernel(3);
        
        // 不应抛出错误
        expect(() => {
            convolve(img, kernel);
        }).not.toThrow();
    });
});

// ==================== 滤波算法测试 ====================

describe('滤波算法', () => {
    test('meanFilter 平滑效果', () => {
        // 创建有噪点的图像
        const img = createImageData(5, 5, 100, 100, 100);
        setPixel(img, 2, 2, 255, 255, 255); // 中心噪点
        
        const result = meanFilter(img, 3);
        
        // 中心像素应该被平滑（不再是255）
        const centerPixel = getPixel(result, 2, 2);
        expect(centerPixel.r).toBeLessThan(255);
        expect(centerPixel.r).toBeGreaterThan(100);
    });
    
    test('gaussianFilter 平滑效果', () => {
        const img = createImageData(5, 5, 100, 100, 100);
        setPixel(img, 2, 2, 255, 255, 255);
        
        const result = gaussianFilter(img, 3, 1.0);
        
        const centerPixel = getPixel(result, 2, 2);
        expect(centerPixel.r).toBeLessThan(255);
        expect(centerPixel.r).toBeGreaterThan(100);
    });
    
    test('medianFilter 去除椒盐噪声', () => {
        // 创建有椒盐噪声的图像
        const img = createImageData(5, 5, 128, 128, 128);
        setPixel(img, 2, 2, 255, 255, 255); // 盐噪声
        
        const result = medianFilter(img, 3);
        
        // 中值滤波应该完全去除这个噪点
        const centerPixel = getPixel(result, 2, 2);
        expect(centerPixel.r).toBe(128);
    });
    
    test('medianFilter 保留边缘', () => {
        // 创建有明显边缘的图像
        const img = createImageData(5, 5, 0, 0, 0);
        // 右半部分设为白色
        for (let y = 0; y < 5; y++) {
            for (let x = 3; x < 5; x++) {
                setPixel(img, x, y, 255, 255, 255);
            }
        }
        
        const result = medianFilter(img, 3);
        
        // 边缘应该被保留
        expect(getPixel(result, 0, 2).r).toBe(0);
        expect(getPixel(result, 4, 2).r).toBe(255);
    });
});

// ==================== 噪声添加测试 ====================

describe('噪声添加', () => {
    test('addGaussianNoise 添加噪声', () => {
        const img = createImageData(10, 10, 128, 128, 128);
        
        const result = addGaussianNoise(img, 25);
        
        // 检查是否有像素值发生变化
        let changed = false;
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                if (getPixel(result, x, y).r !== 128) {
                    changed = true;
                    break;
                }
            }
        }
        expect(changed).toBe(true);
    });
    
    test('addGaussianNoise 值在有效范围内', () => {
        const img = createImageData(10, 10, 128, 128, 128);
        
        const result = addGaussianNoise(img, 50);
        
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                const pixel = getPixel(result, x, y);
                expect(pixel.r).toBeGreaterThanOrEqual(0);
                expect(pixel.r).toBeLessThanOrEqual(255);
            }
        }
    });
    
    test('addSaltPepperNoise 添加噪声', () => {
        const img = createImageData(10, 10, 128, 128, 128);
        
        const result = addSaltPepperNoise(img, 0.1);
        
        // 检查是否有 0 或 255 的像素
        let hasNoise = false;
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                const value = getPixel(result, x, y).r;
                if (value === 0 || value === 255) {
                    hasNoise = true;
                    break;
                }
            }
        }
        expect(hasNoise).toBe(true);
    });
    
    test('addSaltPepperNoise 噪声密度', () => {
        const img = createImageData(100, 100, 128, 128, 128);
        
        const result = addSaltPepperNoise(img, 0.1); // 10% 噪声
        
        // 统计噪声像素
        let noiseCount = 0;
        for (let y = 0; y < 100; y++) {
            for (let x = 0; x < 100; x++) {
                const value = getPixel(result, x, y).r;
                if (value === 0 || value === 255) {
                    noiseCount++;
                }
            }
        }
        
        // 应该大约有 1000 个噪声像素（10% of 10000）
        // 由于随机性，允许一定误差
        expect(noiseCount).toBeGreaterThan(500);
        expect(noiseCount).toBeLessThan(1500);
    });
});

// ==================== 边界情况测试 ====================

describe('边界情况', () => {
    test('处理 1x1 图像', () => {
        const img = createImageData(1, 1, 100, 100, 100);
        
        expect(() => {
            meanFilter(img, 3);
        }).not.toThrow();
        
        expect(() => {
            medianFilter(img, 3);
        }).not.toThrow();
    });
    
    test('处理核大小为 1', () => {
        const img = createImageData(3, 3, 100, 100, 100);
        setPixel(img, 1, 1, 200, 200, 200);
        
        const result = meanFilter(img, 1);
        
        // 核大小为 1 时应该保持原样
        expect(getPixel(result, 1, 1).r).toBe(200);
    });
});
