'use strict';
/**
 * 预加载桥：渲染进程（React 界面）与主进程（Node 能力）之间唯一的通道。
 * 开启了 contextIsolation，界面拿不到 Node，只能用下面这些被明确暴露的方法。
 * 浏览器版当初只能靠 localStorage；独立版这里换成 IPC → 磁盘文件。
 */
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Set();

ipcRenderer.on('sd:event', (_e, evt) => {
  for (const fn of listeners) {
    try {
      fn(evt);
    } catch {
      /* ignore */
    }
  }
});

ipcRenderer.on('db:changed', (_e, payload) => {
  for (const fn of listeners) {
    try {
      fn({ type: 'db:changed', payload });
    } catch {
      /* ignore */
    }
  }
});

contextBridge.exposeInMainWorld('socialdesk', {
  isDesktop: true,
  platform: process.platform,

  /* ---- 应用信息 ---- */
  info: () => ipcRenderer.invoke('app:info'),
  openPath: (p) => ipcRenderer.invoke('app:openPath', p),
  openExternal: (url) => ipcRenderer.invoke('shell:external', url),
  setLoginItem: (enabled) => ipcRenderer.invoke('app:setLoginItem', enabled),

  /* ---- 数据（磁盘文件）---- */
  loadDB: () => ipcRenderer.invoke('db:load'),
  saveDB: (db) => ipcRenderer.invoke('db:save', db),
  snapshot: () => ipcRenderer.invoke('db:snapshot'),
  listBackups: () => ipcRenderer.invoke('db:listBackups'),
  readBackup: (name) => ipcRenderer.invoke('db:readBackup', name),
  exportBackup: () => ipcRenderer.invoke('db:export'),
  importBackup: () => ipcRenderer.invoke('db:importFile'),
  importLegacy: (payload) => ipcRenderer.invoke('db:importLegacy', payload),

  /* ---- 素材文件 ---- */
  saveMedia: (name, mime, data) => ipcRenderer.invoke('media:save', { name, mime, data }),
  deleteMedia: (payload) => ipcRenderer.invoke('media:delete', payload),

  /* ---- 发布 ---- */
  listAdapters: () => ipcRenderer.invoke('pub:listAdapters'),
  testConnection: (platformId, credential) => ipcRenderer.invoke('pub:test', { platformId, credential }),
  publishPost: (postId, platforms) => ipcRenderer.invoke('pub:post', { postId, platforms }),

  /* ---- 后台引擎 ---- */
  schedulerStatus: () => ipcRenderer.invoke('sched:status'),
  configureScheduler: (patch) => ipcRenderer.invoke('sched:configure', patch),
  tickNow: () => ipcRenderer.invoke('sched:tick'),

  /* ---- 日志 ---- */
  logTail: (n) => ipcRenderer.invoke('log:tail', n),
  logClear: () => ipcRenderer.invoke('log:clear'),

  /* ---- 事件订阅 ---- */
  onEvent: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
});
