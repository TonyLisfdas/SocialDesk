import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Eye, Heart, MousePointerClick, UserPlus, TrendingUp } from 'lucide-react';
import { useStore } from '../lib/store';
import { buildHeatmap, buildPlatformMetrics, buildSeries, buildTopPosts } from '../lib/metrics';
import { Card, CardHead, Stat, Segmented, Empty, SectionLabel } from '../components/ui';
import { PlatformIcon } from '../components/PlatformIcon';
import { fmtDate, fmtNumber, weekdayLabel } from '../lib/utils';

export function AnalyticsPage() {
  const { db, i18n } = useStore();
  const t = i18n.t;
  const lang = i18n.lang;
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const days = Number(range);

  const published = useMemo(() => db.posts.filter((p) => p.status === 'published'), [db.posts]);
  const series = useMemo(() => buildSeries(published, days), [published, days]);
  const platformMetrics = useMemo(() => buildPlatformMetrics(published, days), [published, days]);
  const topPosts = useMemo(() => buildTopPosts(published, days, 8), [published, days]);
  const heatmap = useMemo(() => buildHeatmap(published), [published]);

  const totals = useMemo(() => {
    const prev = buildSeries(published, days * 2).slice(0, days);
    const cur = series;
    const sum = (arr: { impressions: number; engagements: number; clicks: number; followers: number }[], k: keyof { impressions: number; engagements: number; clicks: number; followers: number }) =>
      arr.reduce((a, b) => a + b[k], 0);
    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 0);
    const impressions = sum(cur, 'impressions');
    const engagements = sum(cur, 'engagements');
    const clicks = sum(cur, 'clicks');
    const followers = sum(cur, 'followers');
    return {
      impressions,
      engagements,
      clicks,
      followers,
      engRate: impressions ? (engagements / impressions) * 100 : 0,
      dImpressions: pct(impressions, sum(prev, 'impressions')),
      dEngagements: pct(engagements, sum(prev, 'engagements')),
      dClicks: pct(clicks, sum(prev, 'clicks')),
      dFollowers: pct(followers, sum(prev, 'followers')),
    };
  }, [series, published, days]);

  const maxHeat = Math.max(...heatmap.flat());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: t('an.7') },
            { value: '30', label: t('an.30') },
            { value: '90', label: t('an.90') },
          ]}
        />
        <span className="ml-auto text-[12px] text-faint">{t('an.demoNote')}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t('an.impressions')} value={fmtNumber(totals.impressions, lang)} delta={totals.dImpressions} icon={<Eye size={14} />} accent="#6366f1" />
        <Stat label={t('an.engagements')} value={fmtNumber(totals.engagements, lang)} delta={totals.dEngagements} icon={<Heart size={14} />} accent="#22c55e" />
        <Stat label={t('an.engRate')} value={`${totals.engRate.toFixed(2)}%`} icon={<TrendingUp size={14} />} accent="#8b5cf6" />
        <Stat label={t('an.clicks')} value={fmtNumber(totals.clicks, lang)} delta={totals.dClicks} icon={<MousePointerClick size={14} />} accent="#f59e0b" />
        <Stat label={t('an.followers')} value={fmtNumber(totals.followers, lang)} delta={totals.dFollowers} icon={<UserPlus size={14} />} accent="#06b6d4" />
      </div>

      <Card>
        <CardHead title={t('an.trend')} sub={`${t('an.range')}: ${t(`an.${range}` as never)}`} />
        <div className="h-[260px] px-2 pb-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 14, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="sdImp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="sdEng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sd-line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--sd-faint)' }} axisLine={false} tickLine={false} minTickGap={18} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--sd-faint)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--sd-raise)', border: '1px solid var(--sd-line2)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: 'var(--sd-fg)' }}
              />
              <Area type="monotone" dataKey="impressions" name="impressions" stroke="#6366f1" fill="url(#sdImp)" strokeWidth={2} />
              <Area type="monotone" dataKey="engagements" name="engagements" stroke="#22c55e" fill="url(#sdEng)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title={t('an.byPlatform')} sub={t('an.byPlatformSub')} />
          {platformMetrics.length === 0 ? (
            <Empty title={t('an.noData')} hint={t('an.noDataHint')} />
          ) : (
            <div className="h-[240px] px-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformMetrics.slice(0, 8)} layout="vertical" margin={{ top: 6, right: 18, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sd-line)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--sd-faint)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="id"
                    tick={{ fontSize: 11, fill: 'var(--sd-faint)' }}
                    axisLine={false}
                    tickLine={false}
                    width={76}
                    tickFormatter={(v: string) => v}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--sd-raise)', border: '1px solid var(--sd-line2)', borderRadius: 10, fontSize: 12 }}
                    formatter={(v, n) => [`${fmtNumber(Number(v ?? 0), lang)}`, String(n ?? '')]}
                    labelFormatter={(l) => l}
                  />
                  <Bar dataKey="engagements" name="engagements" radius={[0, 5, 5, 0]} maxBarSize={16}>
                    {platformMetrics.slice(0, 8).map((m) => (
                      <Cell key={m.id} fill={platformColor(m.id)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionLabel>{t('an.heat')}</SectionLabel>
          <p className="mb-3 text-[12px] text-faint">{t('an.heatHint')}</p>
          <div className="overflow-x-auto scroll-thin">
            <div className="min-w-[420px]">
              <div className="mb-1 flex pl-9">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="flex-1 text-center text-[11px] text-faint">{h % 3 === 0 ? h : ''}</span>
                ))}
              </div>
              {heatmap.map((row, w) => (
                <div key={w} className="mb-[2px] flex items-center gap-1">
                  <span className="w-8 shrink-0 text-[11px] text-faint">{weekdayLabel(new Date(2024, 0, 7 + w), lang)}</span>
                  {row.map((v, h) => (
                    <div
                      key={h}
                      title={`${weekdayLabel(new Date(2024, 0, 7 + w), lang)} ${h}:00 · ${(v * 100).toFixed(0)}%`}
                      className="h-[14px] flex-1 rounded-[2px]"
                      style={{
                        background: `color-mix(in srgb, #6366f1 ${Math.round(8 + (v / (maxHeat || 1)) * 92)}%, transparent)`,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title={t('an.topPosts')} />
        {topPosts.length === 0 ? (
          <Empty title={t('an.noData')} hint={t('an.noDataHint')} />
        ) : (
          <div className="px-3 pb-3">
            <div className="hidden grid-cols-[24px_24px_minmax(0,1fr)_110px_90px_80px] gap-2 border-b border-line px-1 py-1.5 text-[11px] font-semibold text-faint sm:grid">
              <span />
              <span />
              <span>{t('comp.content')}</span>
              <span className="text-right">{t('an.impressions')}</span>
              <span className="text-right">{t('an.engagements')}</span>
              <span className="text-right">{t('an.engRate')}</span>
            </div>
            {topPosts.map((p, i) => (
              <div key={p.id} className="grid grid-cols-[24px_24px_minmax(0,1fr)] items-center gap-2 border-b border-line px-1 py-2 last:border-0 sm:grid-cols-[24px_24px_minmax(0,1fr)_110px_90px_80px]">
                <span className="text-[12px] font-bold text-faint">{i + 1}</span>
                <PlatformIcon id={p.platformId} size={18} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">{p.content}</span>
                  <span className="block text-[11px] text-faint sm:hidden">{fmtDate(p.at, lang)}</span>
                </span>
                <span className="hidden text-right text-[12px] sm:block">{fmtNumber(p.impressions, lang)}</span>
                <span className="hidden text-right text-[12px] text-ok sm:block">{fmtNumber(p.engagements, lang)}</span>
                <span className="hidden text-right text-[12px] text-faint sm:block">{p.engRate.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function platformColor(id: string): string {
  const map: Record<string, string> = {
    xiaohongshu: '#FF2442', douyin: '#FE2C55', wechat_channels: '#07C160', wechat_mp: '#2BA245',
    bilibili: '#00A1D6', weibo: '#E6162D', zhihu: '#0084FF', kuaishou: '#FF6600',
    instagram: '#E4405F', facebook: '#1877F2', x: '#71767B', linkedin: '#0A66C2', tiktok: '#FE2C55',
    youtube: '#FF0000', threads: '#8A8A8A', pinterest: '#E60023', google_business: '#4285F4',
    kuaishou_gb: '#25F4EE', reddit: '#FF4500', telegram: '#2AABEE', discord: '#5865F2',
    whatsapp: '#25D366', bluesky: '#0085FF', mastodon: '#6364FF',
  };
  return map[id] ?? '#64748b';
}
