/** 构建每章浏览器入口。Node 与浏览器调用同一份算法，避免复制算法造成偏差。 */
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');

async function build() {
    const chapters = fs.readdirSync(root).filter(name => /^\d{2}-/.test(name));
    const entries = chapters.map(name => path.join(root, name, 'browser.js')).filter(fs.existsSync);
    for (const entry of entries) {
        await esbuild.build({
            entryPoints: [entry], bundle: true, platform: 'browser', target: ['es2020'],
            outfile: path.join(path.dirname(entry), 'bundle.js'), sourcemap: false,
            minify: true, legalComments: 'eof', logLevel: 'warning'
        });
        console.log(`已构建 ${path.relative(root, entry)}`);
    }
    if (!entries.length) throw new Error('未找到 browser.js 入口');
    console.log(`浏览器入口就绪：${entries.length} 个。npm run dev 启动课程站；npm run build 生成完整静态站点。`);
}
build().catch(error => { console.error(error); process.exitCode = 1; });
