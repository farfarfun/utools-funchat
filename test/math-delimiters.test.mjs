import assert from 'node:assert/strict';
import test from 'node:test';
import { findBlockStart, findInlineStart, matchBlockMath, matchInlineMath } from '../src/features/chat/math-delimiters.js';

test('recognises $$ block math', () => {
  assert.equal(matchBlockMath('$$E = mc^2$$')?.expression, 'E = mc^2');
});

test('recognises \\[ \\] block math', () => {
  assert.equal(matchBlockMath('\\[x^2 + y^2 = z^2\\]')?.expression, 'x^2 + y^2 = z^2');
});

test('block math spans multiple lines', () => {
  const match = matchBlockMath('\\[\n\\frac{a}{b}\n= c\n\\]');
  assert.equal(match?.expression.trim(), '\\frac{a}{b}\n= c');
});

test('recognises \\( \\) inline math', () => {
  const match = matchInlineMath('\\(a \\ne b\\)');
  assert.equal(match?.expression, 'a \\ne b');
  assert.equal(match?.display, false);
});

test('recognises $ inline math', () => {
  const match = matchInlineMath('$x_1$');
  assert.equal(match?.expression, 'x_1');
  assert.equal(match?.display, false);
});

test('treats inline $$ as display math', () => {
  const match = matchInlineMath('$$\\sum_{i=1}^{n} i$$');
  assert.equal(match?.display, true);
});

test('does not treat currency amounts as math', () => {
  // "$5 和 $10" 里夹住的内容以空白结尾，必须落选
  assert.equal(matchInlineMath('$5 和 $10 一共 15'), undefined);
});

test('rejects $ pairs padded with whitespace', () => {
  assert.equal(matchInlineMath('$ x $'), undefined);
});

test('rejects unclosed delimiters', () => {
  assert.equal(matchBlockMath('\\[x^2 + y^2'), undefined);
  assert.equal(matchInlineMath('\\(a \\ne b'), undefined);
  assert.equal(matchInlineMath('$x_1'), undefined);
});

test('inline math consumes only its own delimiters', () => {
  const match = matchInlineMath('$a$ 加上 $b$');
  assert.equal(match?.expression, 'a');
  assert.equal(match?.raw, '$a$');
});

test('reports where math starts so marked can skip ahead', () => {
  assert.equal(findBlockStart('前面一段文字 $$x$$'), 7);
  assert.equal(findInlineStart('前面一段文字 \\(x\\)'), 7);
  assert.equal(findBlockStart('完全没有公式'), undefined);
});
