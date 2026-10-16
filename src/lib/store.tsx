import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { DB, PlatformSpec, Post, Settings } from '../types';
import { PLATFORMS, PLATFORM_MAP } from '../platforms/registry';
import { buildSeed, emptyDB } from './seed';
import { translate, type I18n, type TKey } from '../i18n';
import type { Lang } from '../types';
import bridge, { type AppInfo, type EngineConfig, type EngineStatus } from './bridge';

const KEY = 'socialdesk.db.v1';

export interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'warn' | 'error';
}

interface StoreValue {
  db: DB;
  ready: boolean;
  setDB: (fn: (db: DB) => DB) => void;
  enabledPlatforms: PlatformSpec[];
  isEnabled: (id: string) => boolean;
  togglePlatform: (id: string) => void;
  setPlatforms: (ids: string[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setLang: (lang: Lang) => void;
  i18n: I18n;
  toasts: Toast[];
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  resetDemo: () => void;
  clearAll: () => void;
  storageUsed: number;
  /* —— 独立版新增 —— */
  appInfo: AppInfo | null;
  engine: EngineStatus | null;
  engineConfig: EngineConfig | null;
  updateEngine: (patch: Partial<EngineConfig>) => Promise<void>;
  refreshEngine: () => Promise<void>;
  reloadFromDisk: () => Promise<void>;
  savedAt: string | null;
  dirty: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

/* ------------------------------------------------------------------ */
/* 载入：桌面端读磁盘文件；浏览器端退回 localStorage                    */
/* ------------------------------------------------------------------ */
function loadBrowserDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return buildSeed();
    const parsed = JSON.parse(raw) as DB;
    if (!parsed || !Array.isArray(parsed.posts)) return buildSeed();
    const seed = emptyDB();
    return { ...seed, ...parsed, settings: { ...seed.settings, ...parsed.settings } };
  } catch {
    return buildSeed();
  }
}

/** 首次在桌面端启动：把浏览器版 localStorage 里的数据搬过来，别让用户白干 */
async function migrateLegacyIfAny(): Promise<DB | null> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DB;
    if (!parsed || !Array.isArray(parsed.posts) || parsed.posts.length === 0) return null;
    const res = await bridge.importLegacy(parsed);
    return res.ok && res.db ? res.db : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDbState] = useState<DB>(() => emptyDB());
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [engineConfig, setEngineConfig] = useState<EngineConfig | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const toastId = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const bootedRef = useRef(false);
  const lastSerialized = useRef<string>('');

  const pushToast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  /* ---------------- 启动时载入 ---------------- */
  const boot = useCallback(async () => {
    if (bridge.isDesktop) {
      const info = await bridge.info();
      setAppInfo(info);
      setEngineConfig(info?.engine ?? null);

      const { db: fileDB } = await bridge.loadDB();
      if (fileDB) {
        setDbState(fileDB);
        lastSerialized.current = JSON.stringify(fileDB);
      } else {
        // 磁盘上还没有数据 → 先试迁移浏览器旧数据，再退回演示数据
        const migrated = await migrateLegacyIfAny();
        const initial = migrated ?? buildSeed();
        setDbState(initial);
        lastSerialized.current = JSON.stringify(initial);
        await bridge.saveDB(initial);
      }

      const st = await bridge.schedulerStatus();
      setEngine(st);
      setEngineConfig(st?.config ?? null);
    } else {
      const initial = loadBrowserDB();
      setDbState(initial);
      lastSerialized.current = JSON.stringify(initial);
    }
    bootedRef.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  /* ---------------- 落盘（防抖） ---------------- */
  useEffect(() => {
    if (!bootedRef.current || !ready) return;
    const serialized = JSON.stringify(db);
    if (serialized === lastSerialized.current) return;

    setDirty(true);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (bridge.isDesktop) {
        await bridge.saveDB(db);
        setSavedAt(new Date().toISOString());
        setStorageUsed(serialized.length);
      } else {
        try {
          localStorage.setItem(KEY, serialized);
          setStorageUsed(new Blob([serialized]).size);
          setSavedAt(new Date().toISOString());
        } catch {
          /* 配额爆了 —— 浏览器版才会遇到，独立版无此烦恼 */
        }
      }
      lastSerialized.current = serialized;
      setDirty(false);
    }, 400);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [db, ready]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', db.settings.theme);
  }, [db.settings.theme]);

  /* ---------------- 订阅主进程事件 ---------------- */
  const reloadFromDisk = useCallback(async () => {
    if (!bridge.isDesktop) return;
    const { db: fileDB } = await bridge.loadDB();
    if (fileDB) {
      lastSerialized.current = JSON.stringify(fileDB);
      setDbState(fileDB);
    }
  }, []);

  const refreshEngine = useCallback(async () => {
    if (!bridge.isDesktop) return;
    const st = await bridge.schedulerStatus();
    setEngine(st);
    if (st?.config) setEngineConfig(st.config);
  }, []);

  useEffect(() => {
    if (!bridge.isDesktop) return;
    const off = bridge.onEvent(async (evt) => {
      switch (evt.type) {
        case 'db:changed':
          // 后台引擎改了数据 → 重新读盘，界面实时同步
          await reloadFromDisk();
          break;
        case 'publish:start': {
          const p = evt.payload as { postId?: string } | undefined;
          pushToast(`⏱ 引擎开始发布：${p?.postId ?? ''}`, 'ok');
          break;
        }
        case 'publish:done': {
          const p = evt.payload as { summary?: string; ok?: boolean } | undefined;
          pushToast(
            `${p?.ok ? '✅ 自动发布成功' : '❌ 自动发布失败'} · ${p?.summary ?? ''}`,
            p?.ok ? 'ok' : 'error',
          );
          await refreshEngine();
          break;
        }
        case 'engine:status':
        case 'engine:config':
          await refreshEngine();
          break;
        default:
          break;
      }
    });
    void refreshEngine();
    // 后台引擎状态每 15 秒刷新一次，保证「下次扫描倒计时」是活的
    const t = window.setInterval(() => void refreshEngine(), 15000);
    return () => {
      off();
      window.clearInterval(t);
    };
  }, [pushToast, refreshEngine, reloadFromDisk]);

  /* ---------------- 其余 API ---------------- */
  const setDB = useCallback((fn: (d: DB) => DB) => setDbState((d) => fn(d)), []);

  const enabledPlatforms = useMemo(
    () => PLATFORMS.filter((p) => !db.settings.hiddenPlatforms.includes(p.id)),
    [db.settings.hiddenPlatforms],
  );

  const isEnabled = useCallback(
    (id: string) => !db.settings.hiddenPlatforms.includes(id),
    [db.settings.hiddenPlatforms],
  );

  const togglePlatform = useCallback(
    (id: string) => {
      const hiddenNow = db.settings.hiddenPlatforms.includes(id);
      setDB((d) => {
        const hidden = d.settings.hiddenPlatforms.includes(id);
        return {
          ...d,
          settings: {
            ...d.settings,
            hiddenPlatforms: hidden
              ? d.settings.hiddenPlatforms.filter((x) => x !== id)
              : [...d.settings.hiddenPlatforms, id],
          },
        };
      });
      const p = PLATFORM_MAP[id];
      const name = db.settings.lang === 'zh' ? p?.nameZh : p?.nameEn;
      pushToast(
        translate(
          db.settings.lang,
          hiddenNow ? 'toast.platformShown' : 'toast.platformHidden',
          { name: name ?? id },
        ),
      );
    },
    [db.settings.hiddenPlatforms, db.settings.lang, pushToast, setDB],
  );

  const setPlatforms = useCallback(
    (ids: string[]) => {
      setDB((d) => ({
        ...d,
        settings: {
          ...d.settings,
          hiddenPlatforms: PLATFORMS.filter((p) => !ids.includes(p.id)).map((p) => p.id),
        },
      }));
    },
    [setDB],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setDB((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    },
    [setDB],
  );

  const setLang = useCallback(
    (lang: Lang) => {
      setDB((d) => ({ ...d, settings: { ...d.settings, lang } }));
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    },
    [setDB],
  );

  const i18n = useMemo<I18n>(
    () => ({
      lang: db.settings.lang,
      t: (key: TKey, vars) => translate(db.settings.lang, key, vars),
      setLang,
    }),
    [db.settings.lang, setLang],
  );

  const resetDemo = useCallback(() => {
    const fresh = buildSeed();
    fresh.settings = { ...fresh.settings, lang: db.settings.lang, theme: db.settings.theme };
    setDbState(fresh);
  }, [db.settings.lang, db.settings.theme]);

  const clearAll = useCallback(() => {
    const fresh = emptyDB();
    fresh.settings = { ...fresh.settings, lang: db.settings.lang, theme: db.settings.theme };
    setDbState(fresh);
  }, [db.settings.lang, db.settings.theme]);

  const updateEngine = useCallback(async (patch: Partial<EngineConfig>) => {
    const cfg = await bridge.configureScheduler(patch);
    if (cfg) setEngineConfig(cfg);
  }, []);

  const value: StoreValue = {
    db,
    ready,
    setDB,
    enabledPlatforms,
    isEnabled,
    togglePlatform,
    setPlatforms,
    updateSettings,
    setLang,
    i18n,
    toasts,
    pushToast,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    resetDemo,
    clearAll,
    storageUsed,
    appInfo,
    engine,
    engineConfig,
    updateEngine,
    refreshEngine,
    reloadFromDisk,
    savedAt,
    dirty,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function useT() {
  return useStore().i18n.t;
}

export function usePosts(): Post[] {
  return useStore().db.posts;
}
