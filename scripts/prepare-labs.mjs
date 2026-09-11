import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isMainModule, labAssets, projectRoot } from './lab-assets.mjs';

/** Copy the declared assets byte for byte, preserving every relative URL. */
export async function prepareLabs(options = {}) {
  const root = path.resolve(options.root || projectRoot);
  const outputDir = path.resolve(options.outputDir || path.join(root, '.vuepress/public/labs'));
  const assets = options.assets || labAssets;
  const destinations = new Set();
  const missing = [];
  let bytes = 0;
  for (const asset of assets) {
    for (const [key, value] of Object.entries({ source: asset.source, destination: asset.destination })) {
      if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error(`实验资源 ${key} 路径无效：${value}`);
      }
    }
    if (destinations.has(asset.destination)) throw new Error(`实验资源目标重复：${asset.destination}`);
    destinations.add(asset.destination);
    try {
      const info = await fs.stat(path.join(root, asset.source));
      if (!info.isFile()) throw new Error('不是普通文件');
      bytes += info.size;
    } catch (error) {
      missing.push(`${asset.source} (${error.code || error.message})`);
    }
  }
  if (missing.length) throw new Error(`实验资源缺失，装配已停止：\n${missing.map(file => `  - ${file}`).join('\n')}\n请先运行 npm run build:labs。`);
  if (outputDir === root || root.startsWith(`${outputDir}${path.sep}`)) throw new Error('实验资源输出目录不可覆盖源码根目录');
  const staging = `${outputDir}.stage-${randomUUID()}`;
  const previous = `${outputDir}.previous-${randomUUID()}`;
  let movedPrevious = false;
  let published = false;
  try {
    for (const asset of assets) {
      const target = path.join(staging, asset.destination);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(root, asset.source), target);
    }
    try {
      await fs.rename(outputDir, previous);
      movedPrevious = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await fs.rename(staging, outputDir);
    published = true;
    if (movedPrevious) await fs.rm(previous, { recursive: true, force: true });
  } catch (error) {
    if (movedPrevious && !published) await fs.rename(previous, outputDir);
    throw error;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
  const result = { outputDir, files: assets.length, bytes };
  if (!options.quiet) console.log(`实验资源已装配：${result.files} 个文件 → ${path.relative(root, outputDir) || outputDir}`);
  return result;
}

if (isMainModule(import.meta.url)) {
  prepareLabs().catch(error => { console.error(error.message); process.exitCode = 1; });
}
