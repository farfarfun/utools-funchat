const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

export function messageText(message) {
  if (typeof message === 'string') return message;
  if (typeof message?.content === 'string') return message.content;
  if (!Array.isArray(message?.content)) return '';
  return message.content.map((part) => part?.text || part?.file?.filename || '').join(' ');
}

export function estimateTokens(value) {
  const text = messageText(value).replace(/\s+/gu, ' ').trim();
  if (!text) return 0;
  const cjkCount = text.match(CJK_PATTERN)?.length || 0;
  const other = text.replace(CJK_PATTERN, '').trim();
  return cjkCount + (other ? Math.ceil(new TextEncoder().encode(other).length / 4) : 0);
}

export function estimateConversationTokens(messages) {
  return Array.from(messages, estimateTokens).reduce((total, count) => total + count, 0);
}
