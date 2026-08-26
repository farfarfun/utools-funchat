import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHistoryRecords, matchesHistoryQuery } from '../src/features/search/search.js';

const records = [
  { title: 'Vue 组件设计', messages: [], sortKey: 1 },
  { title: 'Vue 组件重构', messages: [{ role: 'user', content: '拆分 props' }], sortKey: 2 },
  { title: 'Python 脚本', messages: [], sortKey: 3 },
];

test('searches history text with multiple terms and sorts recent matches first', () => {
  assert.deepEqual(filterHistoryRecords(records, 'vue 组件'), [records[1], records[0]]);
});

test('searches message bodies, not just titles', () => {
  assert.deepEqual(filterHistoryRecords(records, 'props'), [records[1]]);
});

test('returns nothing for a blank global query and respects the limit', () => {
  assert.deepEqual(filterHistoryRecords(records, '   '), []);
  assert.equal(filterHistoryRecords(records, 'e', 1).length, 1);
});

test('the shared predicate keeps every record when the query is blank', () => {
  assert.equal(matchesHistoryQuery(records[0], ''), true);
  assert.equal(matchesHistoryQuery(records[0], '   '), true);
});

test('the shared predicate requires every term to match', () => {
  assert.equal(matchesHistoryQuery(records[1], 'vue 重构'), true);
  assert.equal(matchesHistoryQuery(records[1], 'vue python'), false);
});
