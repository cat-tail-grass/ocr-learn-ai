import path from 'node:path';
import { chapters, pagePatterns, projectRoot, siteBase, withSiteBase } from '../catalog.mjs';

const pages = new Set(pagePatterns);
const published = new Set(chapters.map(chapter => chapter.slug));
const pageRoute = source => `/${source}`.replace(/(?:^|\/)README\.md$/i, '/').replace(/\.md$/i, '.html');

export function classifyCourseLink(href, env = {}) {
  if (!href || /^(?:#|\?|\/\/|[a-z][a-z\d+.-]*:)/i.test(href)) return { kind: 'unchanged', href };
  const cut = href.search(/[?#]/);
  const suffix = cut < 0 ? '' : href.slice(cut);
  let pathname = decodeURI(cut < 0 ? href : href.slice(0, cut));
  if (siteBase !== '/' && pathname.startsWith(siteBase)) pathname = '/' + pathname.slice(siteBase.length);
  if (pathname.startsWith('/labs/')) return { kind: 'lab', href: withSiteBase(pathname, siteBase) + suffix };
  const current = env.filePathRelative || (env.filePath ? path.relative(projectRoot, env.filePath).replaceAll('\\', '/') : 'README.md');
  const source = path.posix.normalize(pathname.startsWith('/') ? pathname.slice(1) : path.posix.join(path.posix.dirname(current), pathname));
  if (source.startsWith('../') || source === '..') return { kind: 'unchanged', href };
  const trimmed = source.replace(/\/$/, '');
  const inferred = ['.', ''].includes(trimmed) ? 'README.md' : published.has(trimmed) ? `${trimmed}/README.md` : source;
  if (pages.has(inferred)) return { kind: 'page', href: withSiteBase(pageRoute(inferred), siteBase) + suffix };
  if (pagePatterns.some(page => pageRoute(page) === `/${source}`)) return { kind: 'page', href: withSiteBase(source, siteBase) + suffix };
  return { kind: 'lab', href: withSiteBase(`/labs/${source}`, siteBase) + suffix };
}

export const markdownLinksPlugin = () => ({
  name: 'learning-course-links',
  extendsMarkdown(md) {
    md.core.ruler.after('inline', 'learning-course-links', state => {
      const visit = tokens => {
        const links = [];
        for (const token of tokens) {
          if (token.type === 'link_open' || token.type === 'image') {
            const attribute = token.type === 'image' ? 'src' : 'href';
            const classified = classifyCourseLink(token.attrGet(attribute), state.env);
            token.attrSet(attribute, classified.href);
            if (token.type === 'link_open') {
              const native = classified.kind === 'lab';
              links.push(native);
              token.meta = { ...token.meta, courseNativeLink: native };
              if (native) { token.attrSet('target', '_blank'); token.attrSet('rel', 'noopener noreferrer'); }
            }
          } else if (token.type === 'link_close') token.meta = { ...token.meta, courseNativeLink: links.pop() || false };
          if (token.children) visit(token.children);
        }
      };
      visit(state.tokens);
    });
    for (const type of ['link_open', 'link_close']) {
      const original = md.renderer.rules[type];
      md.renderer.rules[type] = (tokens, index, options, env, renderer) => tokens[index].meta?.courseNativeLink
        ? renderer.renderToken(tokens, index, options)
        : original ? original(tokens, index, options, env, renderer) : renderer.renderToken(tokens, index, options);
    }
  },
});
