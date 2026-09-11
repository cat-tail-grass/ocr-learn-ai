/* 从本脚本的位置解析站点导航，根路径与 /ocr/ 等子目录共用同一份资源。 */
(() => {
    const scriptUrl = new URL(document.currentScript.src, document.baseURI);
    const labsRoot = new URL('../', scriptUrl);
    const packaged = labsRoot.pathname.endsWith('/labs/');
    const siteRoot = packaged ? new URL('../', labsRoot) : labsRoot;
    function connectNavigation() {
        for (const link of document.querySelectorAll('[data-course-catalog]')) link.href = siteRoot.href;
        for (const link of document.querySelectorAll('[data-course-doc]')) {
            const slug = link.dataset.courseDoc;
            if (/^\d{2}-[a-z0-9-]+$/.test(slug)) link.href = new URL(`${slug}/${packaged ? '' : 'README.md'}`, siteRoot).href;
        }
        for (const link of document.querySelectorAll('[data-course-lab]')) {
            const slug = link.dataset.courseLab;
            if (/^\d{2}-[a-z0-9-]+$/.test(slug)) link.href = new URL(`${slug}/index.html`, labsRoot).href;
        }
        // Scope these rules to navigation so the early chapters retain their experiment styles.
        if (!document.getElementById('course-navigation-style')) {
            const style = document.createElement('style');
            style.id = 'course-navigation-style';
            style.textContent = '.course-nav{box-sizing:border-box;display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:space-between;padding:14px 24px;margin:0 0 16px;background:#fff;color:#182b39;border-bottom:1px solid #dbe2df;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.course-nav a{color:#126451;text-decoration:none}.course-nav a:hover{text-decoration:underline}.course-nav .links{display:flex;flex-wrap:wrap;gap:8px 18px}.course-nav a:focus-visible{outline:3px solid #e0a54b;outline-offset:3px}@media(max-width:600px){.course-nav{padding:12px 16px}.course-nav .links{width:100%}}';
            document.head.append(style);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connectNavigation, { once: true });
    else connectNavigation();
})();
