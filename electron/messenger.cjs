'use strict';
/**
 * 消息聚合 · 原生嵌入层
 * =====================================================================
 * 用 Electron 的 WebContentsView 把各家**网页版**嵌进主窗口：
 *   WhatsApp / Telegram / Messenger / Instagram / Discord / Slack / LINE
 *
 * 为什么不用 <webview> 标签或 <iframe>：
 *   · iframe 会被对方网站的 X-Frame-Options 直接拦掉
 *   · webview 标签在新版 Electron 里已不推荐
 *   · WebContentsView 是官方推荐的方案，且能拿到前进/后退/标题等真实状态
 *
 * 登录态用一个独立且**持久化**的 session（persist:sd-messenger）保存，
 * 所以只要登录过一次，下次打开还是登录状态。
 *
 * 零 API：这里不碰任何平台接口，只是把官方网页显示出来。
 */
const { WebContentsView } = require('electron');
const { log } = require('./logger.cjs');

const PARTITION = 'persist:sd-messenger';

/** serviceId -> WebContentsView（保留实例，切回来时页面状态还在） */
const views = new Map();
/** serviceId -> 该服务最近一次上报的状态 */
const states = new Map();

let session = null;
let active = null; // 当前挂在窗口上的 view
let host = null; // 主窗口
let notify = null; // 推状态给渲染进程

function init({ window, onState }) {
  host = window;
  notify = onState;
}

/** 去掉 Electron 标识，避免部分网站因为 UA 直接拒绝服务 */
function browserUA(webContents) {
  return webContents
    .getUserAgent()
    .replace(/\sElectron\/[\d.]+/, '')
    .replace(/\sSocialDesk\/[\d.]+/, '');
}

function pushState(serviceId) {
  const v = views.get(serviceId);
  if (!v) return;
  const wc = v.webContents;
  const st = {
    serviceId,
    url: wc.getURL(),
    title: wc.getTitle(),
    loading: wc.isLoading(),
    canGoBack: wc.navigationHistory ? wc.navigationHistory.canGoBack() : wc.canGoBack(),
    canGoForward: wc.navigationHistory ? wc.navigationHistory.canGoForward() : wc.canGoForward(),
  };
  states.set(serviceId, st);
  try {
    if (notify) notify(st);
  } catch {
    /* ignore */
  }
}

function createView(serviceId, partitionSession) {
  const v = new WebContentsView({
    webPreferences: {
      session: partitionSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 让网页以为自己跑在普通浏览器里
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  v.setBackgroundColor('#0a0c11');

  const wc = v.webContents;
  wc.setUserAgent(browserUA(wc));

  // 站内新窗口 → 直接用同一个视图打开，不然会弹出无边框小窗
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) wc.loadURL(url);
    return { action: 'deny' };
  });

  const onNav = () => pushState(serviceId);
  wc.on('did-start-loading', onNav);
  wc.on('did-stop-loading', onNav);
  wc.on('did-navigate', onNav);
  wc.on('did-navigate-in-page', onNav);
  wc.on('page-title-updated', onNav);
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    log.warn('消息聚合页面加载失败', { serviceId, code, desc, url });
    pushState(serviceId);
  });

  // 网页内核偶尔会崩或卡死（第三方页面我们控制不了）：
  // 自动重载一次，用户不用自己去按刷新。登录态存在持久化 session 里，不会丢。
  let recovering = false;
  wc.on('render-process-gone', (_e, details) => {
    log.warn('消息聚合页面进程异常，自动重载', { serviceId, reason: details.reason });
    if (recovering) return;
    recovering = true;
    setTimeout(() => {
      try {
        if (!wc.isDestroyed()) wc.reload();
      } catch {
        /* ignore */
      }
      recovering = false;
    }, 1200);
  });

  views.set(serviceId, v);
  return v;
}

/**
 * 把一个服务挂到窗口上并指定显示区域。
 * bounds 用的是 CSS 像素（渲染进程 getBoundingClientRect 的结果），
 * Electron 的 setBounds 也是 DIP，两者一致。
 */
function mount(serviceId, url, bounds, partitionSession) {
  if (!host || host.isDestroyed()) return null;
  const v = views.get(serviceId) ?? createView(serviceId, partitionSession);

  if (active && active !== serviceId) {
    const prev = views.get(active);
    if (prev) {
      try {
        host.contentView.removeChildView(prev);
      } catch {
        /* ignore */
      }
    }
  }

  try {
    host.contentView.addChildView(v);
  } catch {
    /* 已经挂上了 */
  }
  if (bounds) v.setBounds(bounds);
  if (!v.webContents.getURL()) v.webContents.loadURL(url);
  active = serviceId;
  pushState(serviceId);
  return states.get(serviceId) ?? null;
}

function setBounds(bounds) {
  if (!active) return;
  const v = views.get(active);
  if (v) v.setBounds(bounds);
}

function unmount() {
  if (!host || host.isDestroyed() || !active) return;
  const v = views.get(active);
  if (v) {
    try {
      host.contentView.removeChildView(v);
    } catch {
      /* ignore */
    }
  }
  active = null;
}

const act = (fn) => {
  if (!active) return;
  const v = views.get(active);
  if (v) fn(v.webContents);
};

const actions = {
  reload: () => act((wc) => wc.reload()),
  goBack: () => act((wc) => (wc.navigationHistory ? wc.navigationHistory.goBack() : wc.goBack())),
  goForward: () =>
    act((wc) => (wc.navigationHistory ? wc.navigationHistory.goForward() : wc.goForward())),
  home: (url) => act((wc) => wc.loadURL(url)),
  state: () => (active ? states.get(active) ?? null : null),
  /** 关闭所有聚合视图（退出前调用，避免后台还在跑网页） */
  destroyAll: () => {
    unmount();
    for (const [id, v] of views) {
      try {
        v.webContents.close();
      } catch {
        /* ignore */
      }
      views.delete(id);
    }
  },
  setSession: (s) => {
    session = s;
  },
  getSession: () => session,
};

module.exports = {
  init,
  mount,
  setBounds,
  unmount,
  actions,
  PARTITION,
  browserUA,
  /** 仅供自动化测试读取内部视图实例，业务代码不要用 */
  __views: views,
};
