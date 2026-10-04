const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

type MessagePart = { text?: string; file?: { filename?: string } };
type MessageLike = string | { content?: string | MessagePart[] | null } | null | undefined;

/**
 * 提取消息中可展示和参与 Token 估算的文本。
 * @param message 字符串消息或包含文本、文件片段的消息对象。
 * @returns 拼接后的可见文本；无法提取时返回空字符串。
 */
export function messageText(message: MessageLike): string {
  if (typeof message === 'string') return message;
  if (typeof message?.content === 'string') return message.content;
  if (!Array.isArray(message?.content)) return '';
  return message.content.map((part) => part?.text || part?.file?.filename || '').join(' ');
}

/**
 * 按中日韩字符和 UTF-8 字节数粗略估算单条内容的 Token 数。
 * @param value 待估算的消息或文本内容。
 * @returns 非负整数 Token 估算值。
 */
export function estimateTokens(value: MessageLike): number {
  const text = messageText(value).replace(/\s+/gu, ' ').trim();
  if (!text) return 0;
  const cjkCount = text.match(CJK_PATTERN)?.length || 0;
  const other = text.replace(CJK_PATTERN, '').trim();
  return cjkCount + (other ? Math.ceil(new TextEncoder().encode(other).length / 4) : 0);
}

/**
 * 累加会话中全部消息的粗略 Token 数。
 * @param messages 要估算的消息可迭代对象。
 * @returns 会话总 Token 估算值。
 */
export function estimateConversationTokens(messages: Iterable<MessageLike>): number {
  return Array.from(messages, estimateTokens).reduce((total, count) => total + count, 0);
}
