import type { MessagePart } from '../../types.ts';

export type MessageContent = string | MessagePart[] | null | undefined;
export type MessageLike = string | { content?: MessageContent } | null | undefined;

function contentOf(message: MessageLike): MessageContent {
  return typeof message === 'string' ? message : message?.content;
}

/**
 * 把输入框里的文字和图片拼成一条用户消息的内容。
 * @param text 输入框文字，首尾空白会被去掉。
 * @param images 图片的 data URL 列表，空串会被忽略。
 * @returns 没有图片时返回纯字符串，保持与旧数据一致；有图片时返回 OpenAI 多模态片段数组。
 */
export function buildUserContent(text: unknown, images: readonly string[] = []): string | MessagePart[] {
  const value = String(text ?? '').trim();
  const urls = images.filter(Boolean);
  if (!urls.length) return value;
  return [
    ...(value ? [{ type: 'text', text: value }] : []),
    ...urls.map((url) => ({ type: 'image_url', image_url: { url } })),
  ];
}

/**
 * 判断一条消息内容是否值得发出去。
 * @param content 字符串或多模态片段数组。
 * @returns 有非空文字或任意片段时返回 `true`。
 */
export function hasContent(content: MessageContent): boolean {
  return Array.isArray(content) ? content.length > 0 : Boolean(String(content ?? '').trim());
}

/**
 * 给消息内容加上好友的 autoPrefix。
 * @param content 原始消息内容。
 * @param prefix 要前置的文字，空串表示不处理。
 * @returns 加过前缀的新内容；原内容不会被修改。
 */
export function withPrefix(content: MessageContent, prefix: string): MessageContent {
  if (!prefix) return content;
  if (typeof content === 'string') return prefix + content;
  if (!Array.isArray(content)) return content;
  const at = content.findIndex((part) => typeof part?.text === 'string');
  // 带图消息要把前缀贴在文字片段上；纯图片消息则补一段文字，否则前缀会被整条丢掉
  if (at < 0) return [{ type: 'text', text: prefix }, ...content];
  return content.map((part, index) => (index === at ? { ...part, text: prefix + part.text } : part));
}

/**
 * 取出消息里可以显示的图片地址。
 * @param message 字符串消息或消息对象。
 * @returns 图片 data URL 或链接列表；没有图片时返回空数组。
 */
export function imageUrls(message: MessageLike): string[] {
  const content = contentOf(message);
  if (!Array.isArray(content)) return [];
  return content
    .filter((part) => part?.type === 'image_url')
    .map((part) => part?.image_url?.url || '')
    .filter(Boolean);
}

/**
 * 统计消息里图片数据已被清空的片段数（见 storage 的 `stripImagesToFit`）。
 * @param message 字符串消息或消息对象。
 * @returns 只剩占位、无法再显示的图片数量。
 */
export function droppedImageCount(message: MessageLike): number {
  const content = contentOf(message);
  if (!Array.isArray(content)) return 0;
  return content.filter((part) => part?.type === 'image_url' && !part?.image_url?.url).length;
}
