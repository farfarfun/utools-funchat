import { test } from 'vitest';
import { strict as assert } from 'node:assert';
import {
  buildUserContent,
  droppedImageCount,
  hasContent,
  imageUrls,
  withPrefix,
} from '../src/features/chat/message-content.ts';

test('keeps text-only messages as plain strings', () => {
  assert.equal(buildUserContent('  你好  '), '你好');
  assert.equal(buildUserContent('你好', []), '你好');
  assert.equal(buildUserContent('你好', ['', '']), '你好', '空地址不该把消息变成数组');
  assert.equal(buildUserContent(null), '');
});

test('wraps text and images into multi-part content', () => {
  assert.deepEqual(buildUserContent('看图', ['data:image/png;base64,AAA']), [
    { type: 'text', text: '看图' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
  ]);
});

test('allows an image-only message', () => {
  assert.deepEqual(buildUserContent('   ', ['a', 'b']), [
    { type: 'image_url', image_url: { url: 'a' } },
    { type: 'image_url', image_url: { url: 'b' } },
  ]);
});

test('only treats non-empty content as sendable', () => {
  assert.equal(hasContent('提问'), true);
  assert.equal(hasContent('   '), false);
  assert.equal(hasContent(''), false);
  assert.equal(hasContent(null), false);
  assert.equal(hasContent([{ type: 'image_url', image_url: { url: 'a' } }]), true);
  assert.equal(hasContent([]), false);
});

test('autoPrefix lands on the text part and never duplicates parts', () => {
  assert.equal(withPrefix('你好', '请翻译:'), '请翻译:你好');
  assert.equal(withPrefix('你好', ''), '你好', '空前缀应原样返回');
  assert.deepEqual(withPrefix([{ type: 'text', text: '这是什么' }, { type: 'image_url', image_url: { url: 'a' } }], '请翻译:'), [
    { type: 'text', text: '请翻译:这是什么' },
    { type: 'image_url', image_url: { url: 'a' } },
  ]);
});

test('autoPrefix adds a text part to an image-only message', () => {
  assert.deepEqual(withPrefix([{ type: 'image_url', image_url: { url: 'a' } }], '请翻译:'), [
    { type: 'text', text: '请翻译:' },
    { type: 'image_url', image_url: { url: 'a' } },
  ]);
});

test('withPrefix does not mutate the original content', () => {
  const content = [{ type: 'text', text: '原文' }];
  withPrefix(content, '前缀:');
  assert.equal(content[0].text, '原文');
});

test('reads image urls and counts the ones whose data was dropped', () => {
  const message = {
    content: [
      { type: 'text', text: '看图' },
      { type: 'image_url', image_url: { url: 'a' } },
      { type: 'image_url', image_url: { url: '' } },
    ],
  };
  assert.deepEqual(imageUrls(message), ['a']);
  assert.equal(droppedImageCount(message), 1);
  assert.deepEqual(imageUrls({ content: '纯文本' }), []);
  assert.deepEqual(imageUrls('字符串消息'), []);
  assert.equal(droppedImageCount(undefined), 0);
});
