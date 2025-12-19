/**
 * 共享图像处理工具模块 - 统一入口
 * 
 * 本模块提供图像处理的基础工具函数，供所有章节复用。
 * 这些函数最终将整合到 25-ocr-engine 中。
 * 
 * 使用方式：
 * 
 * 方式1：统一导入所有函数
 * const { getPixel, setPixel, grayscaleWeighted } = require('../shared');
 * 
 * 方式2：按模块导入（推荐，更清晰的依赖关系）
 * const { getPixel, setPixel } = require('../shared/core');
 * const { grayscaleWeighted } = require('../shared/03-grayscale');
 * 
 * 方式3：向后兼容（旧方式）
 * const { getPixel, setPixel } = require('../shared/imageUtils');
 */

// 核心模块（01-02章节）
const core = require('./core');

// 灰度化模块（03章节）
const grayscale = require('./03-grayscale');

// 二值化模块（04章节）
const binarization = require('./04-binarization');

// 去噪模块（05章节）
const denoising = require('./05-denoising');

// 形态学操作模块（06章节）
const morphology = require('./06-morphology');

// 倾斜校正模块（07章节）
const deskewing = require('./07-deskewing');

// 边缘检测模块（08章节）
const edgeDetection = require('./08-edge-detection');

// 统一导出所有函数
module.exports = {
    // ==================== 核心模块（01-02章节） ====================
    // 类
    MockImageData: core.MockImageData,
    
    // 像素访问
    getPixel: core.getPixel,
    setPixel: core.setPixel,
    getGray: core.getGray,
    
    // 图像数据操作
    cloneImageData: core.cloneImageData,
    createImageData: core.createImageData,
    
    // 像素遍历
    forEachPixel: core.forEachPixel,
    forEachPixelXY: core.forEachPixelXY,
    
    // 颜色转换
    rgbToHex: core.rgbToHex,
    hexToRgb: core.hexToRgb,
    rgbToGray: core.rgbToGray,
    rgbToHsv: core.rgbToHsv,
    
    // 工具函数
    clamp: core.clamp,
    lerp: core.lerp,
    
    // ==================== 灰度化模块（03章节） ====================
    grayscaleWeighted: grayscale.grayscaleWeighted,
    grayscaleAverage: grayscale.grayscaleAverage,
    grayscaleMax: grayscale.grayscaleMax,
    grayscaleMin: grayscale.grayscaleMin,
    grayscaleSingleChannel: grayscale.grayscaleSingleChannel,
    calculateHistogram: grayscale.calculateHistogram,
    calculateHistogramStats: grayscale.calculateHistogramStats,
    
    // ==================== 二值化模块（04章节） ====================
    binarizeFixed: binarization.binarizeFixed,
    calculateOtsuThreshold: binarization.calculateOtsuThreshold,
    binarizeOtsu: binarization.binarizeOtsu,
    binarizeAdaptive: binarization.binarizeAdaptive,
    
    // ==================== 去噪模块（05章节） ====================
    createMeanKernel: denoising.createMeanKernel,
    createGaussianKernel: denoising.createGaussianKernel,
    convolve: denoising.convolve,
    meanFilter: denoising.meanFilter,
    gaussianFilter: denoising.gaussianFilter,
    medianFilter: denoising.medianFilter,
    addGaussianNoise: denoising.addGaussianNoise,
    addSaltPepperNoise: denoising.addSaltPepperNoise,
    
    // ==================== 形态学操作模块（06章节） ====================
    createStructuringElement: morphology.createStructuringElement,
    erode: morphology.erode,
    dilate: morphology.dilate,
    morphOpen: morphology.morphOpen,
    morphClose: morphology.morphClose,
    morphGradient: morphology.morphGradient,
    topHat: morphology.topHat,
    blackHat: morphology.blackHat,
    
    // ==================== 倾斜校正模块（07章节） ====================
    calculateHorizontalProjection: deskewing.calculateHorizontalProjection,
    calculateVerticalProjection: deskewing.calculateVerticalProjection,
    calculateProjectionVariance: deskewing.calculateProjectionVariance,
    bilinearInterpolate: deskewing.bilinearInterpolate,
    rotateImage: deskewing.rotateImage,
    detectSkewAngle: deskewing.detectSkewAngle,
    deskew: deskewing.deskew,
    
    // ==================== 边缘检测模块（08章节） ====================
    createSobelKernelX: edgeDetection.createSobelKernelX,
    createSobelKernelY: edgeDetection.createSobelKernelY,
    createPrewittKernelX: edgeDetection.createPrewittKernelX,
    createPrewittKernelY: edgeDetection.createPrewittKernelY,
    computeGradient: edgeDetection.computeGradient,
    sobelEdgeDetection: edgeDetection.sobelEdgeDetection,
    prewittEdgeDetection: edgeDetection.prewittEdgeDetection,
    nonMaxSuppression: edgeDetection.nonMaxSuppression,
    doubleThreshold: edgeDetection.doubleThreshold,
    hysteresisTracking: edgeDetection.hysteresisTracking,
    cannyEdgeDetection: edgeDetection.cannyEdgeDetection
};
