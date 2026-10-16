/**
 * 桌面端桥接层
 * ------------------------------------------------------------------
 * 这个文件是「独立版」和「浏览器版」的分界线：
 *   · 在 Electron 里跑  → window.socialdesk 存在，数据走磁盘文件、发布走主进程 Node
 *   · 在浏览器里跑      → 自动降级回 localStorage + 演示适配器
 * 界面代码完全不用关心自己跑在哪儿。
 */
import type { DB } from '../types';

export type AdapterId = 'telegram' | 'bluesky' | 'discord' | 'mastodon' | 'webhook' | 'localbridge' | 'manual';

export interface AdapterInfo {
  id: AdapterId;
  label: string;
  mode: 'api' | 'cookie' | 'manual';
  credentialHint: string;
  helpZh: string;
  helpEn: string;
  real: boolean;
}

export interface EngineConfig {
  enabled: boolean;
  intervalSec: number;
  launchAtLogin: boolean;
  minimizeToTray: boolean;
  notifyOnPublish: boolean;
  keepRunningInTray: boolean;
  trayHintShown?: boolean;
  publishedCount?: number;
  failedCount?: number;
}

export interface PublishPlatformResult {
  status: 'published' | 'failed' | 'pending_manual';
  message: string;
  externalId?: string;
  real?: boolean;
  simulated?: boolean;
  channelId?: string;
  ms?: number;
  at?: string;
}

export interface PublishOutcome {
  ok: boolean;
  summary: string;
  results: Record<string, PublishPlatformResult>;
  post?: unknown;
}

export interface EngineStatus {
  running: boolean;
  lastTickAt: string | null;
  lastPublishAt: string | null;
  published: number;
  failed: number;
  nextRunAt: string | null;
  inFlight: string[];
  recent: { postId: string; summary: string; at: string; ok: boolean }[];
  config: EngineConfig;
}

export interface LogEntry {
  at: string;
  level: 'info' | 'ok' | 'warn' | 'error';
  msg: string;
  meta?: Record<string, unknown> | null;
}

export interface MessengerState {
  serviceId: string;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackupInfo {
  name: string;
  path: string;
  bytes: number;
  at: string;
}

export interface AppInfo {
  version: string;
  isDesktop: boolean;
  isDev: boolean;
  platform: string;
  arch: string;
  versions: { electron: string; node: string; chrome: string };
  dataDir: string;
  dbFile: string;
  mediaDir: string;
  backupDir: string;
  logFile: string;
  engine: EngineConfig;
  adapters: AdapterInfo[];
  channelMap: Record<string, AdapterId>;
}

export interface BridgeEvent {
  type: string;
  at?: string;
  payload?: Record<string, unknown>;
}

interface DesktopBridge {
  isDesktop: true;
  platform: string;
  info(): Promise<AppInfo>;
  openPath(p: string): Promise<string>;
  openExternal(url: string): Promise<void>;
  setLoginItem(enabled: boolean): Promise<EngineConfig>;
  loadDB(): Promise<{ db: DB | null; exists: boolean }>;
  saveDB(db: DB): Promise<{ ok: boolean; bytes: number; path: string }>;
  snapshot(): Promise<{ path: string | null }>;
  listBackups(): Promise<BackupInfo[]>;
  readBackup(name: string): Promise<{ ok: boolean; db?: DB; error?: string }>;
  exportBackup(): Promise<{ ok: boolean; path?: string; canceled?: boolean }>;
  importBackup(): Promise<{ ok: boolean; db?: DB; path?: string; canceled?: boolean; error?: string }>;
  importLegacy(payload: DB): Promise<{ ok: boolean; db?: DB; error?: string }>;
  saveMedia(name: string, mime: string, data: ArrayBuffer): Promise<{ ok: boolean; url?: string; path?: string; bytes?: number; error?: string }>;
  deleteMedia(payload: { path?: string; url?: string }): Promise<{ ok: boolean; error?: string }>;
  listAdapters(): Promise<{ adapters: AdapterInfo[]; channelMap: Record<string, AdapterId> }>;
  testConnection(platformId: string, credential: string): Promise<{ ok: boolean; message: string; channel?: string }>;
  publishPost(postId: string, platforms?: string[]): Promise<PublishOutcome>;
  schedulerStatus(): Promise<EngineStatus>;
  configureScheduler(patch: Partial<EngineConfig>): Promise<EngineConfig>;
  tickNow(): Promise<EngineStatus>;
  messenger: {
    mount(serviceId: string, url: string, bounds?: ViewBounds): Promise<MessengerState | null>;
    setBounds(bounds: ViewBounds): Promise<{ ok: boolean }>;
    unmount(): Promise<{ ok: boolean }>;
    reload(): Promise<{ ok: boolean }>;
    goBack(): Promise<{ ok: boolean }>;
    goForward(): Promise<{ ok: boolean }>;
    home(url: string): Promise<{ ok: boolean }>;
    state(): Promise<MessengerState | null>;
  };

  logTail(n?: number): Promise<LogEntry[]>;
  logClear(): Promise<{ ok: boolean }>;
  onEvent(fn: (e: BridgeEvent) => void): () => void;
}

declare global {
  interface Window {
    socialdesk?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | undefined =
  typeof window !== 'undefined' ? window.socialdesk : undefined;

export const isDesktop = !!desktop;

/** 统一入口，界面里只用这个，不要直接摸 window.socialdesk */
export const bridge = {
  isDesktop,

  async info(): Promise<AppInfo | null> {
    return desktop ? desktop.info() : null;
  },

  async loadDB(): Promise<{ db: DB | null; exists: boolean }> {
    if (desktop) return desktop.loadDB();
    return { db: null, exists: false };
  },

  async saveDB(db: DB): Promise<void> {
    if (desktop) await desktop.saveDB(db);
  },

  async testConnection(platformId: string, credential: string) {
    if (desktop) return desktop.testConnection(platformId, credential);
    return null;
  },

  async publishPost(postId: string, platforms?: string[]): Promise<PublishOutcome | null> {
    if (desktop) return desktop.publishPost(postId, platforms);
    return null;
  },

  async schedulerStatus(): Promise<EngineStatus | null> {
    return desktop ? desktop.schedulerStatus() : null;
  },

  async configureScheduler(patch: Partial<EngineConfig>): Promise<EngineConfig | null> {
    return desktop ? desktop.configureScheduler(patch) : null;
  },

  async tickNow(): Promise<EngineStatus | null> {
    return desktop ? desktop.tickNow() : null;
  },

  /**
   * 消息聚合：桌面版走原生视图（WebContentsView），
   * 浏览器版没有这个能力，界面会自动退回 iframe。
   */
  get hasNativeGuest(): boolean {
    return !!desktop?.messenger;
  },

  messenger: {
    async mount(serviceId: string, url: string, bounds?: ViewBounds): Promise<MessengerState | null> {
      if (!desktop?.messenger) return null;
      return desktop.messenger.mount(serviceId, url, bounds);
    },
    async setBounds(bounds: ViewBounds): Promise<void> {
      if (desktop?.messenger) await desktop.messenger.setBounds(bounds);
    },
    async unmount(): Promise<void> {
      if (desktop?.messenger) await desktop.messenger.unmount();
    },
    async reload(): Promise<void> {
      if (desktop?.messenger) await desktop.messenger.reload();
    },
    async goBack(): Promise<void> {
      if (desktop?.messenger) await desktop.messenger.goBack();
    },
    async goForward(): Promise<void> {
      if (desktop?.messenger) await desktop.messenger.goForward();
    },
    async home(url: string): Promise<void> {
      if (desktop?.messenger) await desktop.messenger.home(url);
    },
    async state(): Promise<MessengerState | null> {
      return desktop?.messenger ? desktop.messenger.state() : null;
    },
    /** 订阅原生视图状态（标题、加载中、前进后退） */
    onState(fn: (s: MessengerState) => void): () => void {
      if (!desktop) return () => {};
      return desktop.onEvent((e) => {
        if (e.type === 'msg:state' && e.payload) fn(e.payload as unknown as MessengerState);
      });
    },
  },

  async logTail(n = 300): Promise<LogEntry[]> {
    return desktop ? desktop.logTail(n) : [];
  },

  async logClear(): Promise<void> {
    if (desktop) await desktop.logClear();
  },

  async snapshot(): Promise<string | null> {
    if (!desktop) return null;
    const r = await desktop.snapshot();
    return r.path;
  },

  async listBackups(): Promise<BackupInfo[]> {
    return desktop ? desktop.listBackups() : [];
  },

  async readBackup(name: string): Promise<DB | null> {
    if (!desktop) return null;
    const r = await desktop.readBackup(name);
    return r.ok && r.db ? r.db : null;
  },

  async exportBackup() {
    if (!desktop) return { ok: false as const, canceled: true };
    return desktop.exportBackup();
  },

  async importBackup() {
    if (!desktop) return { ok: false as const, canceled: true };
    return desktop.importBackup();
  },

  async importLegacy(payload: DB) {
    if (!desktop) return { ok: false as const, error: '非桌面环境' };
    return desktop.importLegacy(payload);
  },

  async saveMedia(name: string, mime: string, data: ArrayBuffer) {
    if (!desktop) return null;
    return desktop.saveMedia(name, mime, data);
  },

  async deleteMedia(payload: { path?: string; url?: string }): Promise<void> {
    if (desktop) await desktop.deleteMedia(payload);
  },

  onEvent(fn: (e: BridgeEvent) => void): () => void {
    if (!desktop) return () => {};
    return desktop.onEvent(fn);
  },

  async openPath(p: string): Promise<void> {
    if (desktop) await desktop.openPath(p);
  },

  async openExternal(url: string): Promise<void> {
    if (desktop) await desktop.openExternal(url);
    else window.open(url, '_blank', 'noopener');
  },

  async setLoginItem(enabled: boolean): Promise<void> {
    if (desktop) await desktop.setLoginItem(enabled);
  },
};

export default bridge;
