/** Independent acceptance against a running, unmodified course site.
 * AGENT_BROWSER_BIN=/path/to/agent-browser.js node scripts/verify-course-site.mjs \
 *   --url http://127.0.0.1:4173/ --label dev-root --skip-search
 * Does not build, serve, or mutate shared source/model files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { labAssets } from './lab-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const normalized = value => String(value).replace(/\s+/g, '');
export function optionsFromArgs() {
  const argv = process.argv.slice(2);
  const value = (key, fallback) => argv.includes(key) ? argv[argv.indexOf(key) + 1] : fallback;
  const url = new URL(value('--url', 'http://127.0.0.1:4173/'));
  if (!url.pathname.endsWith('/')) throw new Error('--url must include the full base and end with /');
  const label = value('--label', 'manual');
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid artifact label');
  return { url, label, skipSearch: argv.includes('--skip-search'), onlySearch: argv.includes('--only-search'),
    deploymentOnly: argv.includes('--deployment-only'),
    session: value('--session', 'vuepress-d'), out: path.join(root, 'artifacts/vuepress-integration/D', label) };
}

export function createHarness(options, prefix = 'site') {
  fs.mkdirSync(options.out, { recursive: true });
  const binary = process.env.AGENT_BROWSER_BIN || 'agent-browser';
  const executable = binary.endsWith('.js') ? process.execPath : binary;
  const baseArgs = [...(binary.endsWith('.js') ? [binary] : []), '--session', options.session, '--json'];
  const transcript = path.join(options.out, `${prefix}-commands.jsonl`);
  fs.writeFileSync(transcript, '');
  function ab(...args) {
    const startedAt = new Date().toISOString();
    const run = spawnSync(executable, [...baseArgs, ...args], { encoding: 'utf8', timeout: 90000, maxBuffer: 32 * 1024 * 1024 });
    let result;
    try { result = JSON.parse(run.stdout); } catch { result = { success: false, stdout: run.stdout, stderr: run.stderr }; }
    fs.appendFileSync(transcript, JSON.stringify({ startedAt, command: ['agent-browser', ...baseArgs.slice(binary.endsWith('.js') ? 1 : 0), ...args], exit: run.status, result }) + '\n');
    if (run.error || run.status !== 0 || !result.success) throw new Error(`agent-browser ${args[0]} failed: ${run.error?.message || result.error || run.stderr || run.stdout}`);
    return result.data;
  }
  const evaluate = expression => ab('eval', expression).result;
  const checks = [];
  const check = (name, pass, detail) => { checks.push({ name, pass: Boolean(pass), detail }); if (!pass) console.error(`FAIL ${name}: ${JSON.stringify(detail)}`); };
  const save = (name, data) => fs.writeFileSync(path.join(options.out, name),
    name === 'chapters.json' && Array.isArray(data)
      ? '[\n' + data.map(chapter => JSON.stringify(chapter)).join(',\n') + '\n]\n'
      : JSON.stringify(data, null, 2) + '\n');
  const snapshot = name => { const result = ab('snapshot', '-i'); fs.writeFileSync(path.join(options.out, `${name}.txt`), result.snapshot); return result; };
  const screenshot = name => ab('screenshot', path.join(options.out, `${name}.png`));
  return { ab, evaluate, check, checks, save, snapshot, screenshot };
}

const inspectPage = `(() => {
  const content = document.querySelector('#content');
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const headings = all('h1,h2,h3,h4,h5,h6', content).map(x => ({ level: Number(x.tagName[1]), id: x.id, text: x.textContent.trim() }));
  const links = all('a[href]').map(x => ({ href: x.getAttribute('href'), text: x.textContent.trim(), target: x.target, rel: x.rel }));
  return { title: document.title, contentText: content?.textContent || '', headings,
    codes: all('pre code', content).map(x => x.textContent), details: all('details', content).length,
    math: all('.katex', content).length, mathErrors: all('.katex-error', content).map(x => x.textContent),
    toc: all('#course-chapter-toc .course-toc-nav a').map(x => decodeURIComponent(x.hash.slice(1))),
    previous: document.querySelector('.vp-page-nav .prev')?.getAttribute('href') || null,
    next: document.querySelector('.vp-page-nav .next')?.getAttribute('href') || null,
    command: document.querySelector('.course-node-command code')?.textContent,
    lab: document.querySelector('.course-lab-button') ? { href: document.querySelector('.course-lab-button').getAttribute('href'), target: document.querySelector('.course-lab-button').target, rel: document.querySelector('.course-lab-button').rel } : null,
    sidebarGroups: all('.vp-sidebar .vp-sidebar-heading').map(x => x.textContent.trim()),
    current: all('.vp-sidebar a.active,.vp-sidebar a[aria-current="page"]').map(x => x.getAttribute('href')),
    overlay: Boolean(document.querySelector('vite-error-overlay,[data-nextjs-dialog],#webpack-dev-server-client-overlay')),
    width: { viewport: innerWidth, document: document.documentElement.scrollWidth },
    modelLoads: performance.getEntriesByType('resource').filter(x => /\\/(?:model|models)\\/|weights\\.(?:bin|json)/.test(x.name)).map(x => x.name),
    resources: performance.getEntriesByType('resource').map(x => ({ url: x.name, status: x.responseStatus, type: x.initiatorType })), links };
})()`;

export async function verifySite(options = optionsFromArgs()) {
  const h = createHarness(options);
  const { ab, evaluate, check, save, snapshot, screenshot } = h;
  const route = relative => new URL(relative, options.url).href;
  const slugs = fs.readdirSync(root, { withFileTypes: true }).filter(x => x.isDirectory() && /^\d{2}-/.test(x.name)).map(x => x.name).sort();
  check('source has exactly 26 consecutive chapters', slugs.length === 26 && slugs.every((s, i) => Number(s.slice(0, 2)) === i + 1), slugs);
  const md = new MarkdownIt({ html: true });
  const pages = [];
  const resourceUrls = new Set();
  const addLocal = (href, currentUrl) => {
    if (!href || /^(?:data:|blob:|mailto:|javascript:)/.test(href)) return;
    const u = new URL(href, currentUrl); u.hash = '';
    if (u.origin === options.url.origin) resourceUrls.add(u.href);
  };
  if (!options.onlySearch) {
    ab('set', 'viewport', '1536', '1000');
    ab('open', options.url.href);
    ab('wait', '#course-catalog');
    const home = evaluate(`({ stages:document.querySelectorAll('.course-stage').length, chapters:[...document.querySelectorAll('.course-chapter-link')].map(x=>x.getAttribute('href')), labs:[...document.querySelectorAll('.course-catalog-lab')].map(x=>({href:x.getAttribute('href'),target:x.target})), text:document.body.innerText.slice(0,500), modelLoads:performance.getEntriesByType('resource').filter(x=>/\\/model\\/|weights\\.(bin|json)/.test(x.name)).map(x=>x.name) })`);
    check('home eight stages and complete source order', home.stages === 8 && JSON.stringify(home.chapters) === JSON.stringify(slugs.map(s => `${options.url.pathname}${s}/`)), home);
    check('home has 26 new-tab experiments; no model load', home.labs.length === 26 && home.labs.every(x => x.target === '_blank') && home.modelLoads.length === 0, home);
    snapshot('home'); screenshot('home-desktop'); save('home.json', home);
    // Review representative pages first, then every remaining source chapter.
    const ordered = ['04', '11', '17', '25'].map(id => slugs.find(x => x.startsWith(id))).concat(slugs.filter(x => !['04', '11', '17', '25'].includes(x.slice(0, 2))));
    for (const slug of ordered) {
      const index = slugs.indexOf(slug);
      const source = fs.readFileSync(path.join(root, slug, 'README.md'), 'utf8');
      const tokens = md.parse(source, {});
      const sourceHeadingLevels = tokens.filter(x => x.type === 'heading_open').map(x => Number(x.tag[1]));
      const sourceCodes = tokens.filter(x => ['fence', 'code_block'].includes(x.type)).map(x => x.content);
      const snippets = tokens.flatMap(x => x.type === 'inline' ? (x.children || []).filter(c => c.type === 'text').map(c => c.content) : [])
        .map(normalized).filter(x => x.length >= 28 && /[\u3400-\u9fff]/.test(x) && !/[\\${}]/.test(x));
      const url = route(`${slug}/`);
      ab('open', url); ab('wait', '#content h1');
      const page = evaluate(inspectPage);
      const missingSnippets = snippets.filter(x => !normalized(page.contentText).includes(x));
      check(`${slug}: full heading sequence`, JSON.stringify(sourceHeadingLevels) === JSON.stringify(page.headings.map(x => x.level)), { source: sourceHeadingLevels.length, actual: page.headings.length });
      if (!options.deploymentOnly) {
        check(`${slug}: every fenced/code block preserved`, JSON.stringify(sourceCodes) === JSON.stringify(page.codes), { source: sourceCodes.length, actual: page.codes.length });
        check(`${slug}: significant prose preserved`, missingSnippets.length === 0, { snippets: snippets.length, missing: missingSnippets });
      } else check(`${slug}: static/deployed full code block count`, sourceCodes.length === page.codes.length, { source: sourceCodes.length, actual: page.codes.length });
      check(`${slug}: details preserved`, page.details === (source.match(/<details(?:\s|>)/g) || []).length, page.details);
      const h23 = page.headings.filter(x => x.level === 2 || x.level === 3).map(x => x.id);
      check(`${slug}: all h2/h3 anchors in chapter toc`, h23.length > 0 && new Set(h23).size === h23.length && JSON.stringify(h23) === JSON.stringify(page.toc), { headings: h23.length, toc: page.toc.length });
      check(`${slug}: source-order previous/next and boundaries`, page.previous === (index ? `${options.url.pathname}${slugs[index - 1]}/` : null) && page.next === (index < 25 ? `${options.url.pathname}${slugs[index + 1]}/` : null), { previous: page.previous, next: page.next });
      check(`${slug}: current command and new-tab experiment`, page.command === `node ${slug}/index.js` && page.lab?.href === `${options.url.pathname}labs/${slug}/index.html` && page.lab.target === '_blank' && page.lab.rel.includes('noopener'), { command: page.command, lab: page.lab });
      check(`${slug}: no overflow, math parse error, overlay, or model loading`, page.width.document <= page.width.viewport + 1 && !page.overlay && page.mathErrors.length === 0 && page.modelLoads.length === 0, { width: page.width, mathErrors: page.mathErrors, modelLoads: page.modelLoads });
      check(`${slug}: eight-stage sidebar marks current chapter`, page.sidebarGroups.length === 8 && page.current.includes(`${options.url.pathname}${slug}/`), { groups: page.sidebarGroups, current: page.current });
      if (!options.deploymentOnly) {
        ab('set', 'viewport', '390', '844');
        page.mobileWidth = evaluate(`({viewport:innerWidth,document:document.documentElement.scrollWidth})`);
        check(`${slug}: mobile width fits`, page.mobileWidth.document <= page.mobileWidth.viewport + 1, page.mobileWidth);
        ab('set', 'viewport', '1536', '1000');
      }
      for (const { href } of page.links) addLocal(href, url);
      for (const resource of page.resources) addLocal(resource.url, url);
      if (['04', '11', '17', '25'].includes(slug.slice(0, 2))) { snapshot(`${slug}-desktop`); screenshot(`${slug}-desktop`); }
      pages.push({ slug, ...page, contentText: undefined, codes: page.codes.map(x => ({ length: x.length })), source: { headingCount: sourceHeadingLevels.length, codeCount: sourceCodes.length, proseSnippets: snippets.length }, missingSnippets });
      console.log(`Read ${slug}: ${page.headings.length} headings, ${page.codes.length} code blocks, ${page.math} formulae`);
    }
    save('chapters.json', pages);
    ab('open', route('04-binarization/')); ab('wait', '#content h1');
    ab('click', '.course-node-command button');
    check('Node command clipboard action', evaluate(`document.querySelector('.course-command-help').textContent.includes('运行命令已复制')`), evaluate(`document.querySelector('.course-command-help').textContent`));
    const tabsBefore = ab('tab', 'list');
    ab('click', '.course-lab-button');
    const tabsAfter = ab('tab', 'list'); save('new-tab.json', { tabsBefore, tabsAfter });
    check('Experiment really opens separate tab', (tabsAfter.tabs?.length || 0) === (tabsBefore.tabs?.length || 0) + 1, tabsAfter);
    ab('tab', tabsBefore.tabs.find(x => x.active).tabId);
    const tocTarget = evaluate(`document.querySelector('#content h3').id`);
    ab('click', `.course-toc-rail a[href="#${encodeURIComponent(tocTarget)}"]`);
    ab('wait', '--fn', `decodeURIComponent(location.hash.slice(1)) === ${JSON.stringify(tocTarget)}`);
    ab('wait', '--fn', `document.getElementById(${JSON.stringify(tocTarget)}).getBoundingClientRect().top < 240`);
    ab('wait', '--fn', `decodeURIComponent(document.querySelector('.course-toc-rail a[aria-current="location"]')?.hash.slice(1) || '') === ${JSON.stringify(tocTarget)}`);
    const anchor = evaluate(`({hash:decodeURIComponent(location.hash.slice(1)),top:document.getElementById(${JSON.stringify(tocTarget)}).getBoundingClientRect().top,active:[...document.querySelectorAll('.course-toc-rail a[aria-current="location"]')].map(x=>decodeURIComponent(x.hash.slice(1)))})`);
    check('h3 anchor scroll and reading position', anchor.hash === tocTarget && anchor.top >= 0 && anchor.top < 240 && anchor.active.includes(tocTarget), anchor); save('anchor.json', anchor);
    // A direct reload retains the deep, encoded anchor URL.
    ab('reload'); ab('wait', '#content h1');
    check('direct heading refresh', evaluate(`decodeURIComponent(location.hash.slice(1))`) === tocTarget, ab('get', 'url'));
    ab('open', route('07-deskewing/')); ab('wait', '.vp-page-nav .next'); ab('click', '.vp-page-nav .next');
    ab('wait', '--fn', `location.pathname === ${JSON.stringify(`${options.url.pathname}08-edge-detection/`)} && document.querySelector('.course-node-command code')?.textContent === 'node 08-edge-detection/index.js'`);
    check('cross-stage next navigation really reaches chapter 08', evaluate(`document.querySelector('.course-node-command code')?.textContent`) === 'node 08-edge-detection/index.js', evaluate('location.href'));
    for (const slug of ['04-binarization', '11-feature-extraction', '19-ctc-loss', '25-ocr-engine']) {
      ab('set', 'viewport', '390', '844'); ab('open', route(`${slug}/`)); ab('wait', '#content h1');
      const mobile = evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,details:!!document.querySelector('#course-chapter-toc'),menu:document.querySelector('.vp-toggle-sidebar-button')?.outerHTML,localScroll:[...document.querySelectorAll('#content pre,#content table,.katex-display')].filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>({tag:x.tagName,overflow:getComputedStyle(x).overflowX,width:x.clientWidth,scroll:x.scrollWidth})),math:document.querySelectorAll('#content .katex').length})`);
      check(`${slug}: mobile page constrained`, mobile.scroll <= mobile.width + 1 && mobile.details, mobile);
      ab('click', '#course-chapter-toc > summary');
      check(`${slug}: mobile chapter toc opens`, evaluate(`document.querySelector('#course-chapter-toc').open`), null);
      screenshot(`${slug}-mobile`); save(`${slug}-mobile.json`, mobile);
    }
    ab('click', '.vp-toggle-sidebar-button');
    check('mobile eight-stage navigation opens', evaluate(`document.querySelector('.vp-theme-container').classList.contains('sidebar-open') || document.querySelector('.vp-sidebar').getBoundingClientRect().left >= -1`), evaluate(`document.querySelector('.vp-sidebar').getBoundingClientRect().toJSON()`));
    snapshot('mobile-sidebar'); screenshot('mobile-sidebar');
    ab('click', '.vp-toggle-sidebar-button');
    ab('set', 'viewport', '1536', '1000'); ab('open', route('11-feature-extraction/')); ab('wait', '#content h1');
    const detailsCount = evaluate(`document.querySelectorAll('#content details').length`);
    if (detailsCount) { ab('click', '#content details:first-of-type > summary'); check('self-test answer expands', evaluate(`document.querySelector('#content details').open`), null); screenshot('11-self-test-open'); }
    ab('open', route('18-rnn-basics/')); ab('wait', '#content h1');
    const math = evaluate(`({display:document.querySelectorAll('#content .katex-display').length,matrices:document.querySelectorAll('#content .mtable').length,annotations:[...document.querySelectorAll('#content .katex annotation')].map(x=>x.textContent)})`);
    check('formulae include real display math and multiline alignment', math.display > 0 && math.matrices > 0, { display: math.display, matrices: math.matrices }); save('math.json', math);
    evaluate(`document.querySelector('#content .mtable').closest('.katex-display').scrollIntoView({block:'center',behavior:'instant'})`); screenshot('18-math');
    ab('open', route('11-feature-extraction/')); ab('wait', '#content h1');
    const beforeDark = evaluate(`({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor})`);
    ab('click', '.vp-toggle-color-mode-button');
    ab('wait', '--fn', `getComputedStyle(document.body).backgroundColor !== ${JSON.stringify(beforeDark.bg)}`);
    const afterDark = evaluate(`({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor})`);
    check('theme control changes rendered palette', beforeDark.bg !== afterDark.bg, { beforeDark, afterDark }); screenshot('11-alternate-theme');
    ab('click', '.vp-toggle-color-mode-button');
    const labPages = [];
    for (const slug of slugs) {
      const url = route(`labs/${slug}/index.html`); ab('open', url); ab('wait', '--load', 'networkidle');
      const lab = evaluate(`({url:location.href,title:document.title,text:document.body.innerText.slice(0,450),links:[...document.querySelectorAll('a[href]')].map(x=>({href:x.getAttribute('href'),text:x.textContent.trim()})),resources:performance.getEntriesByType('resource').map(x=>({url:x.name,status:x.responseStatus})),canvases:document.querySelectorAll('canvas').length,controls:document.querySelectorAll('button,input,select').length,overlay:!!document.querySelector('vite-error-overlay')})`);
      check(`${slug}: laboratory direct HTML refresh`, lab.text.length > 30 && !lab.overlay && lab.links.some(x => new URL(x.href, url).href === route(`${slug}/`)), { title: lab.title, controls: lab.controls, returnLink: lab.links.find(x => /返回本章讲义/.test(x.text)) });
      for (const { href } of lab.links) addLocal(href, url);
      for (const resource of lab.resources) addLocal(resource.url, url);
      labPages.push({ slug, ...lab });
    }
    save('labs.json', labPages);
    for (const asset of labAssets) resourceUrls.add(route(`labs/${asset.destination}`));
    const resources = [];
    const queue = [...resourceUrls];
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const url = queue.shift();
        try { const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) }); resources.push({ url, status: response.status, contentType: response.headers.get('content-type') }); }
        catch (error) { resources.push({ url, error: error.message }); }
      }
    }));
    resources.sort((a,b) => a.url.localeCompare(b.url)); save('http-resources.json', resources);
    check('all same-origin observed links and resources return HTTP success', resources.every(x => x.status >= 200 && x.status < 400), resources.filter(x => !(x.status >= 200 && x.status < 400)));
    const wrongTypes = resources.filter(x => {
      const pathname = new URL(x.url).pathname;
      if (!pathname.startsWith(`${options.url.pathname}labs/`)) return false;
      const expected = { '.json': /json/, '.js': /javascript/, '.css': /css/, '.html': /html/, '.png': /image\/png/, '.bin': /octet-stream/ }[path.extname(pathname)];
      return expected && !expected.test(x.contentType || '');
    });
    check('all 78 manifest assets have their actual resource content type', wrongTypes.length === 0, wrongTypes);
    if (options.url.pathname !== '/') check('same-origin resources keep deployment prefix', resources.every(x => new URL(x.url).pathname.startsWith(options.url.pathname)), resources.filter(x => !new URL(x.url).pathname.startsWith(options.url.pathname)));
    save('reading-labs-checkpoint.json', { timestamp: new Date().toISOString(), url: options.url.href, checks: h.checks, passed: h.checks.filter(x=>x.pass).length, failed: h.checks.filter(x=>!x.pass).length });
  }
  if (!options.skipSearch) {
    const searchBrowser = options.onlySearch ? h : createHarness({ ...options, session: `${options.session}-search` }, 'search');
    const { ab, evaluate, snapshot, screenshot } = searchBrowser;
    const search = [];
    for (const term of ['类间方差', '梯度消失', 'CTC', 'blank']) {
      ab('open', options.url.href); ab('wait', '#course-catalog');
      ab('click', 'button[aria-label="搜索课程"]');
      snapshot(`search-${term}-opened`);
      const input = evaluate(`[...document.querySelectorAll('input')].find(x=>x.type==='search' || /搜索/.test(x.placeholder))?.outerHTML`);
      if (!input) throw new Error('Search input missing');
      ab('fill', 'input[type="search"]', term);
      ab('wait', '--fn', `[...document.querySelectorAll('#slimsearch-results mark')].some(x=>x.textContent.toLowerCase().includes(${JSON.stringify(term.toLowerCase())}))`);
      const result = evaluate(`({text:document.querySelector('.slimsearch-modal')?.innerText,links:[...document.querySelectorAll('#slimsearch-results a[href]')].map(x=>({href:x.getAttribute('href'),text:x.textContent,body:!x.querySelector('.slimsearch-record-type')}))})`);
      check(`search ${term}: course body results`, result.links.some(x => /\/\d{2}-/.test(x.href) && x.body), result);
      check(`search ${term}: excerpts do not expose HTML entities`, !/&(?:quot|amp|lt|gt);/.test(result.text), result.text.slice(0,300));
      snapshot(`search-${term}`); screenshot(`search-${term}`);
      const first = result.links.find(x => /\/\d{2}-/.test(x.href) && x.body);
      if (first) {
        // Place long result groups in view before the real click. This avoids
        // measuring midway through the site's smooth scrolling animation.
        evaluate(`[...document.querySelectorAll('#slimsearch-results a')].find(x=>x.getAttribute('href')===${JSON.stringify(first.href)}).scrollIntoView({block:'center',behavior:'instant'})`);
        ab('find', 'first', `#slimsearch-results a[href=${JSON.stringify(first.href)}]`, 'click');
        const destinationSlug = new URL(first.href, options.url).pathname.split('/').find(x => /^\d{2}-/.test(x));
        ab('wait', '--fn', `document.querySelector('.course-node-command code')?.textContent === ${JSON.stringify(`node ${destinationSlug}/index.js`)} && (!location.hash || !!document.getElementById(decodeURIComponent(location.hash.slice(1))))`);
        const destination = evaluate(`({url:location.href,h1:document.querySelector('#content h1')?.textContent,hash:decodeURIComponent(location.hash.slice(1)),anchorExists:!location.hash || !!document.getElementById(decodeURIComponent(location.hash.slice(1)))})`);
        check(`search ${term}: result navigates to real course anchor`, destination.anchorExists && /\/\d{2}-/.test(destination.url), destination);
        result.destination = destination;
      }
      search.push({ term, ...result });
    }
    save('search.json', search);
    const searchErrors = ab('errors'), searchConsole = ab('console');
    save('search-browser-errors.json', searchErrors); save('search-browser-console.json', searchConsole);
    check('search session has no runtime or console errors', !(searchErrors.errors || []).length && !(searchConsole.messages || []).some(x=>x.type==='error'), { errors: searchErrors.errors, consoleErrors: (searchConsole.messages || []).filter(x=>x.type==='error') });
  }
  const errors = ab('errors'); const consoleLog = ab('console'); save('browser-errors.json', errors); save('browser-console.json', consoleLog);
  check('no uncaught browser runtime errors', !(errors.errors || []).length, errors);
  check('no browser console errors', !(consoleLog.messages || []).some(x => x.type === 'error'), (consoleLog.messages || []).filter(x => x.type === 'error'));
  const summary = { timestamp: new Date().toISOString(), url: options.url.href, label: options.label, independent: true, deploymentOnly: options.deploymentOnly, skippedSearch: options.skipSearch, checks: h.checks, passed: h.checks.filter(x=>x.pass).length, failed: h.checks.filter(x=>!x.pass).length };
  save('site-results.json', summary); console.log(JSON.stringify({ url: summary.url, passed: summary.passed, failed: summary.failed, output: options.out }));
  if (summary.failed) process.exitCode = 1;
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifySite();
