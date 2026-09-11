'use strict';
/** 第20章：node 20-crnn/index.js 快速观察；加 --train --steps 160 --write 训练并保存。 */

const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const path = require('path');
const { cnnSequenceShape, gradientCheck, trainTinyCrnn, createTinyCrnn, createSyntheticDataset, evaluateRows, imageBatch, predictRows } = require('../shared/20-crnn');
const assert = require('node:assert/strict');
const section = text => console.log(`\n【${text}】`);

async function main() {
    await tf.setBackend('cpu'); await tf.ready();
    section('1. 框架真实API与CTC梯度有限差分');
    console.log('TensorFlow.js 实测', { version: tf.version.tfjs, backend: tf.getBackend(),
        nativeCtcLoss: typeof tf.ctcLoss, customGrad: typeof tf.customGrad });
    const check = gradientCheck(tf); console.log('CTC 有限差分检查', check); assert.ok(check.maxAbsoluteError < 1e-5);
    section('2. 宽度、池化与CTC时间预算');
    const local = tf.tidy(() => {
        const pixels = tf.tensor4d([0, 1, 0, 1, 1, 0, 0, 0, 0], [1, 3, 3, 1]);
        const kernel = tf.fill([3, 3, 1, 1], 1 / 9);
        const convolved = tf.conv2d(pixels, kernel, 1, 'valid');
        const pooled = tf.avgPool(tf.tensor4d([0.2, 0.4, 0.6, 0.8], [1, 2, 2, 1]), 2, 2, 'valid');
        return { convolutionSum: convolved.dataSync()[0], tanh: convolved.tanh().dataSync()[0], averagePool: pooled.dataSync()[0] };
    });
    console.log('3×3教学核1/9：输入3个1，其余0；以及2×2平均池化手算对照', local);
    assert.ok(Math.abs(local.tanh - Math.tanh(1 / 3)) < 1e-6);
    assert.ok(Math.abs(local.averagePool - 0.5) < 1e-6);
    console.table([10, 20, 21, 32].map(width => { const shape = cnnSequenceShape({ width });
        return { width, timeSteps: shape.sequence[1], featuresPerStep: shape.sequence[2], repeated000Minimum: 5 }; }));
    console.log('CNN → 序列完整尺寸', cnnSequenceShape());
    assert.throws(() => cnnSequenceShape({ width: 0 }));
    section('3. 合成整行图像及随机初始化模型基线');
    const examples = createSyntheticDataset({ seed: 19001, copies: 1 });
    const example = examples.find(x => x.truth === '001');
    for (let y = 0; y < example.height; y++) console.log(Array.from(example.pixels.slice(y * example.width, (y + 1) * example.width)).map(x => x > 0.5 ? '██' : '··').join(''));
    const untrained = createTinyCrnn(tf);
    try { console.log('随机模型整串准确率（验证合成集）', evaluateRows(tf, untrained, examples).exactAccuracy); }
    finally { untrained.dispose(); }
    const args = process.argv.slice(2);
    if (args.includes('--train')) {
        section('4. 真实端到端训练：所有CNN/BiLSTM/输出层参数更新');
        const stepsIndex = args.indexOf('--steps');
        const steps = stepsIndex < 0 ? 160 : Number(args[stepsIndex + 1]);
        const { model, report } = await trainTinyCrnn(tf, { steps,
            onProgress: item => console.log(`更新 ${item.step}：平均CTC损失 ${item.loss.toFixed(6)}，${item.elapsedMs}ms`) });
        try {
            section('5. 实测梯度、训练与合成验证逐串结果');
            console.log(JSON.stringify(report, null, 2));
            if (args.includes('--write')) {
                fs.mkdirSync(path.join(__dirname, 'model'), { recursive: true });
                fs.writeFileSync(path.join(__dirname, 'model/weights.json'), JSON.stringify(model.exportWeights()));
                fs.writeFileSync(path.join(__dirname, 'training-report.json'), JSON.stringify(report, null, 2) + '\n');
                console.log('已保存本章 model/weights.json 与 training-report.json');
            }
        } finally { model.dispose(); }
    } else {
        section('4. 加载已训练权重并与随机基线比较');
        const filename = path.join(__dirname, 'model/weights.json');
        if (fs.existsSync(filename)) {
            const artifact = JSON.parse(fs.readFileSync(filename, 'utf8'));
            const model = createTinyCrnn(tf, artifact.config);
            try {
                model.importWeights(artifact);
                console.log('加载本项目训练权重后的留出合成样本预测');
                console.table(evaluateRows(tf, model, examples).rows);
                section('5. 查看真实中间特征与逐帧概率');
                const batch = imageBatch(tf, [example], model.config);
                try {
                    const stages = model.inspect(batch);
                    console.log('CNN池化后第0通道（4行×10列）');
                    console.table(stages.pooled.values[0].map(row => row.map(pixel => Number(pixel[0].toFixed(4)))));
                    console.log('map-to-sequence前2个时间步（每帧16维）');
                    console.table(stages.sequence.values[0].slice(0, 2));
                    const result = predictRows(tf, model, [example])[0];
                    console.table(result.probabilities.map((row, t) => ({ t, blank: row[0], digit0: row[1], digit1: row[2] })));
                    assert.equal(stages.sequence.shape[1], stages.pooled.shape[2]);
                    assert.deepEqual(stages.sequence.values[0][0], stages.pooled.values[0].flatMap(row => row[0]));
                    console.log('维度与列序自检通过；预测：', result.prediction);
                } finally { batch.dispose(); }
            } finally { model.dispose(); }
        } else console.log('运行 node 20-crnn/index.js --train --write 训练完整小型 CRNN。');
    }
    section('6. 资源释放与下一步');
    console.log('结束后活动张量数', tf.memory().numTensors);
    console.log('此实验覆盖完整小型CRNN训练，不代表手写照片性能；下一章Attention学习显式内容加权。');
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
