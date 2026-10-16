import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, List, Filter, Clock, AlertCircle } from 'lucide-react';
import { useStore } from '../lib/store';
import { PLATFORM_MAP } from '../platforms/registry';
import { monthMatrix, sameDay, fmtTime, truncate, fromLocalInput, toLocalInput, addDays } from '../lib/utils';
import { Button, Card, Segmented, Badge } from '../components/ui';
import { PlatformIcon } from '../components/PlatformIcon';
import { StatusBadge } from '../components/PostEditor';
import type { PostStatus } from '../types';

type View = 'month' | 'list';

export function Calendar({
  onEdit,
  onCreate,
}: {
  onEdit: (id: string) => void;
  onCreate: (dateISO?: string) => void;
}) {
  const { db, setDB, i18n, enabledPlatforms, pushToast } = useStore();
  const t = i18n.t;
  const lang = i18n.lang;

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [view, setView] = useState<View>('month');
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const weekStart = db.settings.weekStart;
  const days = useMemo(() => monthMatrix(cursor.y, cursor.m, weekStart), [cursor, weekStart]);

  const filtered = useMemo(
    () =>
      db.posts.filter((p) => {
        if (platformFilter.length && !p.platforms.some((x) => platformFilter.includes(x))) return false;
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        return true;
      }),
    [db.posts, platformFilter, statusFilter],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const p of filtered) {
      const at = p.scheduledAt ?? p.publishedAt;
      if (!at) continue;
      const key = new Date(at).toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    map.forEach((arr) => arr.sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')));
    return map;
  }, [filtered]);

  const monthLabel =
    lang === 'zh'
      ? `${cursor.y} 年 ${cursor.m + 1} 月`
      : new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const weekdayLabels = useMemo(() => {
    const zh = ['日', '一', '二', '三', '四', '五', '六'];
    const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const base = lang === 'zh' ? zh : en;
    return Array.from({ length: 7 }, (_, i) => base[(i + weekStart) % 7]);
  }, [lang, weekStart]);

  function move(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function onDrop(date: Date) {
    if (!dragId) return;
    const post = db.posts.find((p) => p.id === dragId);
    setDragId(null);
    if (!post) return;
    const prev = post.scheduledAt ?? post.publishedAt;
    const d = new Date(date);
    if (prev) {
      const old = new Date(prev);
      d.setHours(old.getHours(), old.getMinutes(), 0, 0);
    } else {
      d.setHours(10, 0, 0, 0);
    }
    setDB((dbx) => ({
      ...dbx,
      posts: dbx.posts.map((p) =>
        p.id === dragId
          ? {
              ...p,
              scheduledAt: d.toISOString(),
              status: p.status === 'published' ? 'scheduled' : p.status,
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    }));
    pushToast(t('comp.scheduledToast'));
  }

  const listGroups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const p of filtered) {
      const at = p.scheduledAt ?? p.publishedAt;
      if (!at) continue;
      const key = new Date(at).toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => move(-1)}><ChevronLeft size={16} /></Button>
          <span className="min-w-[120px] text-center text-[14px] font-semibold">{monthLabel}</span>
          <Button size="sm" variant="ghost" onClick={() => move(1)}><ChevronRight size={16} /></Button>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const d = new Date();
            setCursor({ y: d.getFullYear(), m: d.getMonth() });
          }}
        >
          {t('cal.today')}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant={showFilter ? 'primary' : 'default'} onClick={() => setShowFilter((v) => !v)}>
            <Filter size={14} /> {t('common.filter')}
            {platformFilter.length ? <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{platformFilter.length}</span> : null}
          </Button>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'month', label: <span className="flex items-center gap-1"><CalendarDays size={13} />{t('cal.month')}</span> },
              { value: 'list', label: <span className="flex items-center gap-1"><List size={13} />{t('cal.list')}</span> },
            ]}
          />
          <Button size="sm" variant="primary" onClick={() => onCreate()}>{t('dash.newPost')}</Button>
        </div>
      </div>

      {showFilter ? (
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label mr-1">{t('cal.filterPlatform')}</span>
            {enabledPlatforms.map((p) => {
              const on = platformFilter.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setPlatformFilter((f) => (on ? f.filter((x) => x !== p.id) : [...f, p.id]))}
                  className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[12px] transition-colors"
                  style={{
                    borderColor: on ? p.color : 'var(--sd-line2)',
                    background: on ? `color-mix(in srgb, ${p.color} 14%, transparent)` : 'transparent',
                    color: on ? 'var(--sd-fg)' : 'var(--sd-muted)',
                  }}
                >
                  <PlatformIcon id={p.id} size={15} />
                  {lang === 'zh' ? p.nameZh : p.nameEn}
                </button>
              );
            })}
            {platformFilter.length ? (
              <button className="btn btn-sm btn-ghost" onClick={() => setPlatformFilter([])}>{t('common.clear')}</button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="label mr-1">{t('cal.filterStatus')}</span>
            {(['all', 'draft', 'scheduled', 'published', 'failed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="chip"
                style={{
                  borderColor: statusFilter === s ? 'var(--sd-brand)' : undefined,
                  color: statusFilter === s ? 'var(--sd-fg)' : undefined,
                  background: statusFilter === s ? 'color-mix(in srgb, var(--sd-brand) 14%, transparent)' : undefined,
                }}
              >
                {s === 'all' ? t('common.all') : t(`status.${s}` as never)}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {view === 'month' ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-raise">
            {weekdayLabels.map((w) => (
              <div key={w} className="px-2 py-2 text-center text-[11.5px] font-semibold text-faint">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const items = byDay.get(key) ?? [];
              const inMonth = d.getMonth() === cursor.m;
              const isToday = sameDay(d, new Date());
              return (
                <div
                  key={key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(d)}
                  onDoubleClick={() => onCreate(d.toISOString())}
                  className="min-h-[112px] cursor-pointer border-b border-r border-line p-1.5 transition-colors hover:bg-raise/50"
                  style={{ opacity: inMonth ? 1 : 0.42 }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11.5px] tabular-nums"
                      style={{
                        background: isToday ? 'var(--sd-brand)' : 'transparent',
                        color: isToday ? '#fff' : 'var(--sd-muted)',
                        fontWeight: isToday ? 700 : 500,
                      }}
                    >
                      {d.getDate()}
                    </span>
                    {items.length > 2 ? <span className="text-[10px] text-faint">{items.length}</span> : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    {items.slice(0, 3).map((p) => {
                      const overdue = p.status === 'scheduled' && (p.scheduledAt ?? '') < new Date().toISOString();
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={() => setDragId(p.id)}
                          onDragEnd={() => setDragId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(p.id);
                          }}
                          className="group cursor-grab rounded-md border px-1.5 py-1 text-left transition-colors active:cursor-grabbing"
                          style={{
                            borderColor: dragId === p.id ? 'var(--sd-brand)' : 'var(--sd-line)',
                            background: 'var(--sd-raise)',
                          }}
                          title={p.content}
                        >
                          <div className="flex items-center gap-1">
                            {overdue ? <AlertCircle size={10} className="shrink-0 text-[#f59e0b]" /> : null}
                            <span className="text-[10px] tabular-nums text-faint">{fmtTime(p.scheduledAt ?? p.publishedAt)}</span>
                            <div className="ml-auto flex shrink-0 -space-x-1">
                              {p.platforms.slice(0, 3).map((id) => (
                                <PlatformIcon key={id} id={id} size={11} className="ring-1 ring-raise" />
                              ))}
                            </div>
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-fg">{truncate(p.content, 46)}</div>
                        </div>
                      );
                    })}
                    {items.length > 3 ? (
                      <div className="px-1 text-[10.5px] text-faint">+{items.length - 3} {t('common.more')}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 text-[11.5px] text-faint">
            <span className="flex items-center gap-1"><Clock size={12} /> {t('cal.dragHint')}</span>
            <span className="ml-auto flex items-center gap-2">
              {Array.from(new Set(filtered.flatMap((p) => p.platforms))).slice(0, 8).map((id) => (
                <span key={id} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_MAP[id]?.color }} />
                  {PLATFORM_MAP[id]?.nameZh}
                </span>
              ))}
            </span>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {listGroups.length === 0 ? (
            <div className="py-14 text-center text-[13px] text-faint">{t('cal.emptyMonth')}</div>
          ) : (
            listGroups.map(([day, items]) => {
              const d = new Date(day);
              return (
                <div key={day} className="border-b border-line last:border-0">
                  <div className="flex items-center gap-2 bg-raise px-3 py-1.5 text-[12px] font-semibold">
                    <span>{lang === 'zh' ? `${d.getMonth() + 1}月${d.getDate()}日` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <Badge className="bg-line text-muted">{items.length}</Badge>
                  </div>
                  {items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onEdit(p.id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-raise"
                    >
                      <span className="w-11 shrink-0 text-[11.5px] tabular-nums text-faint">{fmtTime(p.scheduledAt ?? p.publishedAt)}</span>
                      <div className="flex shrink-0 -space-x-1">
                        {p.platforms.map((id) => (
                          <PlatformIcon key={id} id={id} size={16} className="ring-1 ring-panel" />
                        ))}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{p.content}</span>
                      <StatusBadge status={p.status} />
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </Card>
      )}
    </div>
  );
}

export function defaultSchedule(dateISO?: string): string {
  const d = dateISO ? new Date(dateISO) : new Date();
  d.setHours(10, 0, 0, 0);
  if (!dateISO || d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return toLocalInput(d.toISOString());
}

export function nextDayISO(dateISO: string): string {
  return addDays(new Date(dateISO), 1).toISOString();
}

export function isoFromLocal(v: string): string | undefined {
  return fromLocalInput(v);
}
