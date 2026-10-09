import { test } from 'vitest';
import { strict as assert } from 'node:assert';
import { normalizeModelsUrl, parseModelList } from '../src/services/models.ts';

test('derives the models endpoint from whatever the user typed', () => {
  assert.equal(normalizeModelsUrl('https://api.gpt.ge'), 'https://api.gpt.ge/v1/models');
  assert.equal(normalizeModelsUrl('https://api.gpt.ge/'), 'https://api.gpt.ge/v1/models');
  assert.equal(normalizeModelsUrl('https://api.gpt.ge/v1'), 'https://api.gpt.ge/v1/models');
  assert.equal(normalizeModelsUrl('  https://api.gpt.ge  '), 'https://api.gpt.ge/v1/models');
});

test('turns a chat endpoint into its sibling models endpoint', () => {
  assert.equal(normalizeModelsUrl('https://api.gpt.ge/v1/chat/completions'), 'https://api.gpt.ge/v1/models');
  assert.equal(normalizeModelsUrl('https://x.com/openai/chat/completions#'), 'https://x.com/openai/models');
  assert.equal(normalizeModelsUrl('https://api.gpt.ge/v1/models'), 'https://api.gpt.ge/v1/models', '已经是 models 就别再拼');
});

test('returns empty for a blank address', () => {
  assert.equal(normalizeModelsUrl(''), '');
  assert.equal(normalizeModelsUrl('   '), '');
  assert.equal(normalizeModelsUrl(null), '');
});

test('reads model ids out of every common response shape', () => {
  assert.deepEqual(parseModelList({ data: [{ id: 'gpt-4' }, { id: 'claude-3' }] }), ['claude-3', 'gpt-4']);
  assert.deepEqual(parseModelList({ models: ['b', 'a'] }), ['a', 'b']);
  assert.deepEqual(parseModelList(['solo']), ['solo']);
  assert.deepEqual(parseModelList({ data: [{ name: 'by-name' }] }), ['by-name']);
});

test('drops blanks and duplicates from the model list', () => {
  assert.deepEqual(parseModelList({ data: [{ id: 'dup' }, { id: 'dup' }, { id: '' }, { id: '  x  ' }] }), ['dup', 'x']);
  assert.deepEqual(parseModelList({}), []);
  assert.deepEqual(parseModelList(null), []);
  assert.deepEqual(parseModelList({ data: 'not-a-list' }), []);
});
