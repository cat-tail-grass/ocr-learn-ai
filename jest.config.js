/**
 * Jest 配置文件
 * 
 * 用于 OCR 学习项目的单元测试配置
 */
module.exports = {
    // 测试环境
    testEnvironment: 'node',
    
    // 测试文件匹配模式
    testMatch: ['**/shared/__tests__/**/*.test.js'],
    
    // 覆盖率收集范围
    collectCoverageFrom: [
        'shared/**/*.js',
        '!shared/__tests__/**',
        '!shared/imageUtils.js'  // 兼容层不需要单独测试
    ],
    
    // 详细输出
    verbose: true,
    
    // 测试超时时间（毫秒）
    testTimeout: 10000
};
