'use strict';

/**
 * 第15章：互相关、多通道、步幅/填充、池化、梯度和 CNN 前向。
 * 运行：node 15-cnn-basics/index.js
 * 固定小矩阵，CNN 明确使用手工权重，不触发训练或下载。
 */
const assert = require('node:assert/strict');
const cnn = require('../shared/15-cnn-basics');
function heading(number, text) {
  console.log(`\n${'='.repeat(64)}\n实验 ${number}：${text}\n${'='.repeat(64)}`);
}
function printTensor(label, value) {
  const [channels, h, w] = value.shape;
  console.log(`${label}，形状 [${value.shape.join(',')}]`);
  for (let c = 0; c < channels; c++) {
    console.log(`  通道 ${c}`);
    for (let y = 0; y < h; y++) {
      console.log('  ' + Array.from(value.data.slice((c * h + y) * w, (c * h + y + 1) * w), v => v.toFixed(3).padStart(8)).join(' '));
    }
  }
}
function runDemo() {
  heading(1, '不翻核的互相关：看清每个乘加项');
  const single = cnn.tensor([1, 3, 3], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const asymmetric = cnn.tensor([1, 1, 2, 2], [1, 2, 3, 4]);
  printTensor('输入', single);
  printTensor('核切片', cnn.tensor([1, 2, 2], asymmetric.data));
  const correlation = cnn.conv2d(single, asymmetric);
  printTensor('互相关输出', correlation);
  console.log('左上：1×1+2×2+4×3+5×4=37。若先翻核180°，左上变成1×4+2×3+4×2+5×1=23。');
  assert.equal(correlation.data[0], 37);
  console.log('自检通过：非对称核证明当前约定不翻核。');
  heading(2, '跨输入通道相加，偏置每个输出只加一次');
  const input = cnn.tensor([2, 3, 3], [...single.data, ...Array(9).fill(1)]);
  const kernel = cnn.tensor([1, 2, 2, 2], [1, 0, 0, -1, 1, 1, 1, 1]);
  printTensor('两通道输入', input);
  printTensor('输出0的两个核切片', cnn.tensor([2, 2, 2], kernel.data));
  const output = cnn.conv2d(input, kernel, {
    bias: [0.5]
  });
  printTensor('一个输出通道', output);
  console.log('左上：通道0贡献1−5=−4；通道1贡献1+1+1+1=4；偏置0.5；总和0.5。');
  assert.deepEqual(Array.from(output.data), [0.5, 0.5, 0.5, 0.5]);
  heading(3, '步幅与零填充改变输出形状和边缘数值');
  const box = cnn.tensor([1, 1, 2, 2], [1, 1, 1, 1]);
  for (const options of [{
    stride: 1,
    padding: 0
  }, {
    stride: 2,
    padding: 0
  }, {
    stride: 2,
    padding: 1
  }]) {
    printTensor(`stride=${options.stride}, padding=${options.padding}`, cnn.conv2d(single, box, options));
  }
  console.log('stride2,padding1 的左上窗口 [0,0;0,1]，和为1；右下 [5,6;8,9]，和为28。');
  console.log('Hout=floor((H+2P−Kh)/S)+1；不完整的最后一个窗口不计算。');
  assert.deepEqual(Array.from(cnn.conv2d(single, box, {
    stride: 2,
    padding: 1
  }).data), [1, 5, 11, 28]);
  heading(4, '参数共享：比较相同输入与输出的三种连接方式');
  console.table([28, 56].map(size => ({
    inputSize: `${size}×${size}`,
    ...cnn.parameterCount([8, 1, 3, 3], [1, size, size], {
      padding: 1
    })
  })));
  console.log('共享卷积参数=8×(1×3×3+1)=80；图像放大2倍，参数不变，窗口乘加约为4倍。');
  assert.equal(cnn.parameterCount([8, 1, 3, 3], [1, 28, 28], {
    padding: 1
  }).convolution, 80);
  heading(5, 'ReLU、最大/平均池化和信息损失');
  const poolInput = cnn.tensor([1, 3, 3], [-4, -2, 99, -3, -1, 99, 99, 99, 99]);
  printTensor('原始特征图', poolInput);
  printTensor('ReLU', cnn.relu(poolInput));
  printTensor('原始特征图上最大池化2×2,s2', cnn.pool2d(poolInput));
  printTensor('原始特征图上平均池化2×2,s2', cnn.pool2d(poolInput, {
    mode: 'average'
  }));
  console.log('左上窗口 max=−1、average=−2.5；右侧/底部99在floor模式下丢弃，降采样可能漏掉细笔画。');
  assert.equal(cnn.pool2d(poolInput).data[0], -1);
  const overlap = cnn.tensor([1, 3, 3], [0, 0, 0, 0, 9, 0, 0, 0, 0]);
  const upstream = cnn.tensor([1, 2, 2], [1, 1, 1, 1]);
  printTensor('四个窗口共享中心最大值时的输入梯度', cnn.pool2dBackward(overlap, upstream, {
    stride: 1
  }));
  console.log('中心收到4条路径的梯度，累加成4。并列最大值取行优先第一个位置。');
  heading(6, '卷积训练梯度：独立数值差分与一次真实下降');
  const grad = cnn.conv2dBackward(input, kernel, cnn.tensor(output.shape, [1, 1, 1, 1]));
  printTensor('L=sum(Y) 的 dL/dX', grad.dInput);
  printTensor('dL/dK 的两个切片', cnn.tensor([2, 2, 2], grad.dKernel.data));
  console.log(`dL/db=${Array.from(grad.dBias)}；每个输出点贡献1，总计4。`);
  const original = kernel.data[0];
  const epsilon = 1e-5;
  kernel.data[0] = original + epsilon;
  const plus = cnn.conv2d(input, kernel).data.reduce((a, b) => a + b, 0);
  kernel.data[0] = original - epsilon;
  const minus = cnn.conv2d(input, kernel).data.reduce((a, b) => a + b, 0);
  kernel.data[0] = original;
  const numerical = (plus - minus) / (2 * epsilon);
  console.table([{
    parameter: 'K[0,0,0,0]',
    analytical: grad.dKernel.data[0],
    numerical,
    error: Math.abs(numerical - grad.dKernel.data[0])
  }]);
  assert.ok(Math.abs(numerical - 12) < 1e-7);
  const localInput = cnn.tensor([1, 2, 3], [1, 0, 2, -1, 1, 3]);
  const localKernel = cnn.tensor([1, 1, 2, 2], [0.1, -0.2, 0.3, 0.1]);
  const localY = cnn.conv2d(localInput, localKernel);
  const squaredLoss = value => value.data.reduce((sum, v) => sum + v * v / 2, 0);
  const localGrad = cnn.conv2dBackward(localInput, localKernel, localY);
  localKernel.data.forEach((v, i) => {
    localKernel.data[i] = v - 0.01 * localGrad.dKernel.data[i];
  });
  const afterLoss = squaredLoss(cnn.conv2d(localInput, localKernel));
  console.log(`另定义局部 L=½ΣY²，η=0.01，一次权重更新：${squaredLoss(localY)} → ${afterLoss}`);
  assert.ok(afterLoss < squaredLoss(localY));
  console.log('自检通过。这是局部卷积学习验证，不是完整CNN训练；Sobel梯度也不是这些损失偏导。');
  heading(7, '38个手工参数的CNN：完整逐层前向');
  const results = ['vertical', 'horizontal'].map(orientation => {
    const image = cnn.makeLineImage({
      orientation
    });
    const result = cnn.tinyCNNForward(image);
    printTensor(`输入 ${orientation}`, image);
    printTensor('卷积', result.convolution);
    printTensor('ReLU', result.activation);
    printTensor('最大池化', result.pooled);
    console.log(`Flatten(CHW)=[${Array.from(result.features)}]`);
    console.log(`logits=[${Array.from(result.logits)}]，Softmax=[${Array.from(result.probabilities)}]，类别=${result.label}`);
    console.log(`总参数=${result.parameterCount}=卷积20+全连接18；形状1×6×6→2×4×4→2×2×2→8→2。`);
    return result;
  });
  assert.equal(results[0].label, '竖线');
  assert.equal(results[1].label, '横线');
  heading(8, '位移与空白的失败对照、输入拒绝');
  console.table([0, 1, 2, 3, 4, 5].map(position => {
    const r = cnn.tinyCNNForward(cnn.makeLineImage({
      position
    }));
    return {
      position,
      verticalLogit: r.logits[0],
      horizontalLogit: r.logits[1],
      verticalScore: r.probabilities[0]
    };
  }));
  const blank = cnn.tinyCNNForward(cnn.tensor([1, 6, 6]));
  console.log(`全零输入两个得分=[${Array.from(blank.probabilities)}]；不能区分，argmax选第一个只是并列规则。`);
  assert.deepEqual(Array.from(blank.probabilities), [0.5, 0.5]);
  for (const [label, action] of [['通道不匹配', () => cnn.conv2d(single, kernel)], ['stride为0', () => cnn.conv2d(single, asymmetric, {
    stride: 0
  })]]) {
    let caught = false;
    try {
      action();
    } catch (error) {
      caught = true;
      console.log(`${label}：已拒绝，${error.message}`);
    }
    assert.ok(caught);
  }
  console.log('\n全部实验与自检完成。这里未训练数字分类器；下一章用框架组织可复现训练流程。');
  return {
    output,
    results
  };
}
if (require.main === module) {
  runDemo();
}
module.exports = {
  runDemo
};
