import { useMemo } from 'react';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  CalendarClock, PenLine, Send, Eye, Users, Sparkles, ArrowRight, Inbox as InboxIcon,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { PLATFORM_MAP } from '../platforms/registry';
import { buildSeries, buildTopPosts } from '../lib/metrics';
import { Card, CardHead, Stat, Button, Empty, SectionLabel } from '../components/ui';
import { PlatformIcon } from '../components/PlatformIcon';
import { StatusBadge } from '../components/PostEditor';
import { fmtDate, fmtNumber, sameDay, truncate } from '../lib/utils';
import type { PageKey } from '../components/Sidebar';

export function Dashboard({ onNavigate, onEdit }: { onNavigate: (p: PageKey) => void; onEdit: (id: string) => void }) {
  const { db, i18n, enabledPlatforms } = useStore();
  const t = i18n.t;
  const lang = i18n.lang;

  const published = db.posts.filter((p) => p.status === 'published');
  const scheduled = db.posts.filter((p) => p.status === 'scheduled');
  const drafts = db.posts.filter((p) => p.status === 'draft');

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = published.filter((p) => p.publishedAt && new Date(p.publishedAt).getTime() >= monthStart.getTime());

  const series = useMemo(() => buildSeries(published, 56), [published]);
  const weekly = useMemo(() => {
    const out: { label: string; posts: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const slice = series.slice(i * 7, i * 7 + 7);
      out.push({ label: slice[0]?.label ?? '', posts: slice.reduce((a, b) => a + b.posts, 0) });
    }
    return out;
  }, [series]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    published.forEach((p) => p.platforms.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1)));
    return Array.from(map.entries())
      .map(([id, value]) => ({ id, value, name: PLATFORM_MAP[id]?.nameZh ?? id, color: PLATFORM_MAP[id]?.color ?? '#64748b' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [published]);

  const topPosts = useMemo(() => buildTopPosts(published, 30, 5), [published]);
  const totalEngagement = series.reduce((a, b) => a + b.engagements, 0);
  const totalImpressions = series.reduce((a, b) => a + b.impressions, 0);
  const engRate = totalImpressions ? (totalEngagement / totalImpressions) * 100 : 0;
  const followers = series.reduce((a, b) => a + b.followers, 0);

  const today = new Date();
  const todayPosts = db.posts
    .filter((p) => {
      const at = p.scheduledAt ?? p.publishedAt;
      return at && sameDay(new Date(at), today) && p.status !== 'draft';
    })
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));

  const upcoming = scheduled
    .filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() > Date.now())
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
    .slice(0, 6);

  const unread = db.inbox.filter((i) => !i.read).length;

  return (
    <div className="flex flex-col gap-4">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight">{t('dash.hello')}</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {fmtDate(today.toISOString(), lang)} · {enabledPlatforms.length} {t('common.platforms')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onNavigate('composer')}><PenLine size={15} /> {t('dash.newPost')}</Button>
          <Button onClick={() => onNavigate('calendar')}><CalendarClock size={15} /> {t('dash.openCalendar')}</Button>
          <Button onClick={() => onNavigate('accounts')}><Sparkles size={15} /> {t('dash.connectAccount')}</Button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label={t('dash.thisMonth')} value={thisMonth.length} icon={<Send size={14} />} accent="#6366f1" />
        <Stat label={t('dash.scheduled')} value={scheduled.length} icon={<CalendarClock size={14} />} accent="#8b5cf6" />
        <Stat label={t('dash.drafts')} value={drafts.length} icon={<PenLine size={14} />} accent="#64748b" />
        <Stat label={t('dash.engagement')} value={fmtNumber(totalEngagement, lang)} icon={<Eye size={14} />} accent="#22c55e" />
        <Stat label={t('dash.engRate')} value={`${engRate.toFixed(2)}%`} icon={<Users size={14} />} accent="#f59e0b" />
        <Stat label={t('dash.followers')} value={fmtNumber(followers, lang)} icon={<Users size={14} />} accent="#06b6d4" />
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title={t('dash.weekly')} sub={t('an.demoNote')} />
          <div className="h-[220px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="sdBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--sd-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--sd-faint)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--sd-faint)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--sd-raise)', border: '1px solid var(--sd-line2)', borderRadius: 10, fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--sd-fg)' }}
                />
                <Bar dataKey="posts" name="posts" fill="url(#sdBar)" radius={[5, 5, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHead title={t('dash.distribution')} sub={t('dash.enabledPlatforms')} />
          <div className="h-[220px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
                  {pieData.map((d) => (
                    <Cell key={d.id} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--sd-raise)', border: '1px solid var(--sd-line2)', borderRadius: 10, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-3">
              {pieData.slice(0, 6).map((d) => (
                <span key={d.id} className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.name} {d.value}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* today + upcoming */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            title={t('dash.today')}
            right={<Button size="sm" variant="ghost" onClick={() => onNavigate('calendar')}>{t('common.more')} <ArrowRight size={13} /></Button>}
          />
          {todayPosts.length === 0 ? (
            <Empty icon={<CalendarClock size={26} />} title={t('dash.noToday')} hint={t('dash.noTodayHint')} />
          ) : (
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              {todayPosts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onEdit(p.id)}
                  className="card-raise flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:border-brand"
                >
                  <div className="flex shrink-0 -space-x-1.5">
                    {p.platforms.slice(0, 3).map((id) => (
                      <PlatformIcon key={id} id={id} size={18} className="ring-1 ring-panel" />
                    ))}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{p.content}</span>
                  <StatusBadge status={p.status} />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHead
            title={t('dash.upcoming')}
            right={<Button size="sm" variant="ghost" onClick={() => onNavigate('queue')}>{t('common.more')} <ArrowRight size={13} /></Button>}
          />
          {upcoming.length === 0 ? (
            <Empty icon={<InboxIcon size={26} />} title={t('queue.empty')} hint={t('queue.emptyHint')} />
          ) : (
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              {upcoming.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onEdit(p.id)}
                  className="card-raise flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:border-brand"
                >
                  <span className="w-[74px] shrink-0 text-[12px] tabular-nums text-faint">
                    {fmtDate(p.scheduledAt, lang).slice(5)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{p.content}</span>
                  <div className="flex shrink-0 -space-x-1.5">
                    {p.platforms.slice(0, 3).map((id) => (
                      <PlatformIcon key={id} id={id} size={16} className="ring-1 ring-panel" />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* top content */}
      <Card>
        <CardHead
          title={t('dash.topContent')}
          right={<Button size="sm" variant="ghost" onClick={() => onNavigate('analytics')}>{t('nav.analytics')} <ArrowRight size={13} /></Button>}
        />
        {topPosts.length === 0 ? (
          <Empty title={t('an.noData')} hint={t('an.noDataHint')} />
        ) : (
          <div className="px-3 pb-3">
            {topPosts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-line px-1 py-2 last:border-0">
                <span className="w-5 text-[12px] font-bold text-faint">{i + 1}</span>
                <PlatformIcon id={p.platformId} size={18} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{truncate(p.content, 60)}</span>
                <span className="hidden w-24 text-right text-[12px] text-faint sm:block">{fmtDate(p.at, lang)}</span>
                <span className="w-20 text-right text-[12px] font-semibold">{fmtNumber(p.impressions, lang)}</span>
                <span className="w-16 text-right text-[12px] text-ok">{fmtNumber(p.engagements, lang)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionLabel>{t('dash.quick')}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onNavigate('composer')}><PenLine size={13} /> {t('comp.draftNew')}</Button>
            <Button size="sm" onClick={() => onNavigate('media')}><Sparkles size={13} /> {t('media.title')}</Button>
            <Button size="sm" onClick={() => onNavigate('ideas')}><Sparkles size={13} /> {t('ideas.title')}</Button>
            <Button size="sm" onClick={() => onNavigate('inbox')}>
              <InboxIcon size={13} /> {t('inbox.title')}
              {unread ? <span className="ml-1 rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{unread}</span> : null}
            </Button>
            <Button size="sm" onClick={() => onNavigate('settings')}><Sparkles size={13} /> {t('set.platforms')}</Button>
          </div>
        </Card>
        <Card className="p-4">
          <SectionLabel>{t('dash.enabledPlatforms')}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {enabledPlatforms.map((p) => (
              <span key={p.id} className="chip" style={{ borderColor: `${p.color}55`, color: 'var(--sd-fg)' }}>
                <PlatformIcon id={p.id} size={14} />
                {lang === 'zh' ? p.nameZh : p.nameEn}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
