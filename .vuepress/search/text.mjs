import { decodeHTML } from 'entities';

// The helper used by SlimSearch parses HTML with decodeEntities:false. Decode
// extracted HTML text once before indexing/storing it; leave already-plain page
// titles, custom fields and IDs alone. Rendering remains Vue's escaped text.
export function extractCourseSearchField(document, fieldName) {
  const value = document[fieldName];
  const isHtmlText = fieldName === 't' || (fieldName === 'h' && document.id.includes('#'));
  if (!isHtmlText) return value;
  if (Array.isArray(value)) return value.map(text => decodeHTML(text));
  return typeof value === 'string' ? decodeHTML(value) : value;
}
