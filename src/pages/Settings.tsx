import { useRef, useState } from 'react';
import {
  Globe, Eye, EyeOff, Plus, Trash2, Download, Upload, RotateCcw, Eraser,
  Braces, Clock, Info, ExternalLink, Search,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { FolderOpen, DatabaseBackup, HardDrive } from 'lucide-react';
import { PLATFORMS, PLATFORM_MAP, GROUP_LABEL, CONNECT_LABEL } from '../platforms/registry';
import { Button, Card, CardHead, SectionLabel, Segmented, Toggle, Badge } from '../components/ui';
import { PlatformIcon } from '../components/PlatformIcon';
import { downloadFile, fmtBytes } from '../lib/utils';
import bridge from '../lib/bridge';
import type { DB } from '../types';

const TIMEZONES = [
  'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul',
  'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC',
];

export function SettingsPage() {
  const {
    db, setDB, i18n, setLang, updateSettings, togglePlatform, setPlatforms, pushToast,
    resetDemo, clearAll, storageUsed, appInfo, savedAt, dirty,
  } = useStore();
  const t = i18n.t;
  const lang = i18n.lang;
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<'all' | 'cn' | 'global' | 'community'>('all');
  const [onlyConnected, setOnlyConnected] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const connectedIds = new Set(db.accounts.filter((a) => a.connected).map((a) => a.platformId));

  const list = PLATFORMS.filter((p) => {
    if (group !== 'all' && p.group !== group) return false;
    if (onlyConnected && !connectedIds.has(p.id)) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      if (!p.nameZh.toLowerCase().includes(s) && !p.nameEn.toLowerCase().includes(s) && !p.id.includes(s)) return false;
    }
    return true;
  });

  const hidden = db.settings.hiddenPlatforms;

  async function doExport() {
    // 独立版：弹系统「另存为」对话框，直接写到你选的位置
    if (bridge.isDesktop) {
      const r = await bridge.exportBackup();
      if (r.ok) pushToast(`${t('set.exported')} · ${r.path ?? ''}`);
      else if (!('canceled' in r) || !r.canceled) pushToast('导出失败', 'error');
      return;
    }
    downloadFile(`socialdesk-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2), 'application/json');
    pushToast(t('set.exported'));
  }

  async function doImportDesktop() {
    const r = await bridge.importBackup();
    if (r.ok && 'db' in r && r.db) {
      setDB(() => r.db as DB);
      pushToast(t('set.imported'));
    } else if (!r.canceled) {
      pushToast(r.error ?? '导入失败', 'error');
    }
  }

  function doImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as DB;
        if (!parsed || !Array.isArray(parsed.posts)) throw new Error('bad');
        setDB(() => parsed);
        pushToast(t('set.imported'));
      } catch {
        pushToast('Import failed', 'error');
      }
    };
    reader.readAsText(file);
  }

  const vars = Object.entries(db.settings.brandVars);

  return (
    <div className="flex max-w-[1100px] flex-col gap-4">
      {/* 通用 */}
      <Card>
        <CardHead title={<span className="flex items-center gap-2"><Globe size={15} />{t('set.language')} · {t('set.theme')}</span>} />
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-2">
          <div>
            <SectionLabel>{t('set.language')}</SectionLabel>
            <Segmented
              value={db.settings.lang}
              onChange={(v) => {
                setLang(v);
                pushToast(t('toast.langChanged'));
              }}
              options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]}
            />
          </div>
          <div>
            <SectionLabel>{t('set.theme')}</SectionLabel>
            <Segmented
              value={db.settings.theme}
              onChange={(v) => updateSettings({ theme: v })}
              options={[{ value: 'dark', label: t('set.dark') }, { value: 'light', label: t('set.light') }]}
            />
          </div>
        </div>
      </Card>

      {/* 平台显示 —— 核心功能 */}
      <Card>
        <CardHead
          title={<span className="flex items-center gap-2"><Eye size={15} />{t('set.platforms')}</span>}
          sub={t('set.platformsHint')}
          right={
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setPlatforms(PLATFORMS.map((p) => p.id))}>{t('set.showAll')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setPlatforms([])}>{t('set.showNone')}</Button>
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} className="input h-[32px] w-[190px] pl-8" />
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'cn', 'global', 'community'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className="chip"
                style={{
                  borderColor: group === g ? 'var(--sd-brand)' : undefined,
                  color: group === g ? 'var(--sd-fg)' : undefined,
                  background: group === g ? 'color-mix(in srgb, var(--sd-brand) 14%, transparent)' : undefined,
                }}
              >
                {g === 'all' ? t('common.all') : GROUP_LABEL[g][lang]}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            <input type="checkbox" checked={onlyConnected} onChange={(e) => setOnlyConnected(e.target.checked)} />
            {t('set.onlyConnected')}
          </label>
          <Badge className="bg-line text-muted">
            {PLATFORMS.length - hidden.length}/{PLATFORMS.length}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => {
            const on = !hidden.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className="flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all"
                style={{
                  borderColor: on ? `color-mix(in srgb, ${p.color} 55%, transparent)` : 'var(--sd-line)',
                  background: on ? `color-mix(in srgb, ${p.color} 9%, transparent)` : 'transparent',
                  opacity: on ? 1 : 0.55,
                }}
              >
                <PlatformIcon id={p.id} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{lang === 'zh' ? p.nameZh : p.nameEn}</span>
                  <span className="block truncate text-[10.5px] text-faint">
                    {CONNECT_LABEL[p.connect][lang === 'zh' ? 'zh' : 'en']}
                  </span>
                </span>
                {on ? <Eye size={14} className="shrink-0" style={{ color: p.color }} /> : <EyeOff size={14} className="shrink-0 text-faint" />}
              </button>
            );
          })}
          {list.length === 0 ? (
            <div className="col-span-full py-8 text-center text-[12.5px] text-faint">{t('common.noData')}</div>
          ) : null}
        </div>
      </Card>

      {/* 品牌变量 */}
      <Card>
        <CardHead title={<span className="flex items-center gap-2"><Braces size={15} />{t('set.brand')}</span>} sub={t('set.brandHint')} />
        <div className="flex flex-col gap-2 px-4 pb-4">
          {vars.map(([k, v], i) => (
            <div key={k + i} className="flex items-center gap-2">
              <input
                value={k}
                onChange={(e) => {
                  const next = { ...db.settings.brandVars };
                  delete next[k];
                  next[e.target.value] = v;
                  updateSettings({ brandVars: next });
                }}
                placeholder={t('set.varName')}
                className="input w-[160px]"
              />
              <input
                value={v}
                onChange={(e) => updateSettings({ brandVars: { ...db.settings.brandVars, [k]: e.target.value } })}
                placeholder={t('set.varValue')}
                className="input flex-1"
              />
              <button
                onClick={() => {
                  const next = { ...db.settings.brandVars };
                  delete next[k];
                  updateSettings({ brandVars: next });
                }}
                className="rounded p-1.5 text-faint transition-colors hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            className="self-start"
            onClick={() => {
              let n = 1;
              while (db.settings.brandVars[`变量${n}`]) n++;
              updateSettings({ brandVars: { ...db.settings.brandVars, [`变量${n}`]: '' } });
            }}
          >
            <Plus size={14} /> {t('set.addVar')}
          </Button>
        </div>
      </Card>

      {/* 时间 */}
      <Card>
        <CardHead title={<span className="flex items-center gap-2"><Clock size={15} />{t('set.time')}</span>} />
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-2">
          <div>
            <SectionLabel>{t('set.weekStart')}</SectionLabel>
            <Segmented
              value={String(db.settings.weekStart)}
              onChange={(v) => updateSettings({ weekStart: v === '1' ? 1 : 0 })}
              options={[{ value: '1', label: t('set.monday') }, { value: '0', label: t('set.sunday') }]}
            />
          </div>
          <div>
            <SectionLabel>{t('set.timezone')}</SectionLabel>
            <select
              value={db.settings.timezone}
              onChange={(e) => updateSettings({ timezone: e.target.value })}
              className="input"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Toggle
              checked={db.settings.smartTime}
              onChange={(v) => updateSettings({ smartTime: v })}
              label={t('set.smartTime')}
              hint={t('set.smartTimeHint')}
            />
          </div>
          <div className="md:col-span-2">
            <Toggle
              checked={db.settings.autoFirstComment}
              onChange={(v) => updateSettings({ autoFirstComment: v })}
              label={t('set.autoFirstComment')}
              hint={t('set.autoFirstCommentHint')}
            />
          </div>
        </div>
      </Card>

      {/* 数据 */}
      <Card>
        <CardHead
          title={<span className="flex items-center gap-2"><Download size={15} />{t('set.data')}</span>}
          sub={
            bridge.isDesktop
              ? `${bridge.isDesktop ? t('eng.fileStore') : t('eng.browserStore')} · ${fmtBytes(storageUsed)}${
                  savedAt ? ` · ${dirty ? t('eng.saving') : t('eng.saved')} ${savedAt.slice(11, 19)}` : ''
                }`
              : `${t('set.storage')}: ${fmtBytes(storageUsed)}`
          }
        />
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <Button size="sm" onClick={() => void doExport()}><Download size={14} /> {t('set.export')}</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
          <Button
            size="sm"
            onClick={() => (bridge.isDesktop ? void doImportDesktop() : fileRef.current?.click())}
          >
            <Upload size={14} /> {t('set.import')}
          </Button>
          <Button size="sm" onClick={() => { resetDemo(); pushToast(t('set.demoLoaded')); }}>
            <RotateCcw size={14} /> {t('set.demo')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm(t('set.confirmClear'))) {
                clearAll();
                pushToast(t('set.cleared'));
              }
            }}
          >
            <Eraser size={14} /> {t('set.clear')}
          </Button>
        </div>
        {bridge.isDesktop ? (
          <div className="mx-4 mb-4 rounded-[10px] border border-line bg-raise/60 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-faint">
              <HardDrive size={12} /> {t('eng.dataDir')}
            </div>
            <div className="mb-2.5 break-all font-mono text-[11px] text-muted">{appInfo?.dataDir ?? '—'}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => void bridge.openPath(appInfo?.dataDir ?? '')}>
                <FolderOpen size={13} /> {t('eng.openDataDir')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const p = await bridge.snapshot();
                  pushToast(p ? `${t('eng.backupNow')} ✓` : t('eng.backupNow'));
                }}
              >
                <DatabaseBackup size={13} /> {t('eng.backupNow')}
              </Button>
            </div>
          </div>
        ) : null}
        <p className="px-4 pb-4 text-[11.5px] text-faint">
          {bridge.isDesktop
            ? '数据以 JSON 文件形式保存在你自己电脑的数据目录里，不受浏览器 5MB 限制，清缓存也不会丢。素材原图存在 media/ 子目录。'
            : t('set.storageHint')}
        </p>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHead title={<span className="flex items-center gap-2"><Info size={15} />{t('set.about')}</span>} />
        <div className="px-4 pb-4">
          <p className="text-[12.5px] leading-relaxed text-muted">
            {bridge.isDesktop ? t('set.aboutBodyDesktop') : t('set.aboutBody')}
          </p>
          <div className="mt-3">
            <SectionLabel>{t('set.credits')}</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {[
                { name: 'Postiz', desc: '37.2k★ · AGPL-3.0 · Next.js/NestJS — 产品形态参考', url: 'https://github.com/gitroomhq/postiz-app' },
                { name: 'Mixpost', desc: '3.8k★ · MIT 核心 + 买断授权 — 多平台排期与审批流', url: 'https://github.com/inovector/mixpost' },
                { name: 'social-auto-upload', desc: '15.5k★ · MIT · Python — 国内平台 cookie 自动发布', url: 'https://github.com/dreammis/social-auto-upload' },
                { name: 'Recharts / Lucide', desc: 'MIT — 图表与图标', url: 'https://github.com/recharts/recharts' },
              ].map((r) => (
                <a
                  key={r.name}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="card-raise flex items-center gap-2 px-3 py-2 text-[12px] transition-colors hover:border-brand"
                >
                  <ExternalLink size={13} className="text-muted" />
                  <span className="font-semibold">{r.name}</span>
                  <span className="min-w-0 flex-1 truncate text-faint">{r.desc}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {void PLATFORM_MAP}
    </div>
  );
}
