/** 仅绑定本机的静态课程服务，无上传接口。文件留在浏览器中处理。 */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.OCR_PORT || 4173);
const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.bin': 'application/octet-stream'
};
const server = http.createServer(async (req, res) => {
    try {
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const parts = pathname.split('/');
        if (parts.some(part => part.startsWith('.') || part === 'node_modules')) {
            res.writeHead(403); res.end('禁止访问'); return;
        }
        let filename = path.resolve(root, '.' + pathname);
        if (!filename.startsWith(root + path.sep) && filename !== root) throw new Error('invalid path');
        const stat = await fs.stat(filename);
        if (stat.isDirectory()) filename = path.join(filename, 'index.html');
        const real = await fs.realpath(filename);
        if (!real.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
        const body = await fs.readFile(real);
        res.writeHead(200, {
            'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
            'Content-Length': body.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff'
        });
        res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('资源不存在或路径无效。请先运行 npm run build。');
    }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`OCR 学习实验室：http://127.0.0.1:${port}`));
