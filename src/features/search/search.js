import { messageText } from '../chat/token-count.js';

function normalize(value) {
  return String(value || '').toLocaleLowerCase('zh-CN');
}

export function matchesHistoryQuery(record, query) {
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize(`${record.title || ''} ${record.messages.map(messageText).join(' ')}`);
  return terms.every((term) => haystack.includes(term));
}

export function filterHistoryRecords(records, query, limit = 30) {
  if (!normalize(query).trim()) return [];
  return records
    .filter((record) => matchesHistoryQuery(record, query))
    .sort((left, right) => right.sortKey - left.sortKey)
    .slice(0, limit);
}
