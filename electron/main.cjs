'use strict';
/**
 * SocialDesk 独立桌面版 · Electron 主进程
 *
 * 与浏览器版的根本区别，全部集中在这个文件里：
 *   1. 数据写在 <userData>/data/socialdesk.json —— 不是 localStorage
 *   2. 后台常驻进程 + 定时发布引擎 —— 浏览器做不到
 *   3. 素材存成真实文件，走自定义协议 sdmedia:// 直接投喂给发布接口
 *   4. 系统托盘 + 开机自启 + 发布通知
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, shell, dialog, protocol, net, Notification, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const { paths } = require('./paths.cjs');
const logmod = require('./logger.cjs');
const db = require('./db.cjs');
const sched = require('./scheduler.cjs');
const { describe: describeAdapters, channelMap, getAdapter } = require('./adapters/index.cjs');
const { publishPost, applyResults } = require('./publisher.cjs');

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

let win = null;
let tray = null;

/* 自定义协议：把磁盘上的素材以 sdmedia://media/<文件名> 暴露给渲染进程 */
protocol.registerSchemesAsPrivileged([
  { scheme: 'sdmedia', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
]);

/* --------------------------- 工具 --------------------------- */

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function windowStateFile() {
  return path.join(paths().dataDir, 'window.json');
}

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
    if (s && typeof s.width === 'number') return s;
  } catch {
    /* 首次运行 */
  }
  return { width: 1440, height: 920, maximized: false };
}

function saveWindowState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds ? win.getNormalBounds() : win.getBounds();
    fs.writeFileSync(
      windowStateFile(),
      JSON.stringify({ ...b, maximized: win.isMaximized() }, null, 2),
      'utf8',
    );
  } catch {
    /* ignore */
  }
}

function notify(title, body) {
  try {
    const cfg = db.readEngine();
    if (!cfg.notifyOnPublish) return;
    if (!Notification.isSupported()) return;
    new Notification({ title, body, silent: false }).show();
  } catch {
    /* ignore */
  }
}

/* --------------------------- 主窗口 --------------------------- */

function createWindow() {
  const st = loadWindowState();
  win = new BrowserWindow({
    width: st.width,
    height: st.height,
    x: st.x,
    y: st.y,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0d12',
    title: 'SocialDesk · 全平台社交工作台',
    icon: iconPath('ico'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  if (st.maximized) win.maximize();

  win.once('ready-to-show', () => win.show());

  if (isDev && process.env.SD_DEV_SERVER !== '0') {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.on('resize', saveWindowState);
  win.on('move', saveWindowState);
  win.on('close', (e) => {
    saveWindowState();
    const cfg = db.readEngine();
    // 勾了「关闭时最小化到托盘」就真的不退出，继续后台跑定时发布
    if (cfg.minimizeToTray && !app.isQuitting) {
      e.preventDefault();
      win.hide();
      if (!cfg.trayHintShown) {
        db.writeEngine({ ...cfg, trayHintShown: true });
        notify('SocialDesk 仍在后台运行', '定时发布引擎没有停止。要完全退出请右键托盘图标 → 退出。');
      }
    }
  });

  // 外链一律用系统浏览器打开，不在应用内开新窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (e, url) => {
    const isLocal = url.startsWith('file://') || url.startsWith(DEV_URL);
    if (!isLocal) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

/** 图标路径：打包后在 resources/ 下（真实文件），开发时在 build/ 下 */
function iconPath(prefer = 'png') {
  const res = process.resourcesPath || '';
  const primary = prefer === 'ico' ? 'icon.ico' : 'icon.png';
  const secondary = prefer === 'ico' ? 'icon.png' : 'icon.ico';
  const candidates = [
    res && path.join(res, primary),
    res && path.join(res, secondary),
    path.join(__dirname, '..', 'assets', primary),
    path.join(__dirname, '..', 'assets', secondary),
    path.join(__dirname, '..', 'build', primary),
    path.join(__dirname, '..', 'build', secondary),
  ];
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return undefined;
}

/* --------------------------- 托盘 --------------------------- */

function createTray() {
  const p = iconPath('png');
  if (!p) {
    logmod.warn('找不到图标文件，托盘图标不可用（不影响功能）');
    return;
  }
  try {
    let img = nativeImage.createFromPath(p);
    if (img.isEmpty()) return;
    img = img.resize({ width: 16, height: 16 });
    tray = new Tray(img);
    const rebuild = () => {
      const st = sched.status();
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: `SocialDesk ${app.getVersion()}`, enabled: false },
          { type: 'separator' },
          { label: st.running ? `引擎运行中 · 每 ${st.config?.intervalSec ?? 20} 秒扫描` : '引擎已停止', enabled: false },
          { label: `已发布 ${st.published} · 失败 ${st.failed}`, enabled: false },
          { type: 'separator' },
          { label: '显示主窗口', click: () => { if (win) { win.show(); win.focus(); } } },
          { label: st.config?.enabled ? '暂停自动发布' : '恢复自动发布', click: () => sched.configure({ enabled: !st.config?.enabled }) },
          { label: '立即检查队列', click: () => sched.tickNow() },
          { type: 'separator' },
          { label: '打开数据文件夹', click: () => shell.openPath(paths().dataDir) },
          { label: '复制文案请进主窗口', enabled: false },
          { type: 'separator' },
          {
            label: '退出 SocialDesk',
            click: () => {
              app.isQuitting = true;
              app.quit();
            },
          },
        ]),
      );
      tray.setToolTip(`SocialDesk · ${st.running ? '运行中' : '已停止'}`);
    };
    rebuild();
    tray.on('click', () => { if (win) { win.show(); win.focus(); } });
    sched.setSink((evt) => { rebuild(); });
  } catch (e) {
    logmod.warn('托盘创建失败', { error: String(e && e.message) });
  }
}

/* --------------------------- 菜单 --------------------------- */

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '打开数据文件夹', click: () => shell.openPath(paths().dataDir) },
        { label: '立即备份一次', click: () => { db.snapshot('menu'); } },
        { type: 'separator' },
        { label: isDev ? '打开开发者工具' : '退出', role: isDev ? 'toggleDevTools' : 'quit' },
      ],
    },
    { label: '编辑', submenu: [{ role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' }, { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }] },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新载入' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [{ role: 'minimize', label: '最小化' }, { role: 'close', label: '关闭' }],
    },
    {
      label: '帮助',
      submenu: [
        { label: '数据存在哪里？', click: () => shell.openPath(paths().dataDir) },
        { label: '查看发布日志', click: () => shell.openPath(paths().logFile) },
        { type: 'separator' },
        {
          label: '关于 SocialDesk',
          click: () =>
            dialog.showMessageBox(win, {
              type: 'info',
              title: '关于 SocialDesk',
              message: `SocialDesk 独立桌面版 v${app.getVersion()}`,
              detail:
                `数据目录：\n${paths().dataDir}\n\n` +
                `· 所有数据都在你自己的电脑上，不上传任何服务器\n` +
                `· 发布引擎随程序常驻，关掉窗口也能到点自动发\n` +
                `· Node ${process.versions.node} · Electron ${process.versions.electron} · ${process.platform}/${process.arch}`,
              buttons: ['好'],
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* --------------------------- IPC --------------------------- */

function registerIpc() {
  // ---- 应用信息 ----
  ipcMain.handle('app:info', () => {
    const p = paths();
    return {
      version: app.getVersion(),
      isDesktop: true,
      isDev,
      platform: process.platform,
      arch: process.arch,
      versions: { electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome },
      dataDir: p.dataDir,
      dbFile: p.dbFile,
      mediaDir: p.mediaDir,
      backupDir: p.backupDir,
      logFile: p.logFile,
      engine: db.readEngine(),
      adapters: describeAdapters(),
      channelMap: channelMap(),
    };
  });

  ipcMain.handle('app:openPath', (_e, target) => shell.openPath(String(target || paths().dataDir)));
  ipcMain.handle('shell:external', (_e, url) => shell.openExternal(String(url)));

  ipcMain.handle('app:setLoginItem', (_e, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled, openAsHidden: true, args: [] });
    const cfg = db.readEngine();
    return db.writeEngine({ ...cfg, launchAtLogin: !!enabled });
  });

  // ---- 数据库 ----
  ipcMain.handle('db:load', () => {
    const existing = db.readDB();
    return { db: existing, exists: !!existing };
  });

  let saveCount = 0;
  ipcMain.handle('db:save', (_e, payload) => {
    const result = db.writeDB(payload);
    saveCount += 1;
    // 每 20 次保存自动留一个快照，防止手滑
    if (saveCount % 20 === 0) db.snapshot('auto');
    return { ok: true, ...result, saves: saveCount };
  });

  ipcMain.handle('db:snapshot', () => ({ path: db.snapshot('manual') }));
  ipcMain.handle('db:listBackups', () => db.listBackups());
  ipcMain.handle('db:readBackup', (_e, name) => {
    try {
      const file = path.join(paths().backupDir, path.basename(String(name)));
      const parsed = db.normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
      return { ok: !!parsed, db: parsed };
    } catch (e) {
      return { ok: false, error: String(e && e.message) };
    }
  });

  ipcMain.handle('db:export', async () => {
    const current = db.readDB();
    if (!current) return { ok: false, error: '还没有数据可导出' };
    const stamp = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出 SocialDesk 备份',
      defaultPath: path.join(app.getPath('documents'), `socialdesk-backup-${stamp}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, JSON.stringify(current, null, 2), 'utf8');
    return { ok: true, path: filePath };
  });

  ipcMain.handle('db:importFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '导入 SocialDesk 备份',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths.length) return { ok: false, canceled: true };
    try {
      db.snapshot('pre-import');
      const parsed = db.normalize(JSON.parse(fs.readFileSync(filePaths[0], 'utf8')));
      if (!parsed) return { ok: false, error: '文件结构不是 SocialDesk 备份' };
      db.writeDB(parsed);
      send('db:changed', { source: 'import' });
      return { ok: true, db: parsed, path: filePaths[0] };
    } catch (e) {
      return { ok: false, error: String(e && e.message) };
    }
  });

  // 首次迁移：把浏览器版 localStorage 里的数据搬进独立版
  ipcMain.handle('db:importLegacy', (_e, payload) => {
    try {
      const parsed = db.normalize(payload);
      if (!parsed) return { ok: false, error: '旧数据格式不正确' };
      db.snapshot('pre-legacy-import');
      db.writeDB(parsed);
      logmod.ok('已从浏览器版导入数据', { posts: parsed.posts.length });
      return { ok: true, db: parsed };
    } catch (e) {
      return { ok: false, error: String(e && e.message) };
    }
  });

  // ---- 素材文件 ----
  ipcMain.handle('media:save', (_e, { name, mime, data }) => {
    try {
      const buf = Buffer.from(data);
      const ext = (String(name).match(/\.[a-z0-9]+$/i) || ['.bin'])[0].toLowerCase();
      const stored = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const dest = path.join(paths().mediaDir, stored);
      fs.writeFileSync(dest, buf);
      return {
        ok: true,
        url: `sdmedia://media/${stored}`,
        path: dest,
        bytes: buf.length,
        mime: mime || 'application/octet-stream',
      };
    } catch (e) {
      return { ok: false, error: String(e && e.message) };
    }
  });

  ipcMain.handle('media:delete', (_e, { path: filePath, url }) => {
    try {
      let target = filePath;
      if (!target && url) {
        const m = String(url).match(/^sdmedia:\/\/media\/(.+)$/);
        if (m) target = path.join(paths().mediaDir, decodeURIComponent(m[1]));
      }
      if (target && fs.existsSync(target) && target.startsWith(paths().mediaDir)) fs.unlinkSync(target);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.message) };
    }
  });

  // ---- 适配器 / 发布 ----
  ipcMain.handle('pub:listAdapters', () => ({ adapters: describeAdapters(), channelMap: channelMap() }));

  ipcMain.handle('pub:test', async (_e, { platformId, credential }) => {
    const adapter = getAdapter(platformId);
    if (!adapter) return { ok: false, message: '该平台暂无自动通道（需人工发布）', simulated: false };
    if (!credential || !String(credential).trim()) {
      return { ok: false, message: `请填写凭证：${adapter.credentialHint}`, simulated: false };
    }
    try {
      const res = await adapter.test(credential);
      return { ...res, channel: adapter.id, simulated: false };
    } catch (e) {
      return { ok: false, message: String((e && e.message) || e), simulated: false };
    }
  });

  ipcMain.handle('pub:post', async (_e, { postId, platforms }) => {
    const current = db.readDB();
    if (!current) return { ok: false, error: '数据库为空' };
    const post = current.posts.find((p) => p.id === postId);
    if (!post) return { ok: false, error: '找不到这条内容' };

    const { results, anyOk, summary } = await publishPost(current, post, { platforms });
    const updated = applyResults(post, results);
    const next = { ...current, posts: current.posts.map((p) => (p.id === postId ? updated : p)) };
    db.writeDB(next);
    send('db:changed', { source: 'publish' });

    notify(
      anyOk ? 'SocialDesk · 发布成功' : 'SocialDesk · 发布失败',
      `${summary}｜${(post.content || '').slice(0, 40)}`,
    );
    return { ok: anyOk, summary, results, post: updated };
  });

  // ---- 调度引擎 ----
  ipcMain.handle('sched:status', () => sched.status());
  ipcMain.handle('sched:configure', (_e, patch) => sched.configure(patch || {}));
  ipcMain.handle('sched:tick', () => sched.tickNow());

  // ---- 日志 ----
  ipcMain.handle('log:tail', (_e, n) => logmod.tail(Number(n) || 300));
  ipcMain.handle('log:clear', () => {
    logmod.clear();
    return { ok: true };
  });
}

/* --------------------------- 启动 --------------------------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    const p = paths();
    logmod.info('SocialDesk 启动', {
      version: app.getVersion(),
      dataDir: p.dataDir,
      electron: process.versions.electron,
    });

    // sdmedia://  → 直接映射到素材目录的文件
    protocol.handle('sdmedia', (req) => {
      try {
        const url = new URL(req.url);
        const name = path.basename(decodeURIComponent(url.pathname.replace(/^\/+/, '')) || url.hostname);
        const file = path.join(p.mediaDir, name);
        if (!file.startsWith(p.mediaDir) || !fs.existsSync(file)) {
          return new Response('not found', { status: 404 });
        }
        return net.fetch(pathToFileURL(file).toString());
      } catch {
        return new Response('bad request', { status: 400 });
      }
    });

    registerIpc();
    buildMenu();
    createWindow();
    createTray();

    // 引擎事件 → 渲染进程 + 系统通知
    sched.setSink((evt) => {
      send('sd:event', evt);
      if (evt.type === 'publish:done' && !evt.payload.results) return;
    });

    const engine = db.readEngine();
    sched.configure(engine);
    sched.start();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    const cfg = db.readEngine();
    // 勾了托盘常驻就继续后台跑；否则（非 macOS）退出
    if (cfg.keepRunningInTray && cfg.minimizeToTray) return;
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    db.snapshot('quit');
    logmod.info('SocialDesk 退出');
  });
}
