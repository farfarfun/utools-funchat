import { strict as assert } from 'node:assert';
import { test } from 'vitest';
import { reactive } from 'vue';
import { clonePlain } from '../src/services/plain-clone.ts';

test('clones Vue reactive chat data as plain independent values', () => {
  const source = reactive({ messages: [{ role: 'user', content: 'hello' }] });
  const copy = clonePlain(source);

  assert.deepEqual(copy, { messages: [{ role: 'user', content: 'hello' }] });
  assert.notEqual(copy, source);
  source.messages[0].content = 'changed';
  assert.equal(copy.messages[0].content, 'hello');
});
