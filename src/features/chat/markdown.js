import DOMPurify from 'dompurify';
import { marked } from 'marked';
import katex from 'katex';
import { findBlockStart, findInlineStart, matchBlockMath, matchInlineMath } from './math-delimiters.js';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return;
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'noopener noreferrer');
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMath(expression, displayMode) {
  try {
    return katex.renderToString(expression.trim(), {
      displayMode,
      throwOnError: false,
      // 只出 HTML 不出 MathML：少一套标签要过消毒，也避免读屏软件重复朗读两份内容
      output: 'html',
      strict: false,
    });
  } catch {
    // KaTeX 彻底失败时退回原文，宁可显示源码也不要把内容吞掉
    return escapeHtml(expression);
  }
}

// 块级：$$...$$ 与 \[...\]
const blockMath = {
  name: 'blockMath',
  level: 'block',
  start: findBlockStart,
  tokenizer(src) {
    const match = matchBlockMath(src);
    return match && { type: 'blockMath', ...match };
  },
  renderer(token) {
    return `<div class="math-block">${renderMath(token.expression, true)}</div>`;
  },
};

// 行内：\(...\)、段落中的 $$...$$、以及 $...$
const inlineMath = {
  name: 'inlineMath',
  level: 'inline',
  start: findInlineStart,
  tokenizer(src) {
    const match = matchInlineMath(src);
    return match && { type: 'inlineMath', ...match };
  },
  renderer(token) {
    return renderMath(token.expression, token.display);
  },
};

marked.use({ extensions: [blockMath, inlineMath] });

// KaTeX 靠 class 与内联 style 定位字形，消毒时必须放行，否则公式会散架
const SANITIZE_OPTIONS = { ADD_ATTR: ['class', 'style'] };

export function renderMarkdown(value) {
  return DOMPurify.sanitize(marked.parse(String(value ?? ''), { breaks: true }), SANITIZE_OPTIONS);
}
