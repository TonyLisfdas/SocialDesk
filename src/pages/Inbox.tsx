import { useMemo, useState } from 'react';
import { Inbox, Star, MessageSquare, AtSign, Send, Check, Reply } from 'lucide-react';
import { useStore } from '../lib/store';
import { Button, Card, Empty, Segmented, Badge } from '../components/ui';
import { PlatformIcon } from '../components/PlatformIcon';
import { relativeTime, truncate } from '../lib/utils';
import type { InboxItem } from '../types';

type Filter = 'all' | 'unread' | 'starred';

export function InboxPage() {
  const { db, setDB, i18n, pushToast, enabledPlatforms } = useStore();
  const t = i18n.t;
  const lang = i18n.lang;
  const [filter, setFilter] = useState<Filter>('all');
  const [platform, setPlatform] = useState<string>('all');
  const [reply, setReply] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(
    () =>
      db.inbox
        .filter((i) => {
          if (filter === 'unread' && i.read) return false;
          if (filter === 'starred' && !i.starred) return false;
          if (platform !== 'all' && i.platformId !== platform) return false;
          return true;
        })
        .sort((a, b) => b.at.localeCompare(a.at)),
    [db.inbox, filter, platform],
  );

  function patch(id: string, p: Partial<InboxItem>) {
    setDB((d) => ({ ...d, inbox: d.inbox.map((i) => (i.id === id ? { ...i, ...p } : i)) }));
  }

  function sendReply(item: InboxItem) {
    const text = (reply[item.id] ?? '').trim();
    if (!text) return;
    patch(item.id, { replied: true, read: true });
    setReply((r) => ({ ...r, [item.id]: '' }));
    setOpen(null);
    pushToast(t('inbox.replied'));
  }

  const platformOptions = useMemo(() => {
    const set = new Set(db.inbox.map((i) => i.platformId));
    return Array.from(set).filter((id) => enabledPlatforms.some((p) => p.id === id));
  }, [db.inbox, enabledPlatforms]);

  const typeIcon = (type: InboxItem['type']) =>
    type === 'comment' ? <MessageSquare size={12} /> : type === 'mention' ? <AtSign size={12} /> : <Send size={12} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'unread', label: `${t('inbox.unread')} ${db.inbox.filter((i) => !i.read).length}` },
            { value: 'starred', label: `${t('inbox.starred')} ${db.inbox.filter((i) => i.starred).length}` },
          ]}
        />
        {platformOptions.length ? (
          <div className="flex items-center gap-1.5">
            {platformOptions.map((id) => (
              <button
                key={id}
                onClick={() => setPlatform(platform === id ? 'all' : id)}
                className="rounded-full p-0.5 transition-transform"
                style={{ outline: platform === id ? `2px solid ${'var(--sd-brand)'}` : 'none', outlineOffset: 1 }}
              >
                <PlatformIcon id={id} size={20} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty icon={<Inbox size={30} />} title={t('inbox.empty')} hint={t('inbox.emptyHint')} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {list.map((item) => (
            <div key={item.id} className={`border-b border-line px-3 py-2.5 last:border-0 ${item.read ? '' : 'bg-brand/[0.04]'}`}>
              <div className="flex items-start gap-2.5">
                <PlatformIcon id={item.platformId} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] font-semibold">{item.author}</span>
                    <span className="text-[11px] text-faint">@{item.account}</span>
                    <Badge className="bg-line text-muted">
                      {typeIcon(item.type)} {t(`inbox.${item.type}` as never)}
                    </Badge>
                    {item.replied ? <Badge className="bg-[color-mix(in_srgb,#22c55e_16%,transparent)] text-ok">{t('inbox.replied')}</Badge> : null}
                    <span className="ml-auto text-[11px] text-faint">{relativeTime(item.at, lang)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">{item.body}</p>
                  {open === item.id ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        autoFocus
                        value={reply[item.id] ?? ''}
                        onChange={(e) => setReply((r) => ({ ...r, [item.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') sendReply(item);
                        }}
                        placeholder={t('inbox.placeholder')}
                        className="input"
                      />
                      <Button size="sm" variant="primary" onClick={() => sendReply(item)}>
                        <Reply size={13} /> {t('inbox.reply')}
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => patch(item.id, { starred: !item.starred })}
                    className={`rounded p-1.5 transition-colors ${item.starred ? 'text-[#f59e0b]' : 'text-faint hover:text-fg'}`}
                  >
                    <Star size={14} fill={item.starred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => patch(item.id, { read: !item.read })}
                    className="rounded p-1.5 text-faint transition-colors hover:text-fg"
                    title={item.read ? t('inbox.markUnread') : t('inbox.markRead')}
                  >
                    <Check size={14} />
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(open === item.id ? null : item.id)}>
                    <Reply size={13} /> {t('inbox.reply')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <p className="text-[11.5px] text-faint">{truncate(t('inbox.emptyHint'), 60)}</p>
    </div>
  );
}
