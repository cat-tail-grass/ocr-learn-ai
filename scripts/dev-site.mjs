import { watch } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chapterSlugs, isMainModule, labAssets, resolveSiteOptions } from './lab-assets.mjs';
import { prepareLabs } from './prepare-labs.mjs';
import { runNode } from './build-site.mjs';

export async function devSite(options = {}) {
  const settings = resolveSiteOptions(options);
  const env = {
    SITE_BASE: settings.base, SITE_PORT: String(settings.port),
    SITE_HOST: settings.host, SITE_DEST: settings.dest,
  };
  const runtimeAssets = new Set(labAssets.map(asset => asset.source));
  let stopped = false, running = false, timer;
  const changes = new Set();
  const build = () => runNode([path.join(settings.root, 'scripts/build.js')], { root: settings.root, env });
  async function synchronize() {
    if (stopped || running || !changes.size) return;
    running = true;
    const files = [...changes];
    changes.clear();
    try {
      if (files.some(file => file.endsWith('.js'))) await build();
      await prepareLabs({ root: settings.root });
      console.log(`实验更新已同步：${files.join(', ')}。刷新实验页即可查看结果。`);
    } catch (error) {
      console.error(`实验更新失败，保留上次成功的资源：${error.message}`);
    } finally {
      running = false;
      if (changes.size && !stopped) timer = setTimeout(synchronize, 120);
    }
  }
  // README and VuePress files remain under VuePress's own page/HMR watcher.
  const watchers = [...chapterSlugs, 'shared'].map(directory => watch(
    path.join(settings.root, directory), { recursive: true }, (_event, filename) => {
      if (!filename || stopped) return;
      const relative = `${directory}/${String(filename).split(path.sep).join('/')}`;
      if (/(?:^|\/)(?:bundle\.js|__tests__|data|node_modules)(?:\/|$)/.test(relative)) return;
      if (!runtimeAssets.has(relative) && !relative.endsWith('.js')) return;
      changes.add(relative);
      clearTimeout(timer);
      timer = setTimeout(synchronize, 120);
    },
  ));
  const close = () => { stopped = true; clearTimeout(timer); watchers.forEach(watcher => watcher.close()); };
  try {
    // Watch before the initial build so changes made during startup are not lost.
    running = true;
    await build();
    await prepareLabs({ root: settings.root });
    running = false;
    if (changes.size) timer = setTimeout(synchronize, 120);
    const child = spawn(process.execPath, [
      path.join(settings.root, 'node_modules/vuepress/bin/vuepress.js'),
      'dev', settings.root, '--host', settings.host, '--port', String(settings.port),
    ], { cwd: settings.root, env: { ...process.env, ...env }, stdio: 'inherit' });
    const onInterrupt = () => { close(); child.kill('SIGINT'); };
    const onTerminate = () => { close(); child.kill('SIGTERM'); };
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0 || (stopped && signal)) resolve();
        else reject(Object.assign(new Error(`VuePress 开发服务退出：${signal || code}`), { exitCode: code || 1 }));
      });
    }).finally(() => { process.off('SIGINT', onInterrupt); process.off('SIGTERM', onTerminate); });
  } finally { close(); }
  return settings;
}

if (isMainModule(import.meta.url)) {
  devSite().catch(error => { console.error(error.message); process.exitCode = error.exitCode || 1; });
}
