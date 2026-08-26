import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateConversationTokens, estimateTokens, messageText } from '../src/features/chat/token-count.js';

test('reads text out of strings, plain messages and multi-part content', () => {
  assert.equal(messageText('直接的字符串'), '直接的字符串');
  assert.equal(messageText({ role: 'user', content: '普通消息' }), '普通消息');
  assert.equal(messageText({ content: [{ type: 'text', text: '看图' }, { type: 'image_url', image_url: { url: 'x' } }] }), '看图 ');
  assert.equal(messageText({ content: null }), '');
  assert.equal(messageText(undefined), '');
});

test('estimates empty, Latin, CJK, and mixed text', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('hello world'), 3);
  assert.equal(estimateTokens('你好世界'), 4);
  assert.equal(estimateTokens('你好 hello'), 4);
});

test('adds token estimates across conversation messages', () => {
  assert.equal(estimateConversationTokens(['hello world', '你好世界']), 7);
  assert.equal(estimateConversationTokens([]), 0);
});
