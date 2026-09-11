/** Serve only the final static output, mounted under the same SITE_BASE. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isMainModule, resolveSiteOptions } from './lab-assets.mjs';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.bin': 'application/octet-stream',
};

export async function previewSite(options = {}) {
  const settings = resolveSiteOptions(options);
  const root = await fs.realpath(settings.dest).catch(() => { throw new Error(`构建产物不存在：${settings.dest}。请先运行 npm run build。`); });
  await fs.access(path.join(root, 'index.html')).catch(() => { throw new Error(`产物缺少 index.html：${root}。请先完成站点构建。`); });
  const server = http.createServer(async (request, response) => {
    const fail = (code, message) => {
      response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); fail(405, '只提供静态读取'); return; }
      const url = new URL(request.url, 'http://preview.local');
      const pathname = decodeURIComponent(url.pathname);
      if (settings.base !== '/' && pathname === settings.base.slice(0, -1)) {
        response.writeHead(308, { Location: settings.base + url.search }); response.end(); return;
      }
      if (!pathname.startsWith(settings.base)) { fail(404, '此路径不属于站点部署目录'); return; }
      const relative = pathname.slice(settings.base.length);
      if (relative.split('/').some(part => part.startsWith('.') || part === 'node_modules') || relative.includes('\\') || relative.includes('\0')) { fail(403, '路径不可访问'); return; }
      let filename = path.resolve(root, relative);
      if (filename !== root && !filename.startsWith(root + path.sep)) { fail(403, '路径不可访问'); return; }
      const info = await fs.stat(filename);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(308, { Location: url.pathname + '/' + url.search }); response.end(); return;
        }
        filename = path.join(filename, 'index.html');
      }
      const real = await fs.realpath(filename);
      if (!real.startsWith(root + path.sep)) { fail(403, '路径不可访问'); return; }
      const body = await fs.readFile(real);
      response.writeHead(200, {
        'Content-Type': types[path.extname(real)] || 'application/octet-stream',
        'Content-Length': body.length, 'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) { fail(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 400, '资源不存在或路径无效'); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(settings.port, settings.host, resolve);
  });
  if (!options.quiet) console.log(`OCR 静态站点：http://${settings.host.includes(':') ? `[${settings.host}]` : settings.host}:${settings.port}${settings.base}\n产物：${root}`);
  return server;
}

if (isMainModule(import.meta.url)) {
  previewSite().catch(error => { console.error(error.message); process.exitCode = 1; });
}
