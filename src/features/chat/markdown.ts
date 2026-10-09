import DOMPurify from 'dompurify';
import { marked } from 'marked';
import katex from 'katex';
import { findBlockStart, findInlineStart, matchBlockMath, matchInlineMath } from './math-delimiters.ts';

DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
  if (node.tagName !== 'A') return;
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'noopener noreferrer');
});

type MathToken = { type: string; raw: string; expression: string; display?: boolean };

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMath(expression: string, displayMode: boolean): string {
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
  level: 'block' as const,
  start: findBlockStart,
  tokenizer(src: string) {
    const match = matchBlockMath(src);
    return match && { type: 'blockMath', ...match };
  },
  renderer(token: MathToken) {
    return `<div class="math-block">${renderMath(token.expression, true)}</div>`;
  },
};

// 行内：\(...\)、段落中的 $$...$$、以及 $...$
const inlineMath = {
  name: 'inlineMath',
  level: 'inline' as const,
  start: findInlineStart,
  tokenizer(src: string) {
    const match = matchInlineMath(src);
    return match && { type: 'inlineMath', ...match };
  },
  renderer(token: MathToken) {
    return renderMath(token.expression, Boolean(token.display));
  },
};

marked.use({ extensions: [blockMath, inlineMath] });

// KaTeX 靠 class 与内联 style 定位字形，消毒时必须放行，否则公式会散架
const SANITIZE_OPTIONS = { ADD_ATTR: ['class', 'style'] };

/**
 * 将用户输入渲染并净化为可安全插入界面的 HTML。
 * @param value 要渲染的 Markdown 内容。
 * @returns 经过消毒、可安全插入界面的 HTML 字符串。
 */
export function renderMarkdown(value: unknown): string {
  return DOMPurify.sanitize(marked.parse(String(value ?? ''), { breaks: true, async: false }), SANITIZE_OPTIONS);
}
