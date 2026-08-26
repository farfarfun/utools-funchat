import { host } from '../../services/utools.js';

export const COLLAPSE_THRESHOLD = 900;

export function isLongMessage(value) {
  return String(value || '').length > COLLAPSE_THRESHOLD;
}

export function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export async function saveToDisk(dialogOptions, data, encoding = 'utf-8') {
  if (typeof window.saveFile !== 'function') return false;
  await window.saveFile(dialogOptions, data, encoding);
  return true;
}

export function downloadInBrowser(filename, href) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = href;
  link.click();
}

// 存文件与复制到剪贴板共用同一份渲染，保证两种导出的成像完全一致
export async function renderElementImage(element) {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    backgroundColor: getComputedStyle(document.body).getPropertyValue('--color-bg-2').trim() || '#fff',
    scale: Math.min(devicePixelRatio || 1, 2),
    useCORS: true,
    ignoreElements: (node) => node.classList?.contains('message-actions'),
  });
  return canvas.toDataURL('image/png');
}

export async function saveElementImage(element, filenamePrefix = 'chat-message') {
  const dataUrl = await renderElementImage(element);
  const filename = `${filenamePrefix}-${formatTimestamp(new Date())}.png`;
  const saved = await saveToDisk({
    title: '保存消息图片',
    defaultPath: filename,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
  }, dataUrl.split(',')[1], 'base64');
  if (!saved) downloadInBrowser(filename, dataUrl);
}

export async function copyElementImage(element) {
  const dataUrl = await renderElementImage(element);
  await host.copyImage(dataUrl);
  return true;
}
