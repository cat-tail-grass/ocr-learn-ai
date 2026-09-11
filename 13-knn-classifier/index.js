/**
 * 第 13 章：KNN 分类器 - Node.js 示例
 *
 * 本示例演示：
 * 1. 从零使用 KNN 分类器训练字符识别器
 * 2. 比较不同 K 值和投票策略
 * 3. 按来源划分训练/验证/测试，验证集调参后仅测试一次
 * 4. 使用拒绝阈值识别未知字符
 *
 * 运行方式：
 * cd 13-knn-classifier
 * node index.js
 */

const {
    calculateDistance,
    splitTrainTest,
    KNNClassifier,
    evaluateKValues
} = require('../shared/13-knn-classifier');


const { buildDemoDataset, createDigitImage, createUnknownSymbol, selectDemoParameters } = require('../shared/13-knn-classifier/demoDataset');

/**
 * 打印混淆矩阵（只打印非零元素）
 */
function printConfusionMatrix(matrix) {
    const labels = Object.keys(matrix).sort((a, b) => a.localeCompare(b));

    console.log('混淆矩阵（仅显示非零项）:');
    for (const actual of labels) {
        for (const predicted of Object.keys(matrix[actual])) {
            const count = matrix[actual][predicted];
            if (count > 0) {
                console.log(`  实际 ${actual} -> 预测 ${predicted}: ${count}`);
            }
        }
    }
}

// ==================== 主程序 ====================

console.log('='.repeat(66));
console.log('第 13 章：KNN 分类器');
console.log('='.repeat(66));

// 1) 距离度量回顾
console.log('\n1) 距离度量回顾');
const vecA = [1, 2, 3, 4];
const vecB = [1.2, 2.1, 2.9, 4.1];
const vecC = [4, 3, 2, 1];

console.log(`  欧氏距离 d(A,B): ${calculateDistance(vecA, vecB, 'euclidean').toFixed(4)}`);
console.log(`  曼哈顿距离 d(A,B): ${calculateDistance(vecA, vecB, 'manhattan').toFixed(4)}`);
console.log(`  余弦距离 d(A,B): ${calculateDistance(vecA, vecB, 'cosine').toFixed(4)}`);
console.log(`  欧氏距离 d(A,C): ${calculateDistance(vecA, vecC, 'euclidean').toFixed(4)}`);

// 2) 来源分组在增强之前完成。各集合均来自同一个合成器，不能据此声称真实手写泛化。
console.log('\n2) 先按合成来源划分训练 / 验证 / 测试，再增强训练图像');
const dataset = buildDemoDataset();
const { train: trainSet, validation: validationSet, test: testSet } = dataset;
console.log(`  固定种子: ${dataset.seed}`);
console.log(`  来源组: ${JSON.stringify(dataset.sourceCounts)}`);
console.log(`  样本数: 训练 ${trainSet.length} / 验证 ${validationSet.length} / 测试 ${testSet.length}`);
console.log('  这是程序化数字的来源留出实验，不是 MNIST 或真实照片准确率。');

// 3) 保存训练样本；归一化是每个向量的 L2，不使用验证/测试统计量。
console.log('\n3) 训练 KNN 分类器');
const classifier = new KNNClassifier({
    k: 3, featureType: 'combined', distanceMetric: 'euclidean',
    weightedVote: true, rejectThreshold: null
}).fitFromImages(trainSet);
console.log(`  训练样本数: ${classifier.getStats().numSamples}，特征维度: ${classifier.samples[0].features.length}`);

// 4) 只用验证集选 K，并比较两种投票策略。
console.log('\n4) 验证集选择 K 与投票方式');
const { chosen, results: candidates } = selectDemoParameters(classifier, validationSet);
for (const item of candidates) {
    console.log(`  ${item.weightedVote ? '加权' : '普通'}投票 K=${item.k} -> 验证准确率 ${(item.accuracy * 100).toFixed(2)}%`);
}
console.log(`  冻结配置: K=${chosen.k}，${chosen.weightedVote ? '加权' : '普通'}投票，欧氏距离，不拒识`);

// 5) 冻结之后，仅一次独立测试。测试结果不反馈给上面的调参流程。
console.log('\n5) 冻结参数后的独立合成测试');
const evaluation = classifier.evaluate(testSet);
console.log(`  测试准确率: ${(evaluation.accuracy * 100).toFixed(2)}% (${evaluation.correct}/${evaluation.total})`);
console.log(`  拒识数: ${evaluation.rejected}，错误数（含拒识）: ${evaluation.errors}`);
printConfusionMatrix(evaluation.confusionMatrix);

// 6) 独立手算反例：票数与距离权重会产生不同结论。
console.log('\n6) 多数投票与加权投票的可核对反例');
const counterexample = new KNNClassifier({ k: 3, normalizeMethod: 'none' }).fit([
    { label: 'A', features: [0.1] }, { label: 'B', features: [0.2] }, { label: 'B', features: [0.3] }
]);
for (const weightedVote of [false, true]) {
    const r = counterexample.predict([0], { weightedVote });
    console.log(`  ${weightedVote ? '加权' : '普通'}投票: ${r.label}，票权占比 ${(r.confidence * 100).toFixed(2)}%（不是正确概率）`);
}

// 7) 拒绝阈值（未知字符）
console.log('\n7) 拒识规则的单独演示：阈值 0.85 未校准，不改变上面的已冻结测试');
const rejectClassifier = new KNNClassifier({
    k: 3,
    featureType: 'combined',
    distanceMetric: 'euclidean',
    weightedVote: true,
    rejectThreshold: 0.85
});
rejectClassifier.fitFromImages(trainSet);

const unknown = createUnknownSymbol();
const rejectResult = rejectClassifier.predictFromImage(unknown);

if (rejectResult.rejected) {
    console.log(`  未知符号 -> 已拒识（最近距离 ${rejectResult.distance.toFixed(4)}）`);
} else {
    console.log(`  未知符号 -> 被识别为 ${rejectResult.label}（降低阈值才会更严格；应在验证数据上选择阈值）`);
}

// 8) 导出与导入
console.log('\n8) 导出/导入分类器');
const exported = classifier.export();
const restored = new KNNClassifier();
restored.import(exported);

const quickTest = restored.predictFromImage(createDigitImage(7));
console.log(`  导入后测试: 识别结果=${quickTest.label}, 票权占比=${(quickTest.confidence * 100).toFixed(1)}%`);

console.log('\n' + '='.repeat(66));
console.log('第 13 章示例运行完成');
console.log('下一章：14. 神经网络基础');
console.log('='.repeat(66));
