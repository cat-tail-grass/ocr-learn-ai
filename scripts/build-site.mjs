import { spawn } from 'node:child_process';
import path from 'node:path';
import { isMainModule, resolveSiteOptions } from './lab-assets.mjs';
import { prepareLabs } from './prepare-labs.mjs';

export function runNode(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: options.root,
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
    });
    const forward = signal => child.kill(signal);
    const onInterrupt = () => forward('SIGINT');
    const onTerminate = () => forward('SIGTERM');
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);
    const cleanup = () => {
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);
    };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(Object.assign(new Error(`${args[0]} 失败（${signal || `退出码 ${code}`}）`), { exitCode: code || 1 }));
    });
  });
}

export async function buildSite(options = {}) {
  const settings = resolveSiteOptions(options);
  const env = {
    SITE_BASE: settings.base, SITE_PORT: String(settings.port),
    SITE_HOST: settings.host, SITE_DEST: settings.dest,
  };
  await runNode([path.join(settings.root, 'scripts/build.js')], { root: settings.root, env });
  await prepareLabs({ root: settings.root, quiet: options.quiet });
  await runNode([
    path.join(settings.root, 'node_modules/vuepress/bin/vuepress.js'),
    'build', settings.root, '--dest', settings.dest,
  ], { root: settings.root, env });
  return settings;
}

if (isMainModule(import.meta.url)) {
  buildSite().catch(error => { console.error(error.message); process.exitCode = error.exitCode || 1; });
}
