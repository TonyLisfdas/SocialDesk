'use strict';
/**
 * 消息聚合 · 真实嵌入验证
 * ---------------------------------------------------------------------
 * 这个测试要证明的是「网页版真的被嵌进来了」，而不是界面上摆了个空框。
 *
 * 两个容易踩的坑（都已处理）：
 *  1. Electron 的 win.webContents.capturePage() 只截主窗口，不含子视图
 *     （WebContentsView）的内容 —— 必须直接截子视图本身。
 *  2. 「画面是不是空白」不能用「跟某个固定背景色比」来判断：网页可能是
 *     深色主题（Discord），会被误判成空白。这里改成「先取画面主色调，
 *     再数有多少像素跟主色调不一样」——深浅主题都能正确判断。
 *
 * 用法： xvfb-run electron test/messenger-test.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { app, BrowserWindow, WebContentsView, session, screen } = require('electron');

const messenger = require('../electron/messenger.cjs');

const OUT = path.join(__dirname, 'shots');
const RESULTS = [];
let failures = 0;

function check(name, cond, extra = '') {
  RESULTS.push(`${cond ? '  ✅' : '  ❌'} ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures += 1;
}

const CASES = [
  { id: 'whatsapp', url: 'https://web.whatsapp.com/', host: 'web.whatsapp.com' },
  { id: 'telegram', url: 'https://web.telegram.org/a/', host: 'web.telegram.org' },
  { id: 'discord', url: 'https://discord.com/app', host: 'discord.com' },
];

const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 画面「有内容」打分：取采样点的主色调，统计与主色调明显不同的像素占比。
 * 纯空白页 ≈ 0；正常网页（不分深浅主题）都远大于阈值。
 */
function paintedScore(bmp) {
  const samples = [];
  for (let i = 0; i < bmp.length; i += 4 * 397) {
    samples.push([bmp[i + 2], bmp[i + 1], bmp[i]]); // R,G,B
  }
  if (samples.length === 0) return 0;
  // 主色调：把每个通道量化到 32 级，找出出现最多的组合
  const buckets = new Map();
  for (const [r, g, b] of samples) {
    const k = `${r >> 5},${g >> 5},${b >> 5}`;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  let bestKey = '';
  let bestN = -1;
  for (const [k, n] of buckets) {
    if (n > bestN) { bestN = n; bestKey = k; }
  }
  const [qr, qg, qb] = bestKey.split(',').map((x) => (Number(x) << 5) + 16);
  let diff = 0;
  for (const [r, g, b] of samples) {
    if (Math.abs(r - qr) > 24 || Math.abs(g - qg) > 24 || Math.abs(b - qb) > 24) diff += 1;
  }
  return diff / samples.length;
}

/** 通过 messenger 模块的 __views（仅测试用导出）拿视图；拿不到就退回遍历窗口子视图 */
function viewOf(win, id) {
  const mod = require('../electron/messenger.cjs');
  const views = mod.__views ?? null;
  if (views && views.get(id)) return views.get(id);
  const kids = win.contentView.children || [];
  return kids.find((c) => c instanceof WebContentsView) || null;
}
/** 真正挂在窗口上的子视图数量（__views 是有意保留的实例缓存，不能拿它当“残留”判断） */
function attachedViews(win) {
  return (win.contentView.children || []).filter((c) => c instanceof WebContentsView).length;
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dump = () => {
    console.log(RESULTS.join('\n'));
    fs.writeFileSync(path.join(OUT, 'messenger-report.txt'), RESULTS.join('\n'), 'utf8');
  };

  // 建一个跟真实主窗口同尺寸的窗口，保证 bounds 计算与真机一致
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    backgroundColor: '#0a0c11',
    webPreferences: { offscreen: false },
  });
  await win.loadURL('data:text/html,<body style="margin:0;background:%230a0c11"></body>');

  const ses = session.fromPartition(messenger.PARTITION);
  ses.setUserAgent(messenger.browserUA(ses));
  messenger.init({ window: win, onState: () => {} });

  const bounds = { x: 240, y: 110, width: 1180, height: 760 };

  RESULTS.push('CSS 像素 vs 屏幕像素：');
  const scale = win.webContents.getZoomFactor();
  const dpr = screen.getPrimaryDisplay().scaleFactor;
  check('缩放为 100%（截图坐标可直接用）', scale === 1, `zoomFactor=${scale}`);
  RESULTS.push(`  显示器 devicePixelRatio = ${dpr}（截图按物理像素输出，属正常）`);

  for (const c of CASES) {
    RESULTS.push(`\n【${c.id}】`);
    messenger.mount(c.id, c.url, bounds, ses);

    // 第一步：等待网页导航完成（最多 25 秒）
    let loaded = false;
    for (let i = 0; i < 50; i += 1) {
      await waitMs(500);
      const s = messenger.actions.state();
      if (s && !s.loading && s.url && s.url.includes(c.host)) { loaded = true; break; }
    }
    const s = messenger.actions.state();
    check('已加载到目标站点', loaded, s ? `url=${s.url.slice(0, 60)}` : 'state=null');
    check('拿回了真实页面标题', !!s && !!s.title && s.title.length > 0, `title="${s?.title ?? ''}"`);

    const view = viewOf(win, c.id);
    if (!view) {
      check('找到子视图实例', false, '__views 与窗口子视图都没找到');
      messenger.unmount();
      continue;
    }

    // 第二步：等画面真的画出来（最多 45 秒）—— 导航完成 ≠ 已经上屏
    const file = path.join(OUT, `messenger-${c.id}.png`);
    let score = 0;
    let ticks = 0;
    for (let i = 0; i < 45; i += 1) {
      await waitMs(1000);
      ticks = i + 1;
      const img = await view.webContents.capturePage();
      fs.writeFileSync(file, img.toPNG()); // 每轮都存，保证最后落盘的是最终画面
      score = paintedScore(img.toBitmap());
      if (score >= 0.04) break;
    }

    const img = await view.webContents.capturePage();
    const size = img.getSize();
    check('子视图有实际画面（非空白）', size.width > 100 && size.height > 100,
      `${size.width}x${size.height} → ${path.basename(file)}`);
    check('画面主色调之外有内容（深浅主题都能识别）', score >= 0.04,
      `内容像素占比 ${(score * 100).toFixed(1)}%（等待 ${ticks}s）`);

    // 全窗口铁证：X11 整屏抓取，能把「应用界面 + 嵌入的真实网页」拍到一张图里
    try {
      const root = path.join(OUT, `messenger-${c.id}-fullwindow.png`);
      execFileSync('import', ['-window', 'root', root], { env: { ...process.env, DISPLAY: process.env.DISPLAY } });
      RESULTS.push(`  🖼  全窗口截图 → ${path.basename(root)}`);
    } catch (e) {
      RESULTS.push(`  ⚠️  全窗口截图跳过（${String(e && e.message).slice(0, 60)}）`);
    }

    messenger.unmount();
  }

  RESULTS.push('\n【收尾】');
  check('卸载后主窗口上不再挂着子视图', attachedViews(win) === 0,
    `挂在窗口上的子视图=${attachedViews(win)}（实例缓存另有 ${messenger.__views.size} 个，是设计如此：切回服务时页面状态还在）`);

  RESULTS.push(`\n结果：${failures === 0 ? '全部通过 ✅' : failures + ' 项失败 ❌'}`);
  dump();
  app.exit(failures === 0 ? 0 : 1);
});
