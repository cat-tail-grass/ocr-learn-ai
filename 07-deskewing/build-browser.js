// 只生成本章浏览器资源，不改动其他章节或全局包。
require('esbuild').buildSync({
    entryPoints: [require('path').join(__dirname, 'browser.js')],
    outfile: require('path').join(__dirname, 'bundle.js'),
    bundle: true, platform: 'browser', format: 'iife'
});
