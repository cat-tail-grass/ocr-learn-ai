import terms from './terms.mjs';
export const courseTerms = [...new Set(terms)].sort((left, right) => right.length - left.length);

const termSet = new Set(courseTerms);
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termPattern = courseTerms.length ? new RegExp(`(${courseTerms.map(escape).join('|')})`, 'gu') : null;
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

export function tokenizeCourseText(text, fieldName) {
  if (fieldName === 'id') return [text];
  const normalized = text.normalize('NFKC');
  return (termPattern ? normalized.split(termPattern) : [normalized]).flatMap(part => termSet.has(part) ? [part]
    : [...segmenter.segment(part)].filter(item => item.isWordLike).map(item => item.segment));
}

export const splitCourseQuery = async query => tokenizeCourseText(query);
