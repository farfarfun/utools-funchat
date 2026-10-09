// 数学公式分隔符识别。独立成模块是为了能脱离 DOM 单测——
// 这里的启发式（尤其是单个 $ 与金额的区分）最容易出错，必须有测试兜着。

const BLOCK_RULE = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])[ \t]*(?:\n+|$)/;
const PAREN_RULE = /^\\\(([\s\S]+?)\\\)/;
const DOUBLE_RULE = /^\$\$([\s\S]+?)\$\$/;
// 开头 $ 后不许是空白或另一个 $，结尾 $ 前不许是空白、其后不许紧跟数字。
// 于是 "$5 和 $10" 中被夹住的 "5 和 " 因结尾是空白而落选，不会被误判成公式。
const DOLLAR_RULE = /^\$(?![\s$])((?:[^$\n]|\\\$)+?)(?<!\s)\$(?!\d)/;

export type MathMatch = { raw: string; expression: string; display?: boolean };

/** 匹配开头的块级数学分隔符并返回原始文本与公式内容。 */
export function matchBlockMath(src: string): MathMatch | undefined {
  const match = BLOCK_RULE.exec(src);
  if (!match) return undefined;
  return { raw: match[0], expression: match[1] ?? match[2] };
}

/** 匹配开头的行内数学分隔符并返回公式内容。 */
export function matchInlineMath(src: string): MathMatch | undefined {
  const paren = PAREN_RULE.exec(src);
  if (paren) return { raw: paren[0], expression: paren[1], display: false };

  const double = DOUBLE_RULE.exec(src);
  if (double) return { raw: double[0], expression: double[1], display: true };

  const dollar = DOLLAR_RULE.exec(src);
  if (dollar) return { raw: dollar[0], expression: dollar[1], display: false };

  return undefined;
}

/** 返回下一个块级数学分隔符的位置。 */
export function findBlockStart(src: string): number | undefined {
  return src.match(/\$\$|\\\[/)?.index;
}

/** 返回下一个行内数学分隔符的位置。 */
export function findInlineStart(src: string): number | undefined {
  return src.match(/\$|\\\(/)?.index;
}
