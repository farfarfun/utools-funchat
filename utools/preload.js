const fs = require('fs');

// 独立窗口默认尺寸：以宽度为主，高度按 16:10 推算（MacBook Pro 的宽高比）。
// 不再两个方向都按同一比例取，否则窗口会跟着屏幕变形——超宽屏上扁得没法看。
const WIDTH_RATIO = 0.7;
const MAX_HEIGHT_RATIO = 0.88;
const ASPECT = 16 / 10;

window.saveFile = async (options, data, encoding = 'utf-8') => {
  const filePath = utools.showSaveDialog(options);
  if (!filePath) return false;
  await fs.promises.writeFile(filePath, data, encoding);
  return true;
};

let chatWindow = null;

const openChatWindow = () => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return chatWindow;
  }
  // workAreaSize 已扣除菜单栏与 Dock，基于它算就不会被系统 UI 遮挡
  const area = utools.getPrimaryDisplay().workAreaSize;
  // 先按宽度比例取，再用 16:10 推高度；高度顶到工作区上限时反过来由高度定宽，
  // 这样矮屏幕上也不会算出一个超出屏幕的窗口
  const maxHeight = Math.round(area.height * MAX_HEIGHT_RATIO);
  const width = Math.min(Math.round(area.width * WIDTH_RATIO), Math.round(maxHeight * ASPECT), area.width);
  const height = Math.round(width / ASPECT);
  chatWindow = utools.createBrowserWindow(
    'dist/index.html',
    {
      width,
      height,
      center: true,
      show: false,
      title: 'funchat',
      webPreferences: { preload: 'preload.js' },
    },
    () => {
      chatWindow.show();
      chatWindow.focus();
    },
  );
  return chatWindow;
};

// 独立窗口内也会执行本文件，必须跳过开窗逻辑，否则无限套娃
const windowType = typeof utools.getWindowType === 'function' ? utools.getWindowType() : 'main';

if (windowType === 'main') {
  utools.onPluginEnter(() => {
    utools.hideMainWindow();
    openChatWindow();
  });
}
