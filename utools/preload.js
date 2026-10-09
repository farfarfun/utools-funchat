const fs = require('fs');

window.saveFile = async (options, data, encoding = 'utf-8') => {
  const filePath = utools.showSaveDialog(options);
  if (!filePath) return false;
  await fs.promises.writeFile(filePath, data, encoding);
  return true;
};

// 不再自己 createBrowserWindow 开独立窗口：插件就在 uTools 主面板里跑，
// 需要独立窗口时用 uTools 自带的「分离」按钮，窗口尺寸也交给 uTools 记忆。
// 面板内的高度由应用侧调 utools.setExpendHeight 控制（对应设置里的「插件高度」）。
