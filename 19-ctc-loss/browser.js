'use strict';
const { ctcForwardBackward, enumeratePaths, greedyDecode, prefixBeamDecode } = require('../shared/19-ctc-loss');
const $ = id => document.getElementById(id), symbols = ['∅', '0', '1'];
const presets = {
    repeat: { p: [[0.2, 0.7, 0.1], [0.8, 0.1, 0.1], [0.1, 0.8, 0.1]], target: '00' },
    greedy: { p: [[0.4, 0.35, 0.25], [0.4, 0.35, 0.25]], target: '0' },
    impossible: { p: [[0.5, 0.4, 0.1], [0.4, 0.5, 0.1]], target: '00' },
    blank: { p: [[1, 0, 0], [1, 0, 0]], target: '' }
};
const asText = labels => labels.map(x => symbols[x]).join('') || '（空串）';
function run() {
    try {
        const rows = JSON.parse($('probabilities').value), text = $('target').value;
        if (!/^[01]*$/.test(text) || text.length > 20) throw new Error('目标只接受最多20位0/1，也可为空');
        if (!Array.isArray(rows) || rows.length > 80 || rows.some(row => !Array.isArray(row) || row.length !== 3)) throw new Error('页面接受最多80行，每行3列：[blank, 数字0, 数字1]');
        const target = [...text].map(x => Number(x) + 1), width = Number($('beam-width').value);
        if (width > 100) throw new Error('页面束宽限制为1–100');
        const dp = ctcForwardBackward(rows, target), greedy = greedyDecode(rows), beam = prefixBeamDecode(rows, 0, width);
        $('decoded').textContent = `贪婪路径：${greedy.path.map(x => symbols[x]).join(' ')}\n贪婪输出：${asText(greedy.labels)}\nPrefix beam 输出：${asText(beam[0].labels)}\n束中累计概率：${beam[0].probability.toPrecision(7)}（剪枝后的近似值，不是正确率）`;
        $('loss').textContent = `目标：${text || '空串'}；T=${rows.length}；最少帧数=${dp.minimumFrames}\nP(target|x)=${dp.probability.toPrecision(9)}；CTC loss=${dp.loss}\n状态序列：${dp.extended.map(x => symbols[x]).join(' ')}\n${dp.possible ? '存在合法对齐' : '没有合法且非零概率的对齐'}。目标标签仅参与损失计算，解码不读取目标。`;
        const body = $('alpha'); body.replaceChildren();
        dp.alpha.forEach((row, t) => { const tr = document.createElement('tr');
            [t, ...row].forEach(v => { const td = document.createElement('td'); td.textContent = v === -Infinity ? '−∞' : Number(v).toFixed(4); tr.appendChild(td); }); body.appendChild(tr); });
        const posteriorBody = $('posterior'); posteriorBody.replaceChildren();
        if (dp.possible) {
            dp.posterior.forEach((row, t) => {
                const tr = document.createElement('tr');
                const gradient = rows[t].map((p, k) => p - row[k]);
                [t, ...row, ...gradient].forEach(value => {
                    const td = document.createElement('td'); td.textContent = Number(value).toFixed(4); tr.appendChild(td);
                });
                posteriorBody.appendChild(tr);
            });
        }
        if (3 ** rows.length <= 100000) {
            const exact = enumeratePaths(rows, target, 0, 100000);
            $('enumeration').textContent = `独立枚举 ${exact.totalPaths} 条路径，其中 ${exact.matchingPaths} 条折叠为目标。总概率 ${exact.probability.toPrecision(9)}；与DP差值 ${Math.abs(exact.probability - dp.probability).toExponential(2)}。`;
        } else $('enumeration').textContent = '矩阵较长，跳过超过10万条的枚举；动态规划继续可用。';
        $('status').textContent = '已计算。修改目标标签时，解码结果应保持不变。';
    } catch (error) { $('status').textContent = error.message; $('decoded').textContent = ''; $('loss').textContent = ''; $('alpha').replaceChildren(); $('posterior').replaceChildren(); $('enumeration').textContent = ''; }
}
function preset() { const p = presets[$('preset').value]; $('probabilities').value = JSON.stringify(p.p, null, 2); $('target').value = p.target; run(); }
$('preset').addEventListener('change', preset); $('run').addEventListener('click', run);
$('reset').addEventListener('click', preset); preset();
