// Keep Chinese OCR terms whole even when Intl.Segmenter splits their components.
// The same tokenizer feeds build-time indexing and the browser query splitter.
export const courseTerms = [
  '类间方差', '类内方差', '梯度消失', '梯度爆炸', '反向传播', '链式法则',
  '自适应阈值', '交叉熵', '二值化', '灰度化', '连通域', '卷积神经网络',
  '循环神经网络', '注意力机制', '位置编码', '字符错误率', '整串准确率',
  '归一化', '训练集', '验证集', '测试集', '手写数字', '首次结果',
].sort((left, right) => right.length - left.length);

const termSet = new Set(courseTerms);
const termPattern = new RegExp(`(${courseTerms.join('|')})`, 'gu');
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

export function tokenizeCourseText(text, fieldName) {
  if (fieldName === 'id') return [text];
  return text.normalize('NFKC').split(termPattern).flatMap(part => termSet.has(part) ? [part]
    : [...segmenter.segment(part)].filter(item => item.isWordLike).map(item => item.segment));
}

export const splitCourseQuery = async query => tokenizeCourseText(query);
