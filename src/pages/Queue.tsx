import { useMemo, useState } from 'react';
import {
  ListChecks, Play, RotateCw, Copy, Download, CheckCircle2, XCircle, Clock, AlertTriangle,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { PLATFORM_MAP } from '../platforms/registry';
import { getAdapter, isRealAdapter } from '../lib/adapters';
import bridge from '../lib/bridge';
import { Button, Card, Empty, Segmented, Badge } from '../components/ui';
import { PlatformIcon } from '../components/PlatformIcon';
import { StatusBadge } from '../components/PostEditor';
import { copyText, downloadFile, fmtDate, toCSV } from '../lib/utils';
import type { Post, PostStatus } from '../types';

type Filter = 'all' | PostStatus;

export function QueuePage({ onEdit }: { onEdit: (id: string) => void }) {
  const { db, setDB, i18n, pushToast, enabledPlatforms, appInfo, engine, engineConfig, reloadFromDisk } =
    useStore();
  const channelMap = appInfo?.channelMap ?? null;
  const t = i18n.t;
  const lang = i18n.lang;
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const desktop = bridge.isDesktop;
  const engineOn = desktop && !!engine?.running && !!engineConfig?.enabled;

  const list = useMemo(
    () =>
      db.posts
        .filter((p) => (filter === 'all' ? true : p.status === filter))
        .sort((a, b) => (b.scheduledAt ?? b.publishedAt ?? b.createdAt).localeCompare(a.scheduledAt ?? a.publishedAt ?? a.createdAt)),
    [db.posts, filter],
  );

  const counts = useMemo(
    () => ({
      all: db.posts.length,
      scheduled: db.posts.filter((p) => p.status === 'scheduled').length,
      published: db.posts.filter((p) => p.status === 'published').length,
      failed: db.posts.filter((p) => p.status === 'failed').length,
      draft: db.posts.filter((p) => p.status === 'draft').length,
    }),
    [db.posts],
  );

  async function publishNow(post: Post) {
    setBusy(post.id);

    /* ——— 独立版：交给主进程的 Node 适配器真正发出去（支持本地素材文件直传） ——— */
    if (bridge.isDesktop) {
      const outcome = await bridge.publishPost(post.id);
      await reloadFromDisk();
      setBusy(null);
      if (!outcome) {
        pushToast('发布调用失败', 'error');
        return;
      }
      pushToast(`${outcome.ok ? '✅' : '❌'} ${outcome.summary}`, outcome.ok ? 'ok' : 'error');
      return;
    }

    /* ——— 浏览器版：退回演示适配器 ——— */
    const results: Record<string, { status: PostStatus; error?: string }> = {};
    let anyOk = false;
    for (const pid of post.platforms) {
      const adapter = getAdapter(pid);
      const account = db.accounts.find((a) => a.platformId === pid && a.connected && a.credential);
      const res = await adapter.publish(
        {
          platformId: pid,
          accountId: account?.id,
          content: post.content,
          mediaUrls: [],
          scheduledAt: post.scheduledAt,
          firstComment: post.firstComment,
          hashtags: post.hashtags,
        },
        account?.credential ?? '',
      );
      results[pid] = { status: res.ok ? 'published' : 'failed', error: res.ok ? undefined : res.message };
      if (res.ok) anyOk = true;
    }
    setDB((d) => ({
      ...d,
      posts: d.posts.map((p) =>
        p.id === post.id
          ? {
              ...p,
              status: anyOk ? 'published' : 'failed',
              publishedAt: anyOk ? new Date().toISOString() : p.publishedAt,
              overrides: { ...(p.overrides ?? {}), ...results },
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    }));
    setBusy(null);
    const hasReal = post.platforms.some((pid) => isRealAdapter(pid));
    pushToast(anyOk ? (hasReal ? t('queue.publishedReal') : t('queue.simulated')) : t('queue.noCred'), anyOk ? 'ok' : 'warn');
  }

  async function copyOne(post: Post) {
    const ok = await copyText(post.content);
    pushToast(ok ? t('common.copied') : '—', ok ? 'ok' : 'error');
  }

  function exportCSV() {
    const rows: (string | number)[][] = [
      ['scheduled_at', 'platforms', 'content', 'hashtags', 'first_comment', 'status'],
      ...db.posts.map((p) => [
        p.scheduledAt ? fmtDate(p.scheduledAt, 'zh') : '',
        p.platforms.map((x) => PLATFORM_MAP[x]?.nameEn ?? x).join(' | '),
        p.content.replace(/\n/g, ' '),
        p.hashtags.map((h) => '#' + h).join(' '),
        p.firstComment ?? '',
        p.status,
      ]),
    ];
    downloadFile('socialdesk-publish-checklist.csv', '\ufeff' + toCSV(rows), 'text/csv');
    pushToast(t('set.exported'));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {desktop ? (
          <Badge className={engineOn ? 'bg-ok/15 text-ok' : 'bg-white/10 text-faint'}>
            {engineOn ? `⚡ ${t('eng.running')} · ${engineConfig?.intervalSec ?? 20}s` : t('eng.stopped')}
          </Badge>
        ) : null}
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `${t('queue.all')} ${counts.all}` },
            { value: 'scheduled', label: `${t('queue.scheduled')} ${counts.scheduled}` },
            { value: 'published', label: `${t('queue.published')} ${counts.published}` },
            { value: 'failed', label: `${t('queue.failed')} ${counts.failed}` },
            { value: 'draft', label: `${t('status.draft')} ${counts.draft}` },
          ]}
        />
        <Button size="sm" className="ml-auto" onClick={exportCSV}>
          <Download size={14} /> {t('queue.export')}
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty icon={<ListChecks size={30} />} title={t('queue.empty')} hint={t('queue.emptyHint')} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[132px_minmax(0,1fr)_140px_120px_180px] gap-3 border-b border-line bg-raise px-3 py-2 text-[12px] font-semibold text-faint md:grid">
            <span>{t('comp.schedule')}</span>
            <span>{t('comp.content')}</span>
            <span>{t('comp.platforms')}</span>
            <span>{t('status.draft')}</span>
            <span className="text-right">{t('common.more')}</span>
          </div>
          {list.map((p) => {
            const overdue = p.status === 'scheduled' && (p.scheduledAt ?? '') < new Date().toISOString();
            return (
              <div
                key={p.id}
                className="grid grid-cols-1 gap-2 border-b border-line px-3 py-2.5 last:border-0 hover:bg-raise/40 md:grid-cols-[132px_minmax(0,1fr)_140px_120px_180px] md:items-center md:gap-3"
              >
                <div className="flex items-center gap-1.5 text-[12px] tabular-nums text-muted">
                  {overdue ? <AlertTriangle size={12} className="text-[#f59e0b]" /> : <Clock size={12} className="text-faint" />}
                  {fmtDate(p.scheduledAt ?? p.publishedAt, lang)}
                </div>
                <button onClick={() => onEdit(p.id)} className="min-w-0 text-left">
                  <span className="block truncate text-[13px]">{p.content}</span>
                </button>
                <div className="flex flex-wrap items-center gap-1">
                  {p.platforms.map((id) => {
                    const st = p.overrides?.[id]?.status;
                    const err = p.overrides?.[id]?.error;
                    return (
                      <span
                        key={id}
                        className="relative inline-flex"
                        title={[err, channelMap?.[id] ? `via ${channelMap[id]}` : ''].filter(Boolean).join(' · ') || undefined}
                      >
                        <PlatformIcon id={id} size={20} />
                        {st === 'published' ? (
                          <CheckCircle2 size={10} className="absolute -bottom-0.5 -right-0.5 text-ok" />
                        ) : st === 'failed' ? (
                          <XCircle size={10} className="absolute -bottom-0.5 -right-0.5 text-danger" />
                        ) : null}
                      </span>
                    );
                  })}
                </div>
                <div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center gap-1 md:justify-end">
                  {p.status !== 'published' ? (
                    <Button size="sm" onClick={() => publishNow(p)} disabled={busy === p.id}>
                      {busy === p.id ? <RotateCw size={12} className="animate-spin" /> : <Play size={12} />} {t('queue.publishNow')}
                    </Button>
                  ) : null}
                  {p.status === 'failed' ? (
                    <Button size="sm" variant="ghost" onClick={() => publishNow(p)}>
                      <RotateCw size={12} />
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => copyOne(p)} title={t('queue.copyOne')}>
                    <Copy size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-start gap-2 text-[12px] text-muted">
          <Badge className="bg-brand/15 text-brand">i</Badge>
          <div>
            <p className="font-medium text-fg">{t('queue.exportHint')}</p>
            <p className="mt-1 text-faint">
              {bridge.isDesktop
                ? `${t('eng.autoPublishHint')}${engineConfig?.enabled ? ` ${t('eng.running')} · ${engineConfig.intervalSec}s` : ''}`
                : `${t('queue.simulated')} · ${t('acc.perPlatformHint')}`}
            </p>
          </div>
        </div>
      </Card>

      {enabledPlatforms.length === 0 ? (
        <Card className="p-4 text-[13px] text-warn">{t('set.platformsHint')}</Card>
      ) : null}
    </div>
  );
}
