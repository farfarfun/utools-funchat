import { imageUrls } from './message-content.ts';
import type { MessageLike } from './message-content.ts';

const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
// 无状态，可以全模块共用一个；estimateTokens 在流式输出期间是按 token 调用的
const UTF8 = new TextEncoder();

// 视觉模型按图块计费，一张常规尺寸的图大致是这个量级。取个中间值，
// 免得带图会话的 Token 估算差出一个数量级。
export const IMAGE_TOKEN_ESTIMATE = 258;

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
 * 按中日韩字符和 UTF-8 字节数粗略估算单条内容的 Token 数，图片按固定量级计入。
 * @param value 待估算的消息或文本内容。
 * @returns 非负整数 Token 估算值。
 */
export function estimateTokens(value: MessageLike): number {
  const images = imageUrls(value).length * IMAGE_TOKEN_ESTIMATE;
  const text = messageText(value).replace(/\s+/gu, ' ').trim();
  if (!text) return images;
  const cjkCount = text.match(CJK_PATTERN)?.length || 0;
  const other = text.replace(CJK_PATTERN, '').trim();
  return images + cjkCount + (other ? Math.ceil(UTF8.encode(other).length / 4) : 0);
}

// 流式回复期间每个 chunk 都会改动最后一条消息，而整段会话的 Token 数是界面上一直显示
// 的（输入区与标题栏），于是每个 token 都要把所有消息重算一遍。按消息对象缓存结果：
// content 是字符串时 += 会产生新字符串，恒等比较自然失效，所以只有正在流的那条会重算。
const tokenCache = new WeakMap<object, { content: unknown; tokens: number }>();

/**
 * 累加会话中全部消息的粗略 Token 数，内容未变的消息直接复用上次结果。
 * @param messages 要估算的消息可迭代对象。
 * @returns 会话总 Token 估算值。
 */
export function estimateConversationTokens(messages: Iterable<MessageLike>): number {
  let total = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      total += estimateTokens(message);
      continue;
    }
    const cached = tokenCache.get(message);
    // 读 content 同时也把它登记为响应式依赖，内容一变计算属性照样会失效
    const content = message.content;
    if (cached && cached.content === content) {
      total += cached.tokens;
      continue;
    }
    const tokens = estimateTokens(message);
    tokenCache.set(message, { content, tokens });
    total += tokens;
  }
  return total;
}
