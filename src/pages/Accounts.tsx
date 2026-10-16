import { useMemo, useState } from 'react';
import {
  Users, Link2, Unlink, Plus, KeyRound, Info, ShieldCheck, Globe, Keyboard,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { PLATFORMS, PLATFORM_MAP, CONNECT_LABEL } from '../platforms/registry';
import { getAdapter, isRealAdapter, testConnectionReal } from '../lib/adapters';
import bridge from '../lib/bridge';
import { Button, Card, CardHead, Empty, Modal, Badge, SectionLabel } from '../components/ui';
import { PlatformIcon } from '../components/PlatformIcon';
import { fmtNumber, uid } from '../lib/utils';
import type { Account, ConnectMode } from '../types';

function credFormat(platformId: string): string {
  if (platformId === 'telegram') return '<botToken>|<chatId>  例：123456:AAHxxxxx|-1001234567890';
  if (platformId === 'bluesky') return '<handle>|<appPassword>  例：me.bsky.social|xxxx-xxxx';
  if (platformId === 'discord') return 'https://discord.com/api/webhooks/…（服务器 → 整合 → Webhook）';
  if (platformId === 'mastodon') return '<实例域>|<accessToken>  例：mastodon.social|xxxxxx';
  if (['xiaohongshu', 'douyin', 'wechat_channels', 'bilibili', 'kuaishou', 'zhihu', 'weibo', 'tiktok'].includes(platformId))
    return 'http://127.0.0.1:5409（先运行 bridge/social_bridge.py）';
  if (['x', 'linkedin', 'instagram', 'facebook', 'youtube', 'threads', 'pinterest', 'reddit', 'whatsapp', 'kuaishou_gb', 'google_business'].includes(platformId))
    return 'https://你的中转服务/publish 或 <URL>|<BearerToken>';
  return '粘贴 API Token / App 凭证';
}

export function AccountsPage() {
  const { db, setDB, i18n, pushToast, enabledPlatforms, appInfo } = useStore();
  const channelMap = appInfo?.channelMap ?? null;
  const t = i18n.t;
  const lang = i18n.lang;
  const [addOpen, setAddOpen] = useState(false);
  const [credFor, setCredFor] = useState<Account | null>(null);
  const [credential, setCredential] = useState('');
  const [testing, setTesting] = useState(false);
  const [newPlatform, setNewPlatform] = useState(enabledPlatforms[0]?.id ?? 'instagram');
  const [newHandle, setNewHandle] = useState('');
  const [newName, setNewName] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<string, Account[]>();
    db.accounts.forEach((a) => {
      const arr = map.get(a.platformId) ?? [];
      arr.push(a);
      map.set(a.platformId, arr);
    });
    return Array.from(map.entries());
  }, [db.accounts]);

  function toggleConnect(acc: Account) {
    setDB((d) => ({
      ...d,
      accounts: d.accounts.map((a) => (a.id === acc.id ? { ...a, connected: !a.connected } : a)),
    }));
    pushToast(acc.connected ? t('acc.disconnectedToast') : t('acc.connectedToast'));
  }

  async function testConnection() {
    if (!credFor) return;
    setTesting(true);
    // 独立版：真发一次 API 请求验证（浏览器版做不到，会被跨域拦掉）
    const real = await testConnectionReal(credFor.platformId, credential);
    const res = real ?? (await getAdapter(credFor.platformId).testConnection(credential));
    setTesting(false);
    pushToast(res.message, res.ok ? 'ok' : 'warn');
    if (res.ok) {
      setDB((d) => ({
        ...d,
        accounts: d.accounts.map((a) => (a.id === credFor.id ? { ...a, connected: true, credential } : a)),
      }));
      setCredFor(null);
      setCredential('');
    }
  }

  function addAccount() {
    if (!newHandle.trim()) return;
    const acc: Account = {
      id: uid('acc'),
      platformId: newPlatform,
      handle: newHandle.startsWith('@') ? newHandle : '@' + newHandle,
      displayName: newName.trim() || PLATFORM_MAP[newPlatform]?.nameZh || 'Account',
      connected: false,
      mode: PLATFORM_MAP[newPlatform]?.connect ?? 'manual',
      followers: 0,
    };
    setDB((d) => ({ ...d, accounts: [...d.accounts, acc] }));
    setAddOpen(false);
    setNewHandle('');
    setNewName('');
    pushToast(t('acc.addedToast'));
  }

  const modeIcon = (m: ConnectMode) =>
    m === 'api' ? <ShieldCheck size={12} /> : m === 'cookie' ? <KeyRound size={12} /> : <Keyboard size={12} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[13px] text-muted">
          {db.accounts.filter((a) => a.connected).length} / {db.accounts.length} {t('acc.connected')}
        </div>
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> {t('acc.add')}
        </Button>
      </div>

      {db.accounts.length === 0 ? (
        <Card>
          <Empty icon={<Users size={30} />} title={t('acc.empty')} hint={t('acc.emptyHint')} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map(([pid, accs]) => {
            const p = PLATFORM_MAP[pid];
            return (
              <Card key={pid} className="p-3">
                <div className="mb-2 flex items-center gap-2">
                  <PlatformIcon id={pid} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{lang === 'zh' ? p?.nameZh : p?.nameEn}</div>
                    <div className="text-[11px] text-faint">
                      {CONNECT_LABEL[p?.connect ?? 'manual'][lang === 'zh' ? 'zh' : 'en']}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {accs.map((a) => (
                    <div key={a.id} className="card-raise flex items-center gap-2 px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium">{a.displayName}</span>
                          {a.connected ? (
                            <Badge className="bg-[color-mix(in_srgb,#22c55e_16%,transparent)] text-ok">{t('acc.connected')}</Badge>
                          ) : (
                            <Badge className="bg-line text-muted">{t('acc.notConnected')}</Badge>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-faint">
                          {a.handle} · {fmtNumber(a.followers, lang)} {t('acc.followers')}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setCredFor(a);
                          setCredential('');
                        }}
                        title={t('acc.connect')}
                      >
                        <Link2 size={13} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleConnect(a)} title={a.connected ? t('acc.disconnect') : t('acc.connect')}>
                        {a.connected ? <Unlink size={13} /> : <Link2 size={13} />}
                      </Button>
                    </div>
                  ))}
                </div>
                {p ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-faint">
                    {lang === 'zh' ? p.noteZh : p.noteEn}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHead title={t('acc.perPlatform')} sub={t('acc.perPlatformHint')} />
        <div className="px-4 pb-4">
          <div className="overflow-hidden rounded-[var(--sd-r-sm)] border border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_minmax(0,2fr)] gap-3 bg-raise px-3 py-2 text-[12px] font-semibold text-faint">
              <span>{t('comp.platforms')}</span>
              <span>{t('acc.mode')}</span>
              <span>{t('acc.needToken')}</span>
            </div>
            <div className="max-h-[340px] overflow-y-auto scroll-thin">
              {PLATFORMS.map((p) => (
                <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_120px_minmax(0,2fr)] items-center gap-3 border-t border-line px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <PlatformIcon id={p.id} size={18} />
                    <span className="truncate text-[13px]">{lang === 'zh' ? p.nameZh : p.nameEn}</span>
                  </span>
                  <span className="flex items-center gap-1 text-[12px] text-muted">
                    {modeIcon(p.connect)} {CONNECT_LABEL[p.connect][lang === 'zh' ? 'zh' : 'en']}
                    {(bridge.isDesktop
                      ? !!channelMap && channelMap[p.id] !== 'manual' && channelMap[p.id] !== undefined
                      : isRealAdapter(p.id)) ? (
                      <span className="rounded bg-[color-mix(in_srgb,#22c55e_16%,transparent)] px-1 text-[11px] font-bold text-ok">LIVE</span>
                    ) : null}
                  </span>
                  <span className="truncate text-[12px] text-faint">
                    {lang === 'zh' ? p.noteZh : p.noteEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 连接凭证 */}
      <Modal
        open={!!credFor}
        onClose={() => setCredFor(null)}
        title={credFor ? `${lang === 'zh' ? PLATFORM_MAP[credFor.platformId]?.nameZh : PLATFORM_MAP[credFor.platformId]?.nameEn} · ${t('acc.connect')}` : ''}
        width={520}
      >
        {credFor ? (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-[var(--sd-r-sm)] border border-line bg-raise px-3 py-2 text-[12px] text-muted">
              <Info size={14} className="mt-0.5 shrink-0 text-brand" />
              <span>
                {lang === 'zh' ? PLATFORM_MAP[credFor.platformId]?.noteZh : PLATFORM_MAP[credFor.platformId]?.noteEn}
              </span>
            </div>
            <SectionLabel>{t('acc.needToken')}</SectionLabel>
            <input
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder={credFormat(credFor.platformId)}
              className="input"
            />
            <p className="mt-1.5 text-[11px] text-faint">{t('set.storageHint')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCredFor(null)}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={testConnection} disabled={testing}>
                {testing ? <Globe size={14} className="animate-spin" /> : <Link2 size={14} />} {t('acc.connect')}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      {/* 新增账号 */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('acc.add')} width={480}>
        <SectionLabel>{t('comp.platforms')}</SectionLabel>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {enabledPlatforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setNewPlatform(p.id)}
              className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[12px]"
              style={{
                borderColor: newPlatform === p.id ? p.color : 'var(--sd-line2)',
                background: newPlatform === p.id ? `color-mix(in srgb, ${p.color} 14%, transparent)` : 'transparent',
                color: newPlatform === p.id ? 'var(--sd-fg)' : 'var(--sd-muted)',
              }}
            >
              <PlatformIcon id={p.id} size={15} />
              {lang === 'zh' ? p.nameZh : p.nameEn}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <SectionLabel>{t('acc.handle')}</SectionLabel>
            <input value={newHandle} onChange={(e) => setNewHandle(e.target.value)} placeholder={t('acc.handlePlaceholder')} className="input" />
          </div>
          <div>
            <SectionLabel>{t('acc.displayName')}</SectionLabel>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('acc.displayNamePlaceholder')} className="input" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={addAccount}><Plus size={14} /> {t('common.add')}</Button>
        </div>
      </Modal>
    </div>
  );
}
