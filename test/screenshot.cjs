'use strict';
/**
 * 开发用冒烟测试（不参与打包）
 * 用法： xvfb-run electron test/screenshot.cjs
 * 作用：真正启动主进程 → 等界面渲染 → 截图存盘 → 退出。
 * 用来确认「装完之后到底能不能打开」。
 */
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('node:child_process');

// 直接复用生产主进程逻辑
require('../electron/main.cjs');

const OUT_DIR = path.join(__dirname, 'shots');
const PAGE = process.env.SD_SHOT_PAGE || 'dashboard';
const WAIT = Number(process.env.SD_SHOT_WAIT || 6000);
// SD_SHOT_FULL=1 时额外用 X11 整屏抓取一张：这样才能把嵌进窗口里的
// 真实网页（WebContentsView 子视图）一起拍进来 —— capturePage 拍不到它们。
const FULL = process.env.SD_SHOT_FULL === '1';

app.whenReady().then(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const timer = setTimeout(async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
      console.log('NO_WINDOW');
      app.exit(1);
      return;
    }
    try {
      // 切到指定页面（点侧边栏对应的按钮）
      const label = { dashboard: '总览', engine: '发布引擎', queue: '发布队列', accounts: '账号管理', media: '素材库', settings: '设置', composer: '创作台', calendar: '内容日历', messenger: '消息聚合', inbox: '收件箱' }[PAGE];
      if (label) {
        await win.webContents.executeJavaScript(`
          (() => {
            const btns = [...document.querySelectorAll('aside button')];
            const b = btns.find(x => x.textContent.includes(${JSON.stringify(label)}));
            if (b) { b.click(); return true; }
            return false;
          })()
        `);
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (FULL) {
        // 多等一会儿，让嵌入的网页有足够时间把画面画出来
        await new Promise((r) => setTimeout(r, Number(process.env.SD_SHOT_EXTRA_WAIT || 15000)));
        const rootFile = path.join(OUT_DIR, `${PAGE}-fullwindow.png`);
        execFileSync('import', ['-window', 'root', rootFile]);
        console.log('SHOT_OK(fullwindow)', rootFile);
      }
      const img = await win.webContents.capturePage();
      const file = path.join(OUT_DIR, `${PAGE}.png`);
      fs.writeFileSync(file, img.toPNG());
      console.log('SHOT_OK', file, img.getSize().width + 'x' + img.getSize().height);
    } catch (e) {
      console.log('SHOT_FAIL', String(e && e.message));
    }
    app.exit(0);
  }, WAIT);

  timer.unref?.();
});
