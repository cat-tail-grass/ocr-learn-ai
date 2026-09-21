import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { projectRoot, readConfig, normalizeBase, existingInside, isMainModule } from './course-config.mjs';
import { prepareLabs } from './prepare-labs.mjs';

export function createPreviewServer(root, base = '/') {
  const prefix = normalizeBase(base);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
  return createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (prefix !== '/' && pathname === prefix.slice(0, -1)) { response.writeHead(308, { Location: prefix + url.search }).end(); return; }
      if (!pathname.startsWith(prefix)) { response.writeHead(404).end('Not found'); return; }
      let relative = pathname.slice(prefix.length) || 'index.html';
      if (relative.endsWith('/')) relative += 'index.html';
      const file = existingInside(root, relative);
      if (statSync(file).isDirectory()) { response.writeHead(308, { Location: pathname + '/' + url.search }).end(); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch { response.writeHead(404).end('Not found'); }
  });
}

async function main(mode) {
  if (!['dev', 'build', 'preview'].includes(mode)) throw new Error('用法：node scripts/site.mjs dev|build|preview');
  const base = normalizeBase(process.env.SITE_BASE || '/');
  const port = Number(process.env.SITE_PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SITE_PORT 应为 1–65535');
  const host = process.env.SITE_HOST || '127.0.0.1';
  const dest = path.resolve(projectRoot, process.env.SITE_DEST || '.vuepress/dist');
  if (mode === 'preview') {
    if (!existsSync(path.join(dest, 'index.html'))) throw new Error('请先运行 npm run build');
    const server = createPreviewServer(dest, base);
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, host, () => console.log(`课程预览：http://${host}:${port}${base}`));
    return;
  }
  const cli = path.join(projectRoot, 'node_modules/vuepress/bin/vuepress.js');
  if (!existsSync(cli)) throw new Error('缺少站点依赖，请先运行 npm ci');
  prepareLabs();
  const watchers = [];
  let timer;
  if (mode === 'dev') {
    const folders = [...readConfig().stages.flatMap(stage => stage.lessons).filter(lesson => lesson.status !== 'planned').map(lesson => lesson.slug), 'shared'];
    for (const folder of folders.filter(folder => existsSync(path.join(projectRoot, folder)))) {
      watchers.push(watch(path.join(projectRoot, folder), { recursive: true }, (_event, filename) => {
        if (!filename || /(?:^|[/\\])(?:node_modules|__tests__|\.git)(?:[/\\]|$)/.test(filename)) return;
        clearTimeout(timer);
        timer = setTimeout(() => { try { prepareLabs(); } catch (error) { console.error(`练习同步失败：${error.message}`); } }, 120);
      }));
    }
  }
  const child = spawn(process.execPath, [cli, mode, projectRoot, ...(mode === 'dev' ? ['--host', host, '--port', String(port)] : ['--dest', dest])], {
    cwd: projectRoot, stdio: 'inherit', env: { ...process.env, SITE_BASE: base },
  });
  const stop = signal => child.kill(signal);
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.once('SIGINT', onInterrupt); process.once('SIGTERM', onTerminate);
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => code === 0 || ['SIGINT', 'SIGTERM'].includes(signal)
        ? resolve() : reject(new Error(`站点${mode}失败，退出状态 ${code ?? signal}`)));
    });
  } finally {
    clearTimeout(timer); watchers.forEach(watcher => watcher.close());
    process.off('SIGINT', onInterrupt); process.off('SIGTERM', onTerminate);
  }
}

if (isMainModule(import.meta.url)) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
