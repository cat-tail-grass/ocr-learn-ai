import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { projectRoot } from '../.vuepress/catalog.mjs';

// 与实施前独立快照比较；任何模型、标签、报告字节变化均作为失败报告。
const baselinePath = resolve(projectRoot, 'artifacts/vuepress-integration/baseline/protected-artifacts.json');
const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const results = [];
for (const [file, original] of Object.entries(baseline)) {
  try {
    const bytes = await readFile(resolve(projectRoot, file));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    results.push({ file, sha256, unchanged: sha256 === original.sha256 && bytes.length === original.bytes });
  } catch (error) {
    results.push({ file, unchanged: false, error: error.message });
  }
}
const output = resolve(projectRoot, 'artifacts/vuepress-integration/final/protected-artifacts.json');
await mkdir(resolve(output, '..'), { recursive: true });
const failures = results.filter(row => !row.unchanged);
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), failures: failures.length, results }, null, 2) + '\n');
console.log(`模型与历史报告保护：${results.length - failures.length}/${results.length} 字节一致`);
if (failures.length) {
  console.error(failures);
  process.exitCode = 1;
}
