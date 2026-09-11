// 实际开发服务热更新验收；所有探针文件在 finally 中恢复原字节。
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const cli = process.env.AGENT_BROWSER_BIN;
if (!cli) throw new Error('需要 AGENT_BROWSER_BIN 指向 agent-browser.js');
const base = process.env.HMR_URL || 'http://127.0.0.1:4173/';
const pageFile = '04-binarization/README.md';
const browserFile = '04-binarization/browser.js';
const marker = 'OCR_SITE_HMR_CHECK_20260911';
const originals = new Map([[pageFile, await fs.readFile(pageFile)], [browserFile, await fs.readFile(browserFile)]]);
const probes = new Map();
const checks = [];
function browser(...args) {
  const result = spawnSync(process.execPath, [cli, '--session', 'vuepress-hmr', '--json', ...args], { encoding: 'utf8', timeout: 45000 });
  const parsed = JSON.parse(result.stdout);
  if (result.status !== 0 || !parsed.success) throw new Error(result.stderr || JSON.stringify(parsed));
  return parsed.data;
}
async function until(check) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error('热更新在 30 秒内未完成');
}
async function restore(file) {
  const current = await fs.readFile(file);
  if (!current.equals(originals.get(file)) && !current.equals(probes.get(file))) throw new Error(`探针期间 ${file} 有外部改动，保留现场，拒绝覆盖`);
  await fs.writeFile(file, originals.get(file));
}
try {
  browser('open', new URL('04-binarization/', base).href);
  browser('wait', '#content h1');
  probes.set(pageFile, Buffer.concat([originals.get(pageFile), Buffer.from(`\n\n${marker}\n`)]));
  await fs.writeFile(pageFile, probes.get(pageFile));
  await until(() => browser('eval', `document.querySelector('#content').textContent.includes('${marker}')`).result);
  checks.push({ name: 'original README updates the open reading page', pass: true });
  await restore(pageFile);
  await until(() => !browser('eval', `document.querySelector('#content').textContent.includes('${marker}')`).result);
  probes.set(browserFile, Buffer.concat([originals.get(browserFile), Buffer.from(`\ndocument.documentElement.dataset.hmrProbe = '${marker}';\n`)]));
  await fs.writeFile(browserFile, probes.get(browserFile));
  await until(async () => (await (await fetch(new URL('labs/04-binarization/bundle.js', base))).text()).includes(marker));
  browser('open', new URL('labs/04-binarization/index.html', base).href);
  await until(() => browser('eval', 'document.documentElement.dataset.hmrProbe').result === marker);
  checks.push({ name: 'browser source rebuilds, copies and runs in the experiment', pass: true });
  await restore(browserFile);
  await until(async () => !(await (await fetch(new URL('labs/04-binarization/bundle.js', base))).text()).includes(marker));
  checks.push({ name: 'restored source rebuilds clean experiment output', pass: true });
} finally {
  for (const file of originals.keys()) await restore(file);
  for (const [file, original] of originals) checks.push({ name: `${file} original bytes restored`, pass: (await fs.readFile(file)).equals(original), sha256: createHash('sha256').update(original).digest('hex') });
  await fs.writeFile('artifacts/vuepress-integration/final/hmr.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, checks }, null, 2) + '\n');
  browser('close');
}
console.log(JSON.stringify(checks));
