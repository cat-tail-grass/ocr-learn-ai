/** 三件套结构与直接运行检查。教学内容和页面行为仍需人工审查，不能用文件数代替质量。 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const execute = process.argv.includes('--execute');
const chapters = fs.readdirSync(root).filter(name => /^\d{2}-/.test(name) && Number(name.slice(0, 2)) >= 1 && Number(name.slice(0, 2)) <= 26).sort();
const outputOption = process.argv.indexOf('--output-dir');
if (outputOption !== -1 && !process.argv[outputOption + 1]) throw new Error('--output-dir 需要目录');
const out = outputOption === -1 ? path.join(root, 'artifacts', 'verification') : path.resolve(process.argv[outputOption + 1]);
fs.mkdirSync(out, { recursive: true });
let failures = 0;
const results = [];
for (const chapter of chapters) {
    const missing = ['README.md', 'index.html', 'index.js'].filter(file => !fs.existsSync(path.join(root, chapter, file)));
    const row = { chapter, missing, node: 'not-run', manualReview: 'see docs/reviews/2026-09-11/README.md' };
    if (missing.length) failures++;
    if (!missing.length && execute) {
        const result = spawnSync(process.execPath, [path.join(root, chapter, 'index.js')], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
        fs.writeFileSync(path.join(out, chapter + '.log'), (result.stdout || '') + (result.stderr || ''));
        row.node = result.status === 0 ? 'passed' : 'failed'; row.exitCode = result.status;
        if (result.error) row.error = result.error.message;
        if (row.node === 'failed') failures++;
    }
    results.push(row); console.log(`${chapter}: ${missing.length ? '缺少 ' + missing.join(', ') : '三件套齐全'}；Node ${row.node}`);
}
const numbers = new Set(chapters.map(chapter => Number(chapter.slice(0, 2))));
if (chapters.length !== 26 || numbers.size !== 26) { failures++; console.error(`应有第01–26章各一章，实际${chapters.length}章、${numbers.size}个编号`); }
fs.writeFileSync(path.join(out, 'lessons.json'), JSON.stringify({ createdAt: new Date().toISOString(), results, failures }, null, 2));
if (failures) process.exitCode = 1;
