import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createMarkdown } from '@vuepress/markdown';
import { markdownMathPlugin } from '@vuepress/plugin-markdown-math';
import { INDEX_FIELD_CONFIG } from '@vuepress/plugin-slimsearch';
import { loadJSONIndex, search } from 'slimsearch';
import { compileTemplate } from '@vue/compiler-sfc';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { cheerio } from '@vuepress/helper';
import { chapters, projectRoot, pagePatterns } from '../.vuepress/catalog.mjs';
import { courseMathOptions } from '../.vuepress/content-config.mjs';
import { classifyCourseLink, installCourseMarkdownLinks } from '../.vuepress/plugins/markdown-links.mjs';
import { courseSearchOptions, createCourseSearchPlugin } from '../.vuepress/search/options.mjs';
import { splitCourseQuery } from '../.vuepress/search/tokenize.mjs';
import { extractCourseSearchField } from '../.vuepress/search/text.mjs';

const evidenceDir = path.join(projectRoot, 'artifacts/vuepress-integration/C');
const results = { generatedAt: new Date().toISOString(), chapters: [], links: [], searches: [], checks: [] };
function check(name, callback) { callback(); results.checks.push(name); }
const md = createMarkdown({ headers: { level: [2, 3] }, vPre: { block: true, inline: true } });
await markdownMathPlugin(courseMathOptions)({ options: { markdown: {} } }).extendsMarkdown(md);
installCourseMarkdownLinks(md);
const control = createMarkdown({ headers: { level: [2, 3] }, vPre: { block: true, inline: true } });
const mathControl = createMarkdown({ headers: { level: [2, 3] }, vPre: { block: true, inline: true } });
await markdownMathPlugin(courseMathOptions)({ options: { markdown: {} } }).extendsMarkdown(mathControl);
function flattened(tokens) { return tokens.flatMap(token => [token, ...flattened(token.children || [])]); }
function codeTokens(tokens) {
  return flattened(tokens).filter(token => ['fence', 'code_block', 'code_inline'].includes(token.type))
    .map(token => ({ type: token.type, content: token.content, info: token.info }));
}
const renderedPages = [];
for (const chapter of chapters) {
  const source = await readFile(path.join(projectRoot, chapter.source), 'utf8');
  const referenceTokens = control.parse(source, {});
  const reference = flattened(referenceTokens);
  const originalContent = flattened(mathControl.parse(source, {})).map(token => ({ type: token.type, content: token.content }));
  let summary;
  for (const base of ['/', '/ocr/']) {
    const env = { base, filePathRelative: chapter.source, filePath: path.join(projectRoot, chapter.source) };
    const tokens = md.parse(source, env);
    const html = md.renderer.render(tokens, md.options, env);
    const $ = cheerio.load(html);
    check(`${chapter.id} ${base}: literal code, headings, details, tables, math and Vue template`, () => {
      assert.deepEqual(codeTokens(tokens), codeTokens(referenceTokens), `${chapter.source}: code source changed`);
      assert.deepEqual(flattened(tokens).map(token => ({ type: token.type, content: token.content })), originalContent,
        `${chapter.source}: prose, math or example content changed`);
      const expectedHeadings = reference.filter(token => token.type === 'heading_open');
      assert.equal($('h1,h2,h3,h4,h5,h6').length, expectedHeadings.length);
      assert.equal($('table').length, reference.filter(token => token.type === 'table_open').length);
      assert.equal($('details').length, (source.match(/<details\b/g) || []).length);
      assert.equal($('summary').length, $('details').length);
      assert.equal($('.katex').length, (source.match(/^\s*\\\[/gm) || []).length);
      assert.equal($('.katex-error').length, 0);
      assert.equal($('pre').length, reference.filter(token => ['fence', 'code_block'].includes(token.type)).length);
      const originalCode = reference.filter(token => ['fence', 'code_block'].includes(token.type));
      $('pre code').each((index, element) => assert.equal($(element).text(), originalCode[index].content));
      assert.equal($('pre').filter((_, element) => $(element).attr('v-pre') === undefined).length, 0);
      const anchors = $('h1,h2,h3,h4,h5,h6').map((_, element) => $(element).attr('id')).get();
      assert.equal(new Set(anchors).size, anchors.length);
      assert.equal(compileTemplate({ source: html, filename: chapter.source, id: `course-${chapter.id}` }).errors.length, 0);
      $('a[data-course-link="lab"]').each((_, element) => {
        assert.equal($(element).attr('target'), '_blank');
        assert.ok($(element).attr('href').startsWith(`${base}labs/`));
      });
      assert.equal($('routelink').filter((_, element) => $(element).attr('to')?.includes('/labs/')).length, 0);
    });
    if (base === '/') {
      summary = {
        id: chapter.id, source: chapter.source, sha256: createHash('sha256').update(source).digest('hex'),
        lines: source.split('\n').length, bytes: Buffer.byteLength(source),
        headings: $('h2,h3').length, codeBlocks: $('pre').length, tables: $('table').length,
        details: $('details').length, formulas: $('.katex').length, renderedBytes: Buffer.byteLength(html),
        firstHeading: $('h1').text(), lastHeading: $('h2,h3').last().text(), status: 'passed',
      };
      for (const token of flattened(tokens)) if (token.meta?.courseLink) {
        results.links.push({ page: chapter.source, ...token.meta.courseLink });
      }
      renderedPages.push({ path: chapter.docPath, pathLocale: '/', filePathRelative: chapter.source,
        title: chapter.title, frontmatter: {}, data: {}, contentRendered: html });
    }
  }
  results.chapters.push(summary);
}

for (const base of ['/', '/ocr/']) {
  const env = { base, filePathRelative: '25-ocr-engine/README.md' };
  check(`${base}: link classification and base`, () => {
    for (const [input, kind, output] of [
      ['../17-cnn-classifier/README.md#heading', 'page', `${base}17-cnn-classifier/#heading`],
      ['../docs/SHARING_GUIDE.md', 'page', `${base}docs/SHARING_GUIDE.html`],
      ['../README.md', 'page', base],
      ['http://127.0.0.1:4173/#course-catalog', 'page', `${base}#course-catalog`],
      ['index.html?q=1#demo', 'lab', `${base}labs/25-ocr-engine/index.html?q=1#demo`],
      ['http://127.0.0.1:4173/17-cnn-classifier/', 'lab', `${base}labs/17-cnn-classifier/index.html`],
      ['../17-cnn-classifier/model/training-report.json', 'asset', `${base}labs/17-cnn-classifier/model/training-report.json`],
      ['../openspec/backlog/real-photo-validation.md', 'source', 'https://github.com/cat-tail-grass/ocr-learn-ai/blob/main/openspec/backlog/real-photo-validation.md'],
      ['../artifacts/review-2026-09-11/jest.log', 'source', 'https://github.com/cat-tail-grass/ocr-learn-ai/blob/main/artifacts/review-2026-09-11/jest.log'],
      ['https://example.com/README.md', 'external', 'https://example.com/README.md'],
      ['http://127.0.0.1:4174/config', 'external', 'http://127.0.0.1:4174/config'],
      ['#本章', 'anchor', '#本章'],
    ]) {
      const actual = classifyCourseLink(input, env);
      assert.equal(actual.kind, kind, input); assert.equal(actual.href, output, input);
    }
    assert.equal(classifyCourseLink('index.html', { base, filePath: path.join(projectRoot, '25-ocr-engine/README.md') }).href,
      `${base}labs/25-ocr-engine/index.html`);
    const routeHtml = md.render('[章节](../17-cnn-classifier/README.md) [首页](http://127.0.0.1:4173/)', env);
    assert.match(routeHtml, /<RouteLink to="\/17-cnn-classifier\/">/);
    assert.match(routeHtml, /<RouteLink to="\/">/);
    assert.ok(!routeHtml.includes('to="/ocr/'), 'RouteLink must receive a route without the site base');
  });
}

const fixture = String.raw`# 兼容性夹具

行内美元 $x_1^2$ 和括号 \(y^3\)。

$$
\begin{bmatrix}1&2\\3&4\end{bmatrix}
$$

\[
\begin{aligned}a&=b+c\\d&=e-f\end{aligned}
\]

\[
f(x)=\begin{cases}0&x<0\\1&x\ge0\end{cases}
\]

<details><summary>查看答案</summary>

答案 **保留 Markdown 加粗**。

</details>

| 向量 | 模板 |
| --- | --- |
| A → B | \{{ untouched \}} |
` + '\n```text\n[链接](../17-cnn-classifier/README.md)\nhttp://127.0.0.1:4173/25-ocr-engine/\n\\[literal\\]\n{{ untouched }}\nA → B → C\n```\n';
const fixtureHtml = md.render(fixture, { base: '/ocr/', filePathRelative: '25-ocr-engine/README.md' });
check('bracket/dollar, matrix, aligned, cases, details, ASCII, code fixture', () => {
  const $ = cheerio.load(fixtureHtml);
  assert.equal($('.katex').length, 5); assert.equal($('.katex-error').length, 0);
  assert.equal($('details strong').text(), '保留 Markdown 加粗');
  assert.match($('pre').text(), /\[链接\]\(\.\.\/17-cnn-classifier\/README\.md\)/);
  assert.match($('pre').text(), /http:\/\/127\.0\.0\.1:4173\/25-ocr-engine\//);
  assert.match($('pre').text(), /\{\{ untouched \}\}/);
});

// Exercise the installed plugin's own HTML extractor and index writer in memory.
// This does not build the site or touch its public, temp or dist directories.
const written = {};
const app = {
  env: { isDebug: false, isDev: true, isBuild: false },
  options: { lang: 'zh-CN', locales: {} }, siteData: { lang: 'zh-CN', locales: {} },
  pages: renderedPages,
  writeTemp: async (filename, content) => { written[filename] = content; return filename; },
};
const searchPlugin = createCourseSearchPlugin()(app);
await searchPlugin.onInitialized(); await searchPlugin.onPrepared();
const serializedIndex = JSON.parse(written['slimsearch/root.js'].replace(/^export default /, ''));
const index = loadJSONIndex(serializedIndex, INDEX_FIELD_CONFIG);
const paths = JSON.parse(written['slimsearch/store.js'].replace(/^export const store = /, ''));
const beforeHmr = index.documentCount;
await searchPlugin.onPageUpdated(null, 'update', app.pages[1], app.pages[1]);
const afterHmr = loadJSONIndex(JSON.parse(written['slimsearch/root.js'].replace(/^export default /, '')), INDEX_FIELD_CONFIG);
check('editing page 1 preserves pages 10–19 in the search index', () => {
  assert.equal(afterHmr.documentCount, beforeHmr);
  assert.deepEqual([...afterHmr._documentIds.values()].sort(), [...index._documentIds.values()].sort());
});
results.hotReload = { beforeDocuments: beforeHmr, afterDocuments: afterHmr.documentCount, status: 'passed' };
for (const [query, expected] of [
  ['类间方差', '/04-binarization/'], ['梯度消失', '/18-rnn-basics/'],
  ['CTC', '/19-ctc-loss/'], ['blank', '/19-ctc-loss/'],
]) {
  const terms = await splitCourseQuery(query);
  const matches = search(afterHmr, terms.join(' '), { combineWith: 'and', prefix: true, boost: { h: 2, t: 1 } });
  const hits = matches.map(match => ({
    route: paths[match.id.split('#')[0]] + (match.id.includes('#') ? `#${match.id.split('#')[1]}` : ''),
    heading: match.h, bodyMatch: Object.values(match.match).some(fields => fields.includes('t')),
  }));
  check(`full body search: ${query}`, () => {
    assert.ok(hits.some(hit => hit.route.startsWith(expected) && hit.bodyMatch), `${query}: expected正文命中 ${expected}`);
    for (const hit of hits) {
      const [route, anchor] = hit.route.split('#');
      const page = renderedPages.find(page => page.path === route);
      assert.ok(page, hit.route);
      if (anchor) assert.ok(cheerio.load(page.contentRendered)(`[id="${anchor}"]`).length, hit.route);
    }
  });
  results.searches.push({ query, terms, totalSectionMatches: hits.length, expected, hits: hits.slice(0, 12) });
}
check('Chinese UI and explicit page scope', () => {
  assert.equal(searchPlugin.define.__SLIMSEARCH_LOCALES__['/'].placeholder, '搜索课程与正文');
  assert.equal(courseSearchOptions.indexContent, true);
  assert.equal(courseSearchOptions.filter({ filePathRelative: 'openspec/specs/test.md' }), false);
  assert.equal(pagePatterns.filter(source => /^\d\d-.*\/README\.md$/.test(source)).length, 26);
});

const quotedExcerpt = search(afterHmr, '类间方差', { prefix: true }).flatMap(match => match.t || [])
  .find(text => text.includes('前景均值和背景均值之间'));
check('real Otsu search snippet displays quotes as text', () => {
  assert.ok(quotedExcerpt, 'Expected the full Otsu body excerpt');
  assert.ok(quotedExcerpt.includes('"距离"'), quotedExcerpt);
  assert.ok(!quotedExcerpt.includes('&quot;距离&quot;'), quotedExcerpt);
});

const encodedText = '类间方差 &quot;距离&quot; &#39;单引号&#39; &#x22;十六进制&#x22; &amp; &amp;quot; &lt;img src=x onerror=alert(1)&gt; &lt;script&gt;alert(1)&lt;/script&gt;';
const entityInput = { id: '0#entities', h: '类间方差 &quot;标题&quot;', t: [encodedText] };
const decodedText = extractCourseSearchField(entityInput, 't')[0];
check('decode HTML entity text exactly once without changing IDs or plain fields', () => {
  assert.equal(decodedText, '类间方差 "距离" \'单引号\' "十六进制" & &quot; <img src=x onerror=alert(1)> <script>alert(1)</script>');
  assert.equal(extractCourseSearchField(entityInput, 'h'), '类间方差 "标题"');
  assert.equal(extractCourseSearchField(entityInput, 'id'), '0#entities');
  assert.equal(extractCourseSearchField({ id: '0', h: '字面 &quot;标题&quot;' }, 'h'), '字面 &quot;标题&quot;');
  assert.equal(extractCourseSearchField({ id: '0@0', c: '字面 &quot;自定义&quot;' }, 'c'), '字面 &quot;自定义&quot;');
  assert.equal(entityInput.t[0], encodedText, 'Original index source must not be mutated');
});

// Exercise the same text/mark VNodes used by SlimSearch's SearchResult component.
// Entity decoding never changes a string into HTML or a user-controlled tag.
const displayedWords = [['mark', '类间方差'], decodedText.slice('类间方差'.length)];
const safeSnippetHtml = await renderToString(createSSRApp({
  render: () => h('div', displayedWords.map(word => typeof word === 'string' ? word : h(word[0], word[1]))),
}));
check('Vue search text keeps highlighting and escapes decoded markup', () => {
  const $ = cheerio.load(safeSnippetHtml);
  assert.equal($('mark').length, 1); assert.equal($('mark').text(), '类间方差');
  assert.equal($('img,script').length, 0);
  assert.equal($('body > div').text(), decodedText);
  assert.ok(safeSnippetHtml.includes('&lt;img'));
  assert.ok(safeSnippetHtml.includes('&amp;quot;'), 'An intentionally literal entity remains literal after one decode');
});
results.searchText = { quotedExcerpt, decodedText, safeSnippetHtml, status: 'passed' };

await mkdir(evidenceDir, { recursive: true });
await writeFile(path.join(evidenceDir, 'content-verification.json'), JSON.stringify(results, null, 2) + '\n');
await writeFile(path.join(evidenceDir, 'compatibility-fixture.html'), fixtureHtml);
console.log(`PASS ${results.checks.length} checks; ${chapters.length} complete chapters; ${results.chapters.reduce((sum, chapter) => sum + chapter.formulas, 0)} formulas; 4 body queries.`);
console.log(`Evidence: ${path.relative(projectRoot, evidenceDir)}/content-verification.json`);
