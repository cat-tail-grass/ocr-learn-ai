import path from 'node:path';
import { chapters, pagePatterns, projectRoot, normalizeBase, withSiteBase } from '../catalog.mjs';

const pages = new Set(pagePatterns);
const chapterSlugs = new Set(chapters.map(chapter => chapter.slug));
const sourceRepository = 'https://github.com/cat-tail-grass/ocr-learn-ai';

function sourceFromEnvironment(env) {
  const source = env.filePathRelative || (env.filePath && path.relative(projectRoot, env.filePath));
  return source?.replaceAll('\\', '/') || 'README.md';
}

function pageRoute(source) {
  return `/${source}`.replace(/(?:^|\/)README\.md$/i, '/').replace(/\.md$/i, '.html');
}

function splitLink(href) {
  const separator = href.search(/[?#]/);
  return separator < 0 ? [href, ''] : [href.slice(0, separator), href.slice(separator)];
}

/** Classify a rendered Markdown URL without touching its source or code tokens. */
export function classifyCourseLink(href, env = {}) {
  if (!href || href.startsWith('#') || href.startsWith('?')) return { kind: 'anchor', href };
  const base = normalizeBase(env.base || '/');
  let [pathname, suffix] = splitLink(href);

  // These addresses originally opened the standalone course experiments.
  // Restrict rewriting to their known origin and chapter paths.
  if (/^https?:\/\//i.test(href)) {
    const url = new URL(href);
    const relative = decodeURI(url.pathname).replace(/^\/+/, '');
    const [slug, ...rest] = relative.split('/');
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
      && url.port === '4173' && !relative) {
      return { kind: 'page', href: withSiteBase('/', base) + url.search + url.hash, source: 'README.md' };
    }
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
      && url.port === '4173' && chapterSlugs.has(slug)) {
      const file = rest.filter(Boolean).join('/') || 'index.html';
      return {
        kind: file.endsWith('.html') ? 'lab' : 'asset',
        href: withSiteBase(`/labs/${slug}/${file}`, base) + url.search + url.hash,
        source: `${slug}/${file}`,
      };
    }
    return { kind: 'external', href };
  }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return { kind: 'external', href };

  pathname = decodeURI(pathname);
  if (base !== '/' && pathname.startsWith(base)) pathname = `/${pathname.slice(base.length)}`;
  if (pathname.startsWith('/labs/')) {
    return {
      kind: pathname.endsWith('.html') ? 'lab' : 'asset',
      href: withSiteBase(pathname, base) + suffix,
      source: pathname.slice('/labs/'.length),
    };
  }

  const source = path.posix.normalize(pathname.startsWith('/')
    ? pathname.slice(1)
    : path.posix.join(path.posix.dirname(sourceFromEnvironment(env)), pathname));
  if (source === '..' || source.startsWith('../')) return { kind: 'external', href };
  const normalizedSource = source.replace(/\/$/, '');
  const inferredPage = normalizedSource === '.' || normalizedSource === '' ? 'README.md'
    : chapterSlugs.has(normalizedSource) ? `${normalizedSource}/README.md`
      : source.endsWith('/') ? `${source}README.md` : source;

  if (pages.has(inferredPage)) {
    return { kind: 'page', href: withSiteBase(pageRoute(inferredPage), base) + suffix, source: inferredPage };
  }
  // Pages outside the explicit page set are source references, never new site pages.
  if (/\.md$/i.test(source) || source === 'openspec' || source.startsWith('openspec/')
    || source === 'artifacts' || source.startsWith('artifacts/')) {
    const mode = path.posix.extname(source) ? 'blob' : 'tree';
    return { kind: 'source', href: `${sourceRepository}/${mode}/main/${encodeURI(source)}${suffix}`, source };
  }
  // Already generated auxiliary routes remain reading links.
  const matchingPage = pagePatterns.find(page => pageRoute(page) === `/${source}`);
  if (matchingPage) return { kind: 'page', href: withSiteBase(`/${source}`, base) + suffix, source: matchingPage };

  return {
    kind: /\.html$/i.test(source) ? 'lab' : 'asset',
    href: withSiteBase(`/labs/${encodeURI(source)}`, base) + suffix,
    source,
  };
}

export function installCourseMarkdownLinks(md) {
  md.core.ruler.after('inline', 'ocr-course-links', state => {
    function visit(tokens) {
      const openLinks = [];
      for (const token of tokens) {
        if (token.type === 'link_open' || token.type === 'image') {
          const attribute = token.type === 'image' ? 'src' : 'href';
          const original = token.attrGet(attribute);
          const link = classifyCourseLink(original, state.env);
          token.meta = { ...token.meta, courseLink: { ...link, original } };
          token.attrSet(attribute, link.href);
          if (token.type === 'link_open') {
            const native = ['lab', 'asset'].includes(link.kind);
            openLinks.push(native);
            token.meta.courseNativeLink = native;
            if (native) token.attrSet('data-course-link', link.kind);
            if (link.kind === 'lab') {
              token.attrSet('target', '_blank');
              token.attrSet('rel', 'noopener noreferrer');
            }
          }
        } else if (token.type === 'link_close') {
          token.meta = { ...token.meta, courseNativeLink: openLinks.pop() || false };
        }
        if (token.children) visit(token.children);
      }
    }
    visit(state.tokens);
  });

  // HTML experiments and file downloads must bypass Vue Router, including .html.
  for (const type of ['link_open', 'link_close']) {
    const originalRule = md.renderer.rules[type];
    md.renderer.rules[type] = (tokens, index, options, env, renderer) => {
      if (tokens[index].meta?.courseNativeLink) return renderer.renderToken(tokens, index, options);
      return originalRule ? originalRule(tokens, index, options, env, renderer)
        : renderer.renderToken(tokens, index, options);
    };
  }
}

export const markdownLinksPlugin = () => ({
  name: 'ocr-course-markdown-links',
  extendsMarkdown: installCourseMarkdownLinks,
});
