'use strict';

/**
 * 第14章：数值梯度 → 激活 → 完整反传 → 参数对照 → XOR训练。
 * 运行：node 14-neural-network-basics/index.js
 * 固定小数据与种子，无数据下载，不依赖后续章节。
 */
const assert = require('node:assert/strict');
const nn = require('../shared/14-neural-network-basics');
function heading(number, text) {
  console.log(`\n${'='.repeat(64)}\n实验 ${number}：${text}\n${'='.repeat(64)}`);
}
function parameterRows(before, gradients, after) {
  const rows = [];
  before.layers.forEach((layer, l) => {
    for (const key of ['weights', 'biases']) {
      layer[key].forEach((value, i) => rows.push({
        parameter: `L${l + 1}.${key}[${i}]`,
        before: value,
        gradient: gradients[l][key][i],
        after: after.layers[l][key][i]
      }));
    }
  });
  return rows;
}
function runDemo() {
  const samples = nn.xorSamples();
  const model = nn.createMLP({
    seed: 42,
    sizes: [2, 4, 1],
    activation: 'tanh'
  });
  heading(1, '先用中心差分检查全部 17 个参数');
  console.log('输入为 XOR 四点；损失取均值；解析梯度与数值梯度各走独立计算路径。');
  console.table(samples.map(s => ({
    input: s.input.join(','),
    target: s.target
  })));
  const check = nn.gradientCheck(model, samples);
  console.table(check.entries.map(e => ({
    parameter: e.parameter,
    analytical: e.analytical,
    numerical: e.numerical,
    absoluteError: e.absError
  })));
  console.table([1e-2, 1e-5, 1e-8].map(epsilon => {
    const r = nn.gradientCheck(model, samples, {
      epsilon
    });
    return {
      epsilon,
      maxAbsError: r.maxAbsError,
      maxRelativeError: r.maxRelativeError,
      passed: r.passed
    };
  }));
  assert.ok(check.passed, '默认中心差分验证失败');
  console.log('自检通过。ε 过大有截断误差，过小有浮点消减；不是越小越好。');
  heading(2, '感知机边界与三种激活的值、导数');
  console.table(samples.map(({
    input
  }) => {
    const z = input[0] + input[1] - 1.5;
    return {
      input: input.join(','),
      z,
      perceptronAND: Number(z >= 0)
    };
  }));
  console.log('AND 用一条直线可分；XOR 的两条对角线标签相反，一条直线不能全分对。');
  console.table([-6, -2, 0, Math.log(3), 2, 6].map(z => ({
    z,
    sigmoid: nn.activate(z, 'sigmoid'),
    sigmoidDerivative: nn.activationDerivative(z, 'sigmoid'),
    tanh: nn.activate(z, 'tanh'),
    tanhDerivative: nn.activationDerivative(z, 'tanh'),
    relu: nn.activate(z, 'relu'),
    reluDerivative: nn.activationDerivative(z, 'relu')
  })));
  console.log('ReLU 在0不可导，本实现约定导数0；Sigmoid 大绝对值输入时导数接近0。');
  heading(3, '追踪一个样本：前向 → BCE → 全部梯度 → 一次更新');
  const trace = nn.traceExample();
  console.log('x=[1,2]、y=1；隐藏Sigmoid；W1=[0.1,0.2;-0.1,0.1]，b1=[0,0]；W2=[0.3,-0.2]，b2=0.1。');
  console.table(trace.cache.preActivations.map((z, l) => ({
    layer: l + 1,
    weightShape: `${trace.before.layers[l].outputSize}×${trace.before.layers[l].inputSize}`,
    z: Array.from(z).join(', '),
    activation: Array.from(trace.cache.activations[l + 1]).join(', ')
  })));
  console.log(`输出 logit=${trace.cache.logit}，p=${trace.cache.probability}，BCE=${trace.loss}`);
  console.table(parameterRows(trace.before, trace.gradients, trace.after));
  console.log(`η=0.1，全部更新后重新前向：${trace.loss} → ${trace.afterLoss}`);
  assert.ok(trace.afterLoss < trace.loss, '手算例子更新后应下降');
  assert.ok(Math.abs(trace.gradients[0].weights[1] - 2 * trace.gradients[0].weights[0]) < 1e-14);
  console.log('自检通过：x2=2x1，同一神经元的第二个权重梯度也是第一个的两倍。');
  heading(4, '平均梯度与学习率：保持初始化相同再比较');
  const one = nn.backward(model, samples);
  const doubled = nn.backward(model, [...samples, ...samples]);
  console.table([{
    samples: 4,
    meanLoss: one.loss,
    firstGradient: one.gradients[0].weights[0]
  }, {
    samples: 8,
    meanLoss: doubled.loss,
    firstGradient: doubled.gradients[0].weights[0]
  }]);
  assert.ok(Math.abs(one.gradients[0].weights[0] - doubled.gradients[0].weights[0]) < 1e-14);
  console.table([0.01, 0.1, 0.5, 2, 10].map(learningRate => {
    const copy = nn.cloneModel(model);
    nn.applyGradients(copy, one.gradients, learningRate);
    const after = nn.evaluate(copy, samples).loss;
    return {
      learningRate,
      before: one.loss,
      after,
      difference: after - one.loss
    };
  }));
  console.log('复制全批次不改变均值梯度；过大学习率可能越过低损失区域。');
  heading(5, '默认 MLP 真正学习 XOR，观察训练前后');
  const initial = nn.evaluate(model, samples);
  const result = nn.train(model, samples, {
    epochs: 5000,
    learningRate: 0.5,
    recordEvery: 1000
  });
  console.table(result.history.map(({
    epoch,
    loss,
    accuracy
  }) => ({
    epoch,
    loss,
    fitAccuracy: accuracy
  })));
  console.table(result.predictions.map((p, i) => ({
    input: p.input.join(','),
    target: p.target,
    initialProbability: initial.predictions[i].probability,
    finalProbability: p.probability,
    predicted: p.predicted
  })));
  assert.equal(result.accuracy, 1);
  assert.ok(result.loss < 0.01);
  console.log('自检通过：预测由训练后的权重前向得到。四点均参与训练，这不是独立测试成绩。');
  heading(6, '结构/激活对照：能表达和能优化不是一回事');
  const comparisons = [{
    name: '无隐藏层',
    sizes: [2, 1],
    activation: 'tanh'
  }, {
    name: 'MLP/tanh',
    sizes: [2, 4, 1],
    activation: 'tanh'
  }, {
    name: 'MLP/sigmoid',
    sizes: [2, 4, 1],
    activation: 'sigmoid'
  }, {
    name: 'MLP/relu',
    sizes: [2, 4, 1],
    activation: 'relu'
  }].map(config => {
    const m = nn.createMLP({
      ...config,
      seed: 42
    });
    const r = nn.train(m, samples, {
      epochs: 1500,
      learningRate: 0.5,
      recordEvery: 1500
    });
    return {
      name: config.name,
      epochs: 1500,
      loss: r.loss,
      fitAccuracy: r.accuracy,
      probabilities: r.predictions.map(p => p.probability.toFixed(4)).join(', ')
    };
  });
  console.table(comparisons);
  console.log('线性模型在0.5附近有微小数值差异；观察完整概率与损失，不凭一次阈值结果判断表达能力。');
  heading(7, '稳定性与无效输入：失败应被看见');
  console.table([{
    logit: 1000,
    target: 0
  }, {
    logit: -1000,
    target: 1
  }, {
    logit: 1000,
    target: 1
  }].map(p => ({
    ...p,
    sigmoid: nn.sigmoid(p.logit),
    loss: nn.binaryCrossEntropyWithLogits(p.logit, p.target)
  })));
  const invalidCases = [['错误输入维度', () => nn.forward(model, [1])], ['空训练集', () => nn.backward(model, [])], ['非法学习率', () => nn.train(model, samples, {
    learningRate: 0
  })]];
  for (const [name, action] of invalidCases) {
    let caught = false;
    try {
      action();
    } catch (error) {
      caught = true;
      console.log(`${name}：已拒绝，${error.message}`);
    }
    assert.ok(caught, `${name} 应被拒绝`);
  }
  console.log('\n全部实验与自检完成。下一章：把稠密连接改成局部连接与共享卷积权重。');
  return {
    check,
    trace,
    result,
    comparisons
  };
}
if (require.main === module) {
  runDemo();
}
module.exports = {
  runDemo
};
