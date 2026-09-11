'use strict';
/** 第19章：node 19-ctc-loss/index.js；折叠、枚举、DP、解码、梯度和真实logits训练。 */
const { collapsePath, ctcForwardBackward, ctcLossAndGradient, enumeratePaths, greedyDecode, prefixBeamDecode, differentiableCtcLoss } = require('../shared/19-ctc-loss');
const assert = require('node:assert/strict');
const section = text => console.log(`\n【${text}】`);

async function main() {
    console.log('19 CTC：0是blank，1/2是类别索引（可映射数字0/1）。');
    section('1. 路径折叠：先合并连续重复，后删除blank');
    console.table([[1, 1], [1, 0, 1], [0, 0], [1, 1, 0, 1, 2, 2]].map(path => ({ path: JSON.stringify(path), output: JSON.stringify(collapsePath(path)) })));
    section('2. 两帧单字符：枚举三条合法路径');
    const twoFrames = [[0.4, 0.6], [0.6, 0.4]];
    console.table([{ path: 'a,a', product: 0.6 * 0.4 }, { path: 'a,blank', product: 0.6 * 0.6 }, { path: 'blank,a', product: 0.4 * 0.4 }]);
    console.log('总概率', ctcForwardBackward(twoFrames, [1]).probability);
    assert.ok(Math.abs(ctcForwardBackward(twoFrames, [1]).probability - 0.76) < 1e-12);
    section('3. 连续重复数字00：扩展状态、alpha、枚举对照');
    const probabilities = [[0.2, 0.7, 0.1], [0.8, 0.1, 0.1], [0.1, 0.8, 0.1]], target = [1, 1];
    const dp = ctcForwardBackward(probabilities, target), enumeration = enumeratePaths(probabilities, target);
    console.log('重复数字00：', { target, extended: dp.extended, minimumFrames: dp.minimumFrames,
        probability: dp.probability, enumeratedProbability: enumeration.probability,
        paths: enumeration.matchingPaths, loss: dp.loss });
    console.log('对数alpha'); console.table(dp.alpha);
    console.log('前后向计算的每帧类别后验'); console.table(dp.posterior);
    assert.ok(Math.abs(dp.probability - enumeration.probability) < 1e-12);
    section('4. 解码对比：最佳路径不一定是最佳标签串');
    const ambiguous = [[0.4, 0.35, 0.25], [0.4, 0.35, 0.25]];
    console.log('贪婪空串，beam聚合后得到数字0', { greedy: greedyDecode(ambiguous), beam: prefixBeamDecode(ambiguous, 0, 20).slice(0, 3) });
    console.table([1, 2, 5, 20].map(width => { const best = prefixBeamDecode(ambiguous, 0, width)[0];
        return { beamWidth: width, output: JSON.stringify(best.labels), accumulatedProbability: best.probability }; }));
    section('5. CTC logits梯度：p减条件对齐后验');
    const gradient = ctcLossAndGradient(probabilities.map(row => row.map(Math.log)), target);
    console.table(gradient.gradient.map((row, t) => ({ t, blankGradient: row[0], zeroGradient: row[1], oneGradient: row[2], sum: row.reduce((a, b) => a + b, 0) })));
    section('6. 失败边界与自检');
    console.log('2帧不能输出连续重复00：', ctcForwardBackward(ambiguous, [1, 1]).loss);
    assert.equal(ctcForwardBackward(ambiguous, [1, 1]).possible, false);
    assert.throws(() => ctcForwardBackward([[0.2, 0.2]], [1]));
    assert.throws(() => ctcForwardBackward(ambiguous, [0]));
    console.log('通过：DP/枚举一致、非法概率和含blank目标拒绝、重复帧数边界。');
    const shifted = ctcLossAndGradient([[1e16, 1e16]], [1]);
    console.log('稳定log-softmax反例：一帧两类logits都为1e16', {
        probability: shifted.probabilities[0], loss: shifted.loss, gradient: shifted.gradient[0]
    });
    assert.ok(Math.abs(shifted.loss - Math.log(2)) < 1e-12);
    assert.deepEqual(shifted.gradient[0], [0.5, -0.5]);

    section('7. 真实训练CTC logits，与第20章完整图像模型区分');
    const tf = require('@tensorflow/tfjs'); await tf.setBackend('cpu'); await tf.ready();
    const initial = tf.zeros([1, 3, 3]), logits = tf.variable(initial); initial.dispose();
    const optimizer = tf.train.adam(0.15), objective = () => differentiableCtcLoss(tf, logits, [[1, 1]]);
    const lossValue = () => tf.tidy(() => objective().dataSync()[0]);
    try {
        const before = lossValue();
        for (let step = 0; step < 40; step++) optimizer.minimize(objective, false, [logits]);
        const rows = tf.tidy(() => tf.softmax(logits, -1).arraySync()[0]);
        console.log('真实可微CTC实验（直接训练logits，尚无图像编码器）', { before, after: lossValue(), greedy: greedyDecode(rows), beam: prefixBeamDecode(rows)[0] });
    } finally { logits.dispose(); optimizer.dispose(); }
    console.log('释放后张量数', tf.memory().numTensors);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
