const fs = require('fs');

// 独立窗口默认占屏幕工作区的比例
const WINDOW_RATIO = 0.7;

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
  // workAreaSize 已扣除菜单栏与 Dock，按它取 70% 不会被系统 UI 遮挡
  const { width, height } = utools.getPrimaryDisplay().workAreaSize;
  chatWindow = utools.createBrowserWindow(
    'dist/index.html',
    {
      width: Math.round(width * WINDOW_RATIO),
      height: Math.round(height * WINDOW_RATIO),
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
