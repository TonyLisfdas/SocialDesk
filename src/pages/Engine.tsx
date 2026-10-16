import { useEffect, useMemo, useState } from 'react';
import {
  Radio, Play, Pause, RefreshCw, FolderOpen, FileText, ShieldCheck, Send, AlertTriangle,
  CheckCircle2, Clock, HardDrive, DatabaseBackup, RotateCcw, Activity, Zap, Info,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { PLATFORMS } from '../platforms/registry';
import { PlatformIcon } from '../components/PlatformIcon';
import { Button, Card, CardHead, Empty, Toggle, Badge } from '../components/ui';
import bridge, { type BackupInfo, type LogEntry } from '../lib/bridge';
import { fmtDate, fmtBytes, cn } from '../lib/utils';

const ADAPTER_LABEL: Record<string, { zh: string; en: string; tone: string }> = {
  telegram: { zh: 'Telegram Bot', en: 'Telegram Bot', tone: 'bg-[#2AABEE]/15 text-[#2AABEE]' },
  bluesky: { zh: 'Bluesky 官方 API', en: 'Bluesky API', tone: 'bg-[#0085FF]/15 text-[#0085FF]' },
  discord: { zh: 'Discord Webhook', en: 'Discord Webhook', tone: 'bg-[#5865F2]/15 text-[#5865F2]' },
  mastodon: { zh: 'Mastodon API', en: 'Mastodon API', tone: 'bg-[#6364FF]/15 text-[#6364FF]' },
  webhook: { zh: '自建 Webhook 中转', en: 'Webhook relay', tone: 'bg-[#8b5cf6]/15 text-[#8b5cf6]' },
  localbridge: { zh: '本机 Python 桥', en: 'Local Python bridge', tone: 'bg-[#f59e0b]/15 text-[#f59e0b]' },
  manual: { zh: '人工发布', en: 'Manual', tone: 'bg-white/10 text-faint' },
};

const LEVEL_STYLE: Record<LogEntry['level'], string> = {
  ok: 'text-ok',
  info: 'text-muted',
  warn: 'text-[#f59e0b]',
  error: 'text-danger',
};

export function EnginePage() {
  const { i18n, engine, engineConfig, updateEngine, refreshEngine, pushToast, appInfo, db, reloadFromDisk } =
    useStore();
  const t = i18n.t;
  const lang = i18n.lang;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  /* 日志 / 备份 轮询刷新（引擎状态由 store 统一维护） */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [l, b] = await Promise.all([bridge.logTail(300), bridge.listBackups()]);
      if (!alive) return;
      setLogs(l.slice().reverse());
      setBackups(b);
    };
    void load();
    const timer = window.setInterval(load, 4000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [tick]);

  /* 倒计时每秒重算一次，界面是活的 */
  useEffect(() => {
    const timer = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const channelMap = appInfo?.channelMap ?? {};
  const adapters = appInfo?.adapters ?? [];

  const countdown = useMemo(() => {
    const next = engine?.nextRunAt ? new Date(engine.nextRunAt).getTime() : 0;
    if (!next) return '—';
    const s = Math.max(0, Math.round((next - Date.now()) / 1000));
    return `${s}s`;
  }, [engine?.nextRunAt, tick]);

  const scheduledCount = db.posts.filter((p) => p.status === 'scheduled').length;
  const overdueCount = db.posts.filter(
    (p) => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt).getTime() <= Date.now(),
  ).length;

  if (!bridge.isDesktop) {
    return (
      <Card className="p-6">
        <Empty
          icon={<AlertTriangle size={30} />}
          title={t('eng.title')}
          hint={t('eng.noDesktop')}
        />
      </Card>
    );
  }

  async function doTick() {
    setBusy(true);
    await bridge.tickNow();
    await refreshEngine();
    setBusy(false);
    setTick((x) => x + 1);
    pushToast(t('eng.checkNow'));
  }

  async function doBackup() {
    const p = await bridge.snapshot();
    setTick((x) => x + 1);
    pushToast(p ? `${t('eng.backupNow')} ✓` : t('eng.backupNow'));
  }

  async function doRestore(name: string) {
    if (!window.confirm(t('eng.restoreConfirm'))) return;
    const restored = await bridge.readBackup(name);
    if (!restored) {
      pushToast('恢复失败', 'error');
      return;
    }
    await bridge.saveDB(restored);
    await reloadFromDisk();
    pushToast(t('eng.restored'));
    setTick((x) => x + 1);
  }

  const running = !!engine?.running && !!engineConfig?.enabled;

  return (
    <div className="flex flex-col gap-4">
      {/* ============ 状态总览 ============ */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5">
          <span
            className={cn(
              'relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--sd-r-md)]',
              running ? 'bg-ok/15 text-ok' : 'bg-white/10 text-faint',
            )}
          >
            <Radio size={17} />
            {running ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-ok" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold">{t('eng.title')}</span>
              <Badge className={running ? 'bg-ok/15 text-ok' : 'bg-white/10 text-faint'}>
                {running ? t('eng.running') : t('eng.stopped')}
              </Badge>
            </div>
            <div className="mt-0.5 text-[12px] text-muted">{t('eng.subtitle')}</div>
          </div>
          <Button size="sm" onClick={() => void updateEngine({ enabled: !engineConfig?.enabled })}>
            {engineConfig?.enabled ? <Pause size={13} /> : <Play size={13} />}
            {engineConfig?.enabled ? t('eng.stopped') : t('eng.running')}
          </Button>
          <Button size="sm" variant="primary" onClick={doTick} disabled={busy}>
            {busy ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
            {t('eng.checkNow')}
          </Button>
        </div>

        <div className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
          <Metric
            icon={<Send size={14} />}
            label={t('eng.countPublished')}
            value={engine?.published ?? 0}
            accent="text-ok"
            sub={`队列中待发 ${scheduledCount}${overdueCount ? ` · 已逾期 ${overdueCount}` : ''}`}
          />
          <Metric
            icon={<AlertTriangle size={14} />}
            label={t('eng.countFailed')}
            value={engine?.failed ?? 0}
            accent={engine?.failed ? 'text-danger' : undefined}
            sub={t('eng.retryHint')}
          />
          <Metric
            icon={<Clock size={14} />}
            label={t('eng.lastTick')}
            value={engine?.lastTickAt ? fmtDate(engine.lastTickAt, lang) : '—'}
            sub={engine?.lastPublishAt ? `${t('eng.lastPublish')}：${fmtDate(engine.lastPublishAt, lang)}` : '—'}
          />
          <Metric
            icon={<RefreshCw size={14} />}
            label={t('eng.nextRun')}
            value={countdown}
            sub={engine?.inFlight?.length ? `正在发布 ${engine.inFlight.length} 条` : t('eng.autoPublishHint')}
          />
        </div>
      </Card>

      {/* ============ 引擎参数 ============ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title={t('eng.status')} icon={<Activity size={14} className="text-brand" />} />
          <div className="space-y-3 px-4 pb-4">
            <Toggle
              checked={!!engineConfig?.enabled}
              onChange={(v) => void updateEngine({ enabled: v })}
              label={t('eng.enable')}
              hint={t('eng.enableHint')}
            />
            <Toggle
              checked={!!engineConfig?.launchAtLogin}
              onChange={(v) => void updateEngine({ launchAtLogin: v })}
              label={t('eng.launchAtLogin')}
              hint={t('eng.launchAtLoginHint')}
            />
            <Toggle
              checked={!!engineConfig?.minimizeToTray}
              onChange={(v) =>
                void updateEngine({ minimizeToTray: v, keepRunningInTray: v })
              }
              label={t('eng.minimizeToTray')}
              hint={t('eng.minimizeToTrayHint')}
            />
            <Toggle
              checked={!!engineConfig?.notifyOnPublish}
              onChange={(v) => void updateEngine({ notifyOnPublish: v })}
              label={t('eng.notify')}
              hint={t('eng.notifyHint')}
            />
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[13px]">{t('eng.interval')}</span>
              <input
                type="range"
                min={5}
                max={300}
                step={5}
                value={engineConfig?.intervalSec ?? 20}
                onChange={(e) => void updateEngine({ intervalSec: Number(e.target.value) })}
                className="h-1 flex-1 accent-[var(--sd-brand)]"
              />
              <span className="w-14 text-right text-[13px] tabular-nums text-muted">
                {engineConfig?.intervalSec ?? 20} {t('eng.intervalUnit')}
              </span>
            </div>
            <p className="text-[12px] text-faint">{t('eng.intervalHint')}</p>
          </div>
        </Card>

        <Card>
          <CardHead
            title={t('eng.storage')}
            sub={t('eng.backupHint')}
            icon={<DatabaseBackup size={14} className="text-brand" />}
            right={
              <Button size="sm" onClick={doBackup}>
                <DatabaseBackup size={13} /> {t('eng.backupNow')}
              </Button>
            }
          />
          <div className="space-y-2.5 px-4 pb-4">
            <PathRow
              icon={<HardDrive size={13} />}
              label={t('eng.dataDir')}
              value={appInfo?.dataDir ?? '—'}
              onOpen={() => void bridge.openPath(appInfo?.dataDir ?? '')}
            />
            <PathRow
              icon={<FileText size={13} />}
              label={t('eng.logFile')}
              value={appInfo?.logFile ?? '—'}
              onOpen={() => void bridge.openPath(appInfo?.logFile ?? '')}
            />
            <div className="rounded-[var(--sd-r-md)] border border-line bg-raise/60 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium">{t('eng.backups')}</span>
                <span className="text-[11px] text-faint">{backups.length}</span>
              </div>
              <div className="scroll-thin max-h-[132px] space-y-1 overflow-y-auto">
                {backups.length === 0 ? (
                  <div className="py-2 text-[12px] text-faint">—</div>
                ) : (
                  backups.slice(0, 20).map((b) => (
                    <div key={b.name} className="flex items-center gap-2 rounded-[var(--sd-r-sm)] px-1.5 py-1 text-[12px] hover:bg-raise">
                      <span className="truncate text-muted">{b.name.replace(/^backup-/, '').replace(/\.json$/, '')}</span>
                      <span className="ml-auto shrink-0 text-faint">{fmtBytes(b.bytes)}</span>
                      <button
                        onClick={() => void doRestore(b.name)}
                        className="shrink-0 rounded p-1 text-faint hover:text-brand"
                        title={t('eng.restore')}
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ============ 通道矩阵 ============ */}
      <Card>
        <CardHead
          title={t('eng.channels')}
          sub={t('eng.channelsHint')}
          icon={<ShieldCheck size={14} className="text-brand" />}
        />
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="pb-2 pl-1 font-semibold">{t('eng.channelCol')}</th>
                <th className="pb-2 font-semibold">{t('eng.channelRoute')}</th>
                <th className="pb-2 font-semibold">{t('eng.channelCredential')}</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORMS.map((p) => {
                const channel = channelMap[p.id] ?? 'manual';
                const meta = ADAPTER_LABEL[channel] ?? ADAPTER_LABEL.manual;
                const adapter = adapters.find((a) => a.id === channel);
                const account = db.accounts.find((a) => a.platformId === p.id && a.connected);
                return (
                  <tr key={p.id} className="border-t border-line/70">
                    <td className="py-2 pl-1">
                      <div className="flex items-center gap-2">
                        <PlatformIcon id={p.id} size={18} />
                        <span className="truncate">{lang === 'zh' ? p.nameZh : p.nameEn}</span>
                        {account ? <CheckCircle2 size={12} className="shrink-0 text-ok" /> : null}
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={cn('rounded-[var(--sd-r-xs)] px-2 py-[3px] text-[11px] font-medium', meta.tone)}>
                        {lang === 'zh' ? meta.zh : meta.en}
                      </span>
                    </td>
                    <td className="py-2 pr-1">
                      <code className="text-[11px] text-muted">{adapter ? adapter.credentialHint : '—'}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ============ 最近自动发布 ============ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title={t('eng.recent')} icon={<Send size={14} className="text-brand" />} />
          <div className="space-y-1.5 px-4 pb-4">
            {(engine?.recent ?? []).length === 0 ? (
              <div className="py-3 text-[12px] text-faint">{t('eng.recentEmpty')}</div>
            ) : (
              (engine?.recent ?? [])
                .slice()
                .reverse()
                .slice(0, 12)
                .map((r, i) => (
                  <div key={`${r.postId}-${i}`} className="flex items-center gap-2 rounded-[var(--sd-r-sm)] bg-raise/60 px-2.5 py-1.5 text-[12px]">
                    {r.ok ? <CheckCircle2 size={12} className="text-ok" /> : <AlertTriangle size={12} className="text-danger" />}
                    <span className="truncate text-muted">{r.summary}</span>
                    <span className="ml-auto shrink-0 text-faint">{fmtDate(r.at, lang)}</span>
                  </div>
                ))
            )}
          </div>
        </Card>

        <Card>
          <CardHead
            title={t('eng.logs')}
            icon={<FileText size={14} className="text-brand" />}
            right={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void bridge.logClear();
                  setTick((x) => x + 1);
                }}
              >
                {t('eng.clearLogs')}
              </Button>
            }
          />
          <div className="px-4 pb-4">
            <div className="scroll-thin h-[260px] overflow-y-auto rounded-[var(--sd-r-md)] border border-line bg-[#07090d] p-2.5 font-mono text-[11px] leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-faint">{t('eng.logsEmpty')}</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 text-faint/70">{(l.at || '').slice(11, 19)}</span>
                    <span className={cn('shrink-0 uppercase', LEVEL_STYLE[l.level])}>{l.level}</span>
                    <span className="text-muted">
                      {l.msg}
                      {l.meta ? <span className="text-faint/70"> {compact(l.meta)}</span> : null}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ============ 运行环境 ============ */}
      <Card>
        <CardHead title={t('eng.runtime')} icon={<Info size={14} className="text-brand" />} />
        <div className="grid gap-2 px-4 pb-4 text-[12px] text-muted md:grid-cols-2">
          <div className="flex justify-between rounded-[var(--sd-r-sm)] bg-raise/60 px-3 py-1.5">
            <span className="text-faint">SocialDesk</span>
            <span>v{appInfo?.version ?? '—'}</span>
          </div>
          <div className="flex justify-between rounded-[var(--sd-r-sm)] bg-raise/60 px-3 py-1.5">
            <span className="text-faint">Electron / Node</span>
            <span>
              {appInfo?.versions?.electron ?? '—'} / {appInfo?.versions?.node ?? '—'}
            </span>
          </div>
          <div className="flex justify-between rounded-[var(--sd-r-sm)] bg-raise/60 px-3 py-1.5">
            <span className="text-faint">{t('eng.dbFile')}</span>
            <span className="truncate">{appInfo?.dbFile ?? '—'}</span>
          </div>
          <div className="flex justify-between rounded-[var(--sd-r-sm)] bg-raise/60 px-3 py-1.5">
            <span className="text-faint">平台总数 / 通道</span>
            <span>
              {PLATFORMS.length} / {Object.keys(channelMap).filter((k) => channelMap[k] !== 'manual').length}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Metric({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[12px] text-faint">
        {icon}
        {label}
      </div>
      <div className={cn('mt-1 text-[20px] font-semibold tabular-nums', accent)}>{value}</div>
      {sub ? <div className="mt-0.5 line-clamp-2 text-[11px] text-faint">{sub}</div> : null}
    </div>
  );
}

function PathRow({
  icon, label, value, onOpen,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--sd-r-md)] border border-line bg-raise/60 px-2.5 py-2">
      <span className="text-faint">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div className="truncate text-[12px]">{value}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={onOpen}>
        <FolderOpen size={12} />
      </Button>
    </div>
  );
}

function compact(meta: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(meta);
    return s.length > 150 ? s.slice(0, 150) + '…' : s;
  } catch {
    return '';
  }
}
