import {
  LayoutDashboard, CalendarDays, PenLine, Images, Lightbulb, ListChecks, Inbox,
  BarChart3, Users, Settings, EyeOff, ChevronRight, Sparkles, Radio, MessagesSquare,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { PLATFORMS, PLATFORM_MAP } from '../platforms/registry';
import { PlatformIcon } from './PlatformIcon';
import { cn } from '../lib/utils';

export type PageKey =
  | 'dashboard' | 'calendar' | 'composer' | 'media' | 'ideas'
  | 'queue' | 'engine' | 'inbox' | 'analytics' | 'messenger' | 'accounts' | 'settings';

export const NAV: { key: PageKey; icon: typeof LayoutDashboard; group: 'content' | 'insight' | 'system' }[] = [
  { key: 'dashboard', icon: LayoutDashboard, group: 'content' },
  { key: 'calendar', icon: CalendarDays, group: 'content' },
  { key: 'composer', icon: PenLine, group: 'content' },
  { key: 'media', icon: Images, group: 'content' },
  { key: 'ideas', icon: Lightbulb, group: 'content' },
  { key: 'queue', icon: ListChecks, group: 'content' },
  { key: 'inbox', icon: Inbox, group: 'insight' },
  { key: 'analytics', icon: BarChart3, group: 'insight' },
  { key: 'messenger', icon: MessagesSquare, group: 'insight' },
  { key: 'accounts', icon: Users, group: 'system' },
  { key: 'engine', icon: Radio, group: 'system' },
  { key: 'settings', icon: Settings, group: 'system' },
];

export function Sidebar({ page, onNavigate }: { page: PageKey; onNavigate: (p: PageKey) => void }) {
  const { i18n, db, togglePlatform, enabledPlatforms, engine, engineConfig } = useStore();
  const t = i18n.t;
  const lang = i18n.lang;
  const engineOn = !!engine?.running && !!engineConfig?.enabled;

  const groups: { key: 'content' | 'insight' | 'system'; label: string }[] = [
    { key: 'content', label: t('group.content') },
    { key: 'insight', label: t('group.insight') },
    { key: 'system', label: t('group.system') },
  ];

  const unread = db.inbox.filter((i) => !i.read).length;
  const scheduled = db.posts.filter((p) => p.status === 'scheduled').length;

  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-line bg-panel">
      {/* 品牌 */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="brand-grad flex h-9 w-9 items-center justify-center rounded-[var(--sd-r-md)] text-[13px] font-black text-white shadow-sm">
          SD
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-tight">SocialDesk</div>
          <div className="truncate text-[12px] text-faint">{t('app.tagline')}</div>
        </div>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2.5 pb-3">
        {groups.map((g) => (
          <div key={g.key} className="mb-3">
            <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              {g.label}
            </div>
            {NAV.filter((n) => n.group === g.key).map((n) => {
              const Icon = n.icon;
              const active = page === n.key;
              const badge = n.key === 'inbox' ? unread : n.key === 'queue' ? scheduled : 0;
              return (
                <button
                  key={n.key}
                  onClick={() => onNavigate(n.key)}
                  data-active={active}
                  aria-current={active ? 'page' : undefined}
                  className="nav-item hit mb-0.5"
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
                  ) : null}
                  <Icon size={16} className={cn('shrink-0', active ? 'text-brand' : '')} />
                  <span className="truncate">{t(`nav.${n.key}` as never)}</span>
                  {n.key === 'engine' ? (
                    <span
                      className={cn(
                        'ml-auto h-1.5 w-1.5 rounded-full',
                        engineOn ? 'bg-ok shadow-[0_0_6px_var(--color-ok)]' : 'bg-white/25',
                      )}
                    />
                  ) : badge > 0 ? (
                    <span className="tnum ml-auto rounded-full bg-brand px-1.5 text-[11px] font-bold leading-[17px] text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}

        <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
          {t('dash.enabledPlatforms')}
        </div>
        <div className="space-y-0.5">
          {enabledPlatforms.map((p) => (
            <div
              key={p.id}
              className="group hit relative flex min-h-[34px] items-center gap-2.5 rounded-[var(--sd-r-sm)] px-2.5 text-[13px] text-muted transition-colors hover:bg-raise hover:text-fg"
            >
              <PlatformIcon id={p.id} size={17} />
              <span className="truncate">{lang === 'zh' ? p.nameZh : p.nameEn}</span>
              <button
                onClick={() => togglePlatform(p.id)}
                title={t('set.hidden')}
                aria-label={t('set.hidden')}
                className="ml-auto rounded-[var(--sd-r-xs)] p-1.5 opacity-0 transition-opacity hover:bg-raise hover:text-fg group-hover:opacity-100"
              >
                <EyeOff size={13} />
              </button>
            </div>
          ))}
          {enabledPlatforms.length === 0 ? (
            <div className="px-2.5 py-2 text-[12px] text-faint">{t('set.showNone')}</div>
          ) : null}
        </div>
      </nav>

      {/* 平台显示入口 */}
      <button
        onClick={() => onNavigate('settings')}
        className="hit m-2.5 flex items-center gap-2.5 rounded-[var(--sd-r-md)] border border-line bg-raise px-3 py-2.5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--sd-brand)_50%,transparent)]"
      >
        <Sparkles size={14} className="text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold">{t('set.platforms')}</span>
          <span className="tnum block text-[12px] text-faint">
            {enabledPlatforms.length}/{PLATFORMS.length}
          </span>
        </span>
        <ChevronRight size={14} className="text-faint" />
      </button>
    </aside>
  );
}

export function platformName(id: string, lang: 'zh' | 'en'): string {
  const p = PLATFORM_MAP[id];
  if (!p) return id;
  return lang === 'zh' ? p.nameZh : p.nameEn;
}
