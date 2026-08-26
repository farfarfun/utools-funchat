import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLAPSE_THRESHOLD, formatTimestamp, isLongMessage } from '../src/features/chat/message-tools.js';

test('builds stable image timestamps', () => {
  assert.equal(formatTimestamp(new Date(2026, 0, 2, 3, 4, 5)), '20260102-030405');
});

test('only collapses messages above the long-message threshold', () => {
  assert.equal(isLongMessage('a'.repeat(COLLAPSE_THRESHOLD)), false);
  assert.equal(isLongMessage('a'.repeat(COLLAPSE_THRESHOLD + 1)), true);
  assert.equal(isLongMessage(''), false);
  assert.equal(isLongMessage(undefined), false);
});
