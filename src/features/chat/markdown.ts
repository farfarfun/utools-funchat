import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ref } from 'vue';
import { findBlockStart, findInlineStart, matchBlockMath, matchInlineMath } from './math-delimiters.ts';

type Katex = typeof import('katex')['default'];

// KaTeX（含 CSS）压缩前约 290 kB，占了主包的一半，但只有带公式的消息用得上。
// 改成首次遇到公式时才下载：renderMarkdown 是同步的且被用在 computed 里，所以这里
// 先出一个占位，加载完成后 bump 这个 ref 让依赖它的 computed 重新渲染一次。
let katex: Katex | null = null;
let loading: Promise<void> | null = null;
const katexRevision = ref(0);

function loadKatex(): void {
  if (katex || loading) return;
  loading = Promise.all([import('katex'), import('katex/dist/katex.min.css')])
    .then(([module]) => {
      katex = module.default;
      katexRevision.value += 1;
    })
    .catch(() => {
      // 下载失败就一直走占位分支，下次渲染还会再试一次
      loading = null;
    });
}

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
  if (!katex) {
    loadKatex();
    // 占位同样保留原文，加载完成前后内容一致，只是没有排版
    return `<code class="math-pending">${escapeHtml(expression.trim())}</code>`;
  }
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
  // 读一下版本号，使 KaTeX 到位后调用方的 computed 会自动再渲染一次
  void katexRevision.value;
  return DOMPurify.sanitize(marked.parse(String(value ?? ''), { breaks: true, async: false }), SANITIZE_OPTIONS);
}
