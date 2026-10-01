import { test } from 'vitest';
import { strict as assert } from 'node:assert';
import { COLLAPSE_THRESHOLD, formatTimestamp, isLongMessage } from '../src/features/chat/message-tools.ts';

test('builds stable image timestamps', () => {
  assert.equal(formatTimestamp(new Date(2026, 0, 2, 3, 4, 5)), '20260102-030405');
});

test('only collapses messages above the long-message threshold', () => {
  assert.equal(isLongMessage('a'.repeat(COLLAPSE_THRESHOLD)), false);
  assert.equal(isLongMessage('a'.repeat(COLLAPSE_THRESHOLD + 1)), true);
  assert.equal(isLongMessage(''), false);
  assert.equal(isLongMessage(undefined), false);
});
