const root = new URL('../', import.meta.url);
const slug = location.pathname.split('/').filter(Boolean).at(-2);
const nav = document.createElement('nav');
nav.setAttribute('aria-label', '课程导航');
nav.style.cssText = 'display:flex;gap:24px;flex-wrap:wrap;padding:16px 24px;background:#fff;border-bottom:1px solid #dbe2df;font:15px system-ui;margin-bottom:24px';
for (const [label, url] of [['← 学习路径', new URL('../', root)], ['返回本章讲义', new URL(`../${slug}/`, root)]]) {
  const link = document.createElement('a'); link.textContent = label; link.href = url.href;
  link.style.color = '#126451'; nav.append(link);
}
document.body.prepend(nav);
