// 本轮浏览器装载检查；交互核验另见 browser-*.json。不会训练模型或写评估记录。
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const session = 'review-pages-20260911';
const chapters = fs.readdirSync(root).filter(name => /^\d{2}-/.test(name)).sort();
function browser(...args) {
  const processResult = spawnSync('npx', ['--yes', 'agent-browser', '--session', session, ...args, '--json'], { cwd: root, encoding: 'utf8', timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
  if (processResult.status !== 0) throw new Error(processResult.stderr || processResult.stdout);
  const response = JSON.parse(processResult.stdout);
  if (!response.success) throw new Error(JSON.stringify(response.error));
  return response.data;
}
const rows = [];
for (const chapter of chapters) {
  const row = { chapter };
  try {
    browser('open', `http://127.0.0.1:4173/${chapter}/`);
    browser('wait', '--load', 'networkidle');
    const state = browser('eval', 'JSON.stringify({title:document.title,readyState:document.readyState,heading:document.querySelector("h1")?.textContent,scripts:[...document.scripts].filter(s=>s.src).map(s=>s.src),canvases:document.querySelectorAll("canvas").length})');
    Object.assign(row, JSON.parse(state.result));
    row.errors = browser('errors', '--clear').errors;
    row.passed = row.readyState === 'complete' && !!row.heading && row.errors.length === 0;
  } catch (error) { row.passed = false; row.error = error.message; }
  rows.push(row);
  fs.writeFileSync(path.join(__dirname, 'browser-pages.json'), JSON.stringify({ createdAt: new Date().toISOString(), scope: '全部页面装载及浏览器运行错误；不等同于全部交互路径', rows }, null, 2));
  console.log(`${chapter}: ${row.passed ? 'passed' : JSON.stringify(row)}`);
}
if (rows.length !== 26 || rows.some(row => !row.passed)) process.exitCode = 1;
