import { messageText } from '../chat/token-count.ts';
import type { ChatMessage } from '../../types.ts';

// 只要求排序键和消息体，这样搜索既能用在完整的历史文档上，也能用在测试里的简化记录上。
type HistoryRecord = Record<string, any> & {
  title?: string;
  messages: ChatMessage[];
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
export function filterHistoryRecords<T extends HistoryRecord>(records: readonly T[], query: unknown, limit = 30): T[] {
  if (!normalize(query).trim()) return [];
  return records
    .filter((record) => matchesHistoryQuery(record, query))
    .sort((left, right) => right.sortKey - left.sortKey)
    .slice(0, limit);
}
