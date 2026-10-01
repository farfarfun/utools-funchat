import { messageText } from '../chat/token-count.ts';

type HistoryRecord = {
  [key: string]: unknown;
  _id?: string;
  agentId?: string;
  title?: string;
  messages: unknown[];
  sortKey: number;
};

function normalize(value: unknown): string {
  return String(value || '').toLocaleLowerCase('zh-CN');
}

/**
 * 判断一条历史记录的标题或消息正文是否包含全部搜索词。
 * @param record 待匹配的历史记录。
 * @param query 以空白分隔的搜索词；空查询匹配所有记录。
 * @returns 全部搜索词均命中时返回 `true`。
 */
export function matchesHistoryQuery(record: HistoryRecord, query: unknown): boolean {
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize(`${record.title || ''} ${record.messages.map(messageText).join(' ')}`);
  return terms.every((term) => haystack.includes(term));
}

/**
 * 筛选历史记录，并按最新顺序限制返回数量。
 * @param records 候选历史记录。
 * @param query 搜索文本；空查询返回空数组。
 * @param limit 最大返回数量，默认为 30。
 * @returns 匹配且按 `sortKey` 降序排列的记录。
 */
export function filterHistoryRecords(records: HistoryRecord[], query: unknown, limit = 30): HistoryRecord[] {
  if (!normalize(query).trim()) return [];
  return records
    .filter((record) => matchesHistoryQuery(record, query))
    .sort((left, right) => right.sortKey - left.sortKey)
    .slice(0, limit);
}
