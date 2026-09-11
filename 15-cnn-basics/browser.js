'use strict';

const {
  tensor,
  conv2d,
  conv2dBackward,
  relu,
  pool2d,
  parameterCount,
  makeLineImage,
  createTinyCNN,
  tinyCNNForward
} = require('../shared/15-cnn-basics');
const $ = id => document.getElementById(id);
let customInput = null;
function fillMatrixEditor(input) {
  const rows = Array.from({
    length: 6
  }, (_, y) => Array.from(input.data.slice(y * 6, (y + 1) * 6)));
  $('matrix-input').value = '[\n' + rows.map(row => '  ' + JSON.stringify(row)).join(',\n') + '\n]';
}
function mapTable(values, height, width, label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'feature-map';
  const table = document.createElement('table');
  const caption = document.createElement('caption');
  caption.textContent = label;
  table.append(caption);
  const body = document.createElement('tbody');
  for (let y = 0; y < height; y++) {
    const row = document.createElement('tr');
    for (let x = 0; x < width; x++) {
      const v = values[y * width + x];
      const cell = document.createElement('td');
      cell.textContent = Number(v.toFixed(2));
      cell.title = `[${y},${x}] = ${v}`;
      const alpha = Math.min(0.35, Math.abs(v) * 0.22);
      cell.style.background = v >= 0 ? `rgba(21,130,90,${alpha})` : `rgba(192,74,55,${alpha})`;
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  wrapper.append(table);
  return wrapper;
}
function showMaps(id, value) {
  const [channels, height, width] = value.shape;
  $(id).replaceChildren(...Array.from({
    length: channels
  }, (_, c) => mapTable(value.data.slice(c * height * width, (c + 1) * height * width), height, width, `通道 ${c} · ${height}×${width}`)));
}
function render() {
  try {
    const orientation = $('orientation').value;
    const position = Number($('position').value);
    const channels = Number($('channels').value);
    const stride = Number($('stride').value);
    const padding = Number($('padding').value);
    const baseInput = customInput || makeLineImage({
      orientation,
      position
    });
    fillMatrixEditor(baseInput);
    const baseModel = createTinyCNN();
    const input = channels === 1 ? baseInput : tensor([2, 6, 6], [...baseInput.data, ...Array(36).fill(1)]);
    const kernelValues = [];
    for (let o = 0; o < 2; o++) {
      kernelValues.push(...baseModel.kernel.data.slice(o * 9, (o + 1) * 9));
      if (channels === 2) {
        kernelValues.push(...Array(9).fill(1 / 9));
      }
    }
    const kernel = tensor([2, channels, 3, 3], kernelValues);
    const output = conv2d(input, kernel, {
      stride,
      padding
    });
    const activated = relu(output);
    const pooled = pool2d(activated, {
      mode: $('pool-mode').value
    });
    const counts = parameterCount(kernel.shape, input.shape, {
      stride,
      padding
    });
    const isBlank = baseInput.data.every(v => v === 0);
    $('status').textContent = `已计算${customInput ? '自定义矩阵' : '线条预设'}：输入 ${channels} 通道，输出 2 通道 · 步幅 ${stride} · 零填充 ${padding}${isBlank ? ' · 第一个通道为空白，固定CNN无法区分线条' : ''}`;
    $('status').classList.remove('error');
    $('shape').textContent = `${input.shape.join(' × ')} → Conv ${output.shape.join(' × ')} → ReLU ${activated.shape.join(' × ')} → Pool ${pooled.shape.join(' × ')}`;
    $('parameters').textContent = `卷积参数 ${counts.convolution}（含偏置） · 相同局部连接取消共享：${counts.locallyConnected} · 全连接到相同输出：${counts.fullyConnected} · 理论窗口乘加 ${counts.multiplyAccumulates} 次（含零填充位置）`;
    showMaps('input-maps', input);
    showMaps('conv-maps', output);
    showMaps('relu-maps', activated);
    showMaps('pool-maps', pooled);
    const kernelTables = [];
    for (let o = 0; o < 2; o++) {
      for (let c = 0; c < channels; c++) {
        const start = (o * channels + c) * 9;
        kernelTables.push(mapTable(kernel.data.slice(start, start + 9), 3, 3, `输出 ${o} ← 输入 ${c}`));
      }
    }
    $('kernel-maps').replaceChildren(...kernelTables);
    const gradient = conv2dBackward(input, kernel, tensor(output.shape, Array(output.data.length).fill(1)), {
      stride,
      padding
    });
    $('gradient').textContent = JSON.stringify({
      dKernel: gradient.dKernel,
      dBias: gradient.dBias
    }, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v, 2);
    const result = tinyCNNForward(baseInput);
    const tie = Math.abs(result.probabilities[0] - result.probabilities[1]) < 1e-12;
    $('cnn-result').textContent = [`Flatten（CHW 顺序） = [${Array.from(result.features, v => v.toFixed(3)).join(', ')}]`, `logits = [${Array.from(result.logits, v => v.toFixed(4)).join(', ')}]`, `竖线得分 ${(result.probabilities[0] * 100).toFixed(2)}% · 横线得分 ${(result.probabilities[1] * 100).toFixed(2)}%`, tie ? '两个得分相同，不能区分；底层 argmax 的并列规则取第一个类别。' : `最高得分类别：${result.label}`, `参数总数 ${result.parameterCount} = 卷积 20 + 全连接 18（含偏置）`].join('\n');
  } catch (error) {
    $('status').textContent = error.message;
    $('status').classList.add('error');
  }
}
['orientation', 'position'].forEach(id => $(id).addEventListener('change', () => {
  customInput = null;
  render();
}));
['channels', 'stride', 'padding', 'pool-mode'].forEach(id => $(id).addEventListener('change', render));
$('apply-matrix').addEventListener('click', () => {
  try {
    const matrix = JSON.parse($('matrix-input').value);
    if (!Array.isArray(matrix) || matrix.length !== 6 || matrix.some(row => !Array.isArray(row) || row.length !== 6)) {
      throw new Error('矩阵必须为 6 行，每行 6 个数字');
    }
    if (matrix.flat().some(v => !Number.isFinite(v) || v < 0 || v > 1)) {
      throw new Error('像素必须是 0 到 1 的有限数字');
    }
    customInput = tensor([1, 6, 6], matrix.flat());
    render();
  } catch (error) {
    $('status').textContent = `输入无效：${error.message}。下方保留上一次成功结果。`;
    $('status').classList.add('error');
  }
});
$('blank').addEventListener('click', () => {
  customInput = tensor([1, 6, 6]);
  render();
});
$('restore').addEventListener('click', () => {
  customInput = null;
  render();
});
render();
