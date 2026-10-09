import { ref } from 'vue';

// 输入框的缩略图和消息气泡里的图片都要能点开看大图，但整个聊天界面只需要一个灯箱，
// 所以预览地址放在模块级：谁想打开谁调 previewImage，灯箱由 ChatView 挂一次。
export const previewUrl = ref('');

/**
 * 打开大图预览。
 * @param url 要预览的图片地址，空值会被忽略。
 * @returns 无返回值。
 */
export function previewImage(url: string): void {
  if (url) previewUrl.value = url;
}

/**
 * 关闭大图预览。
 * @returns 无返回值。
 */
export function closePreview(): void {
  previewUrl.value = '';
}
