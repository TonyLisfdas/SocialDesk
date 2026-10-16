import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, Check, Clock, Copy, Image as ImageIcon, Plus, Send, Sparkles,
  Trash2, X, Eye, Hash, MessageSquare, StickyNote, Wand2, LayoutGrid,
} from 'lucide-react';
import type { Post, PostStatus } from '../types';
import { PLATFORM_MAP, PLATFORMS } from '../platforms/registry';
import { useStore } from '../lib/store';
import {
  applyVars, cn, copyText, fmtDate, fromLocalInput, toLocalInput, truncate, uid,
  unresolvedVars, extractHashtags,
} from '../lib/utils';
import { Button, Badge, Modal, SectionLabel } from './ui';
import { PlatformIcon } from './PlatformIcon';
import { PLATFORM_MAP as PMAP } from '../platforms/registry';

export function PostEditor({
  post,
  onSaved,
  onClose,
  embedded,
  seed,
}: {
  post: Post | null;
  onSaved?: (p: Post) => void;
  onClose?: () => void;
  embedded?: boolean;
  seed?: { mediaIds?: string[]; scheduledAt?: string; platforms?: string[] };
}) {
  const { db, setDB, i18n, pushToast, enabledPlatforms } = useStore();
  const t = i18n.t;
  const lang = i18n.lang;

  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [firstComment, setFirstComment] = useState('');
  const [schedule, setSchedule] = useState('');
  const [note, setNote] = useState('');
  const [showMedia, setShowMedia] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);
  const [showVars, setShowVars] = useState(false);

  useEffect(() => {
    if (post) {
      setContent(post.content);
      setPlatforms(post.platforms);
      setHashtags(post.hashtags);
      setMediaIds(post.mediaIds);
      setFirstComment(post.firstComment ?? '');
      setSchedule(toLocalInput(post.scheduledAt));
      setNote(post.note ?? '');
    } else {
      setContent('');
      setPlatforms(seed?.platforms ?? enabledPlatforms.slice(0, 1).map((p) => p.id));
      setHashtags([]);
      setMediaIds(seed?.mediaIds ?? []);
      setFirstComment('');
      setSchedule(seed?.scheduledAt ?? '');
      setNote('');
    }
  }, [post?.id, enabledPlatforms, seed?.scheduledAt, seed?.mediaIds?.join(','), seed?.platforms?.join(',')]);

  const resolved = useMemo(() => applyVars(content, db.settings.brandVars), [content, db.settings.brandVars]);
  const broken = useMemo(() => unresolvedVars(content, db.settings.brandVars), [content, db.settings.brandVars]);
  const autoTags = useMemo(() => extractHashtags(resolved), [resolved]);
  const allTags = useMemo(
    () => Array.from(new Set([...hashtags, ...autoTags])),
    [hashtags, autoTags],
  );

  const visible = platforms.filter((id) => enabledPlatforms.some((p) => p.id === id));
  const effectiveContent = resolved + (allTags.length ? '\n\n' + allTags.map((h) => (h.startsWith('#') ? h : '#' + h)).join(' ') : '');

  function togglePlatform(id: string) {
    setPlatforms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function addTag(raw: string) {
    const v = raw.replace(/^#/, '').trim();
    if (!v || hashtags.includes(v)) return;
    setHashtags((h) => [...h, v]);
    setTagInput('');
  }

  function buildPost(nextStatus: PostStatus): Post {
    const now = new Date().toISOString();
    const base: Post = {
      id: post?.id ?? uid('post'),
      content: resolved,
      platforms: visible,
      status: nextStatus,
      scheduledAt: fromLocalInput(schedule),
      publishedAt: nextStatus === 'published' ? new Date().toISOString() : post?.publishedAt,
      mediaIds,
      hashtags,
      firstComment: firstComment || undefined,
      note,
      createdAt: post?.createdAt ?? now,
      updatedAt: now,
      overrides: post?.overrides,
    };
    return base;
  }

  function persist(nextStatus: PostStatus, silent = false) {
    if (!visible.length) {
      pushToast(t('comp.noPlatform'), 'warn');
      return;
    }
    const p = buildPost(nextStatus);
    setDB((d) => {
      const idx = d.posts.findIndex((x) => x.id === p.id);
      const posts = idx >= 0 ? d.posts.map((x) => (x.id === p.id ? p : x)) : [p, ...d.posts];
      return { ...d, posts };
    });
    if (!silent) {
      pushToast(
        nextStatus === 'draft' ? t('comp.saved') : nextStatus === 'scheduled' ? t('comp.scheduledToast') : t('comp.publishedToast'),
      );
    }
    onSaved?.(p);
  }

  function remove() {
    if (!post) return;
    setDB((d) => ({ ...d, posts: d.posts.filter((x) => x.id !== post.id) }));
    pushToast(t('comp.deletedToast'));
    onSaved?.(buildPost(post.status));
  }

  async function copyAll() {
    const text = platforms
      .map((id) => {
        const p = PLATFORM_MAP[id];
        return `===== ${lang === 'zh' ? p.nameZh : p.nameEn} =====\n${effectiveContent}\n${firstComment ? `\n[First comment] ${firstComment}` : ''}`;
      })
      .join('\n\n');
    const ok = await copyText(text);
    pushToast(ok ? t('comp.copied') : 'Copy failed', ok ? 'ok' : 'error');
  }

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    visible.forEach((id) => PLATFORM_MAP[id]?.bestTimes.forEach((b) => set.add(b)));
    return Array.from(set).slice(0, 6);
  }, [visible]);

  function applySuggestion(time: string) {
    const d = schedule ? new Date(schedule) : new Date();
    d.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
    if (!schedule || d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    setSchedule(toLocalInput(d.toISOString()));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('grid grid-cols-1 gap-4', !embedded && 'xl:grid-cols-[minmax(0,1fr)_400px]')}>
        {/* ---------------- 左：编辑 ---------------- */}
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <SectionLabel
              right={
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setShowVars((v) => !v)}>
                    <Wand2 size={13} /> {t('set.brand')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={copyAll}>
                    <Copy size={13} /> {t('comp.copyAll')}
                  </Button>
                </div>
              }
            >
              {t('comp.content')}
            </SectionLabel>

            {showVars ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {Object.keys(db.settings.brandVars).length === 0 ? (
                  <span className="text-[12px] text-faint">{t('comp.variableTip')}</span>
                ) : (
                  Object.entries(db.settings.brandVars).map(([k, v]) => (
                    <button
                      key={k}
                      className="chip hover:border-brand hover:text-fg"
                      onClick={() => setContent((c) => `${c}{{${k}}}`)}
                      title={v}
                    >
                      {`{{${k}}}`}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('comp.placeholder')}
              rows={7}
              className="input"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
              <span className="text-faint">
                {effectiveContent.length} {t('comp.charCount')}
              </span>
              {broken.length ? (
                <span className="text-[#f59e0b]">
                  {t('comp.brokenVar')}: {broken.map((b) => `{{${b}}}`).join(', ')}
                </span>
              ) : null}
              {visible.map((id) => {
                const p = PLATFORM_MAP[id];
                const over = effectiveContent.length > p.maxLength;
                return (
                  <span
                    key={id}
                    className={over ? 'font-semibold text-[#ef4444]' : 'text-faint'}
                    title={`${p.nameZh} ≤ ${p.maxLength}`}
                  >
                    {p.nameZh} {effectiveContent.length}/{p.maxLength}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 平台选择 */}
          <div className="card p-4">
            <SectionLabel right={<span className="text-[11.5px] text-faint">{visible.length} {t('common.platforms')}</span>}>
              {t('comp.platforms')}
            </SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {enabledPlatforms.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className="flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[12px] font-medium transition-all"
                    style={{
                      borderColor: on ? p.color : 'var(--sd-line2)',
                      background: on ? `color-mix(in srgb, ${p.color} 16%, transparent)` : 'transparent',
                      color: on ? 'var(--sd-fg)' : 'var(--sd-muted)',
                    }}
                  >
                    <PlatformIcon id={p.id} size={18} />
                    {lang === 'zh' ? p.nameZh : p.nameEn}
                    {on ? <Check size={12} style={{ color: p.color }} /> : null}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11.5px] text-faint">
              {t('set.platformsHint')}
            </p>
          </div>

          {/* 素材 */}
          <div className="card p-4">
            <SectionLabel
              right={
                <Button size="sm" variant="ghost" onClick={() => setShowMedia(true)}>
                  <Plus size={13} /> {t('comp.pickMedia')}
                </Button>
              }
            >
              {t('comp.media')}
            </SectionLabel>
            {mediaIds.length === 0 ? (
              <button
                onClick={() => setShowMedia(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line2 py-6 text-[12.5px] text-faint transition-colors hover:border-brand hover:text-muted"
              >
                <ImageIcon size={16} /> {t('comp.noMedia')}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {mediaIds.map((id) => {
                  const m = db.media.find((x) => x.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-line">
                      {m.dataUrl ? (
                        <img src={m.dataUrl} alt={m.name} className="h-full w-full object-cover" />
                      ) : m.url ? (
                        <img src={m.url} alt={m.name} className="h-full w-full object-cover" onError={() => undefined} />
                      ) : (
                        <div className="h-full w-full" style={{ background: m.gradient }} />
                      )}
                      <button
                        onClick={() => setMediaIds((ids) => ids.filter((x) => x !== id))}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 标签 / 首评 / 排期 */}
          <div className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            <div>
              <SectionLabel>{t('comp.hashtags')}</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((h) => (
                  <span key={h} className="chip" style={{ color: 'var(--sd-brand)' }}>
                    #{h}
                    {!hashtags.includes(h) ? <span className="text-faint">·auto</span> : null}
                  </span>
                ))}
              </div>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder={t('comp.tagPlaceholder')}
                className="input mt-2"
              />
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <SectionLabel>{t('comp.firstComment')}</SectionLabel>
                <input
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  placeholder={t('comp.firstCommentHint')}
                  className="input"
                />
              </div>
              <div>
                <SectionLabel>{t('comp.schedule')}</SectionLabel>
                <input
                  type="datetime-local"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="input"
                />
                {suggestions.length ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 text-[11.5px] text-faint">
                      <Sparkles size={12} /> {t('comp.suggestTime')}:
                    </span>
                    {suggestions.map((s) => (
                      <button key={s} className="chip hover:border-brand hover:text-fg" onClick={() => applySuggestion(s)}>
                        <Clock size={11} /> {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <SectionLabel>{t('comp.note')}</SectionLabel>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="仅自己可见" />
          </div>
        </div>

        {/* ---------------- 右：预览 ---------------- */}
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <SectionLabel right={<span className="flex items-center gap-1 text-[11.5px] text-faint"><Eye size={12} />{t('comp.preview')}</span>}>
              {t('comp.preview')}
            </SectionLabel>
            {visible.length === 0 ? (
              <div className="py-8 text-center text-[12.5px] text-faint">{t('comp.noPlatform')}</div>
            ) : (
              <div className="flex flex-col gap-3">
                {visible.map((id) => (
                  <PreviewCard key={id} platformId={id} content={effectiveContent} firstComment={firstComment} media={db.media.filter((m) => mediaIds.includes(m.id))} lang={lang} />
                ))}
              </div>
            )}
          </div>

          {db.ideas.filter((i) => !i.converted).length ? (
            <div className="card p-4">
              <SectionLabel right={<Button size="sm" variant="ghost" onClick={() => setShowIdeas((v) => !v)}><LayoutGrid size={13} /></Button>}>
                {t('comp.insertIdea')}
              </SectionLabel>
              {showIdeas ? (
                <div className="flex flex-col gap-1.5">
                  {db.ideas.filter((i) => !i.converted).map((idea) => (
                    <button
                      key={idea.id}
                      className="card-raise px-3 py-2 text-left text-[12.5px] hover:border-brand"
                      onClick={() => {
                        setContent((c) => (c ? `${c}\n${idea.text}` : idea.text));
                        setShowIdeas(false);
                      }}
                    >
                      {truncate(idea.text, 60)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-faint">{t('comp.aiTip')}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* 操作栏 */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/95 p-3 backdrop-blur">
        <Button variant="primary" onClick={() => persist('scheduled')}>
          <CalendarClock size={15} /> {t('comp.scheduleBtn')}
        </Button>
        <Button onClick={() => persist('draft')}>
          <StickyNote size={15} /> {t('comp.saveDraft')}
        </Button>
        <Button onClick={() => persist('published')}>
          <Send size={15} /> {t('comp.publishBtn')}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {post ? (
            <Button variant="danger" size="sm" onClick={remove}>
              <Trash2 size={14} /> {t('comp.delete')}
            </Button>
          ) : null}
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* 素材选择 */}
      <Modal open={showMedia} onClose={() => setShowMedia(false)} title={t('comp.pickMedia')} width={720}>
        {db.media.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-faint">{t('media.empty')}</div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {db.media.map((m) => {
              const on = mediaIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setMediaIds((ids) => (on ? ids.filter((x) => x !== m.id) : [...ids, m.id]))}
                  className="relative aspect-square overflow-hidden rounded-lg border-2 transition-all"
                  style={{ borderColor: on ? 'var(--sd-brand)' : 'transparent' }}
                >
                  {m.dataUrl ? (
                    <img src={m.dataUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : m.url ? (
                    <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ background: m.gradient }}>
                      {m.type === 'video' ? <span className="text-[10px] font-bold text-white/80">VIDEO</span> : null}
                    </div>
                  )}
                  {on ? (
                    <span className="absolute right-1 top-1 rounded-full bg-brand p-0.5 text-white">
                      <Check size={11} />
                    </span>
                  ) : null}
                  <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                    {m.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- 平台预览卡 ---------------- */
function PreviewCard({
  platformId,
  content,
  firstComment,
  media,
  lang,
}: {
  platformId: string;
  content: string;
  firstComment: string;
  media: { id: string; type: string; name: string; url?: string; dataUrl?: string; gradient: string }[];
  lang: 'zh' | 'en';
}) {
  const p = PMAP[platformId];
  const over = content.length > p.maxLength;
  const shown = content.length > 320 ? content.slice(0, 320) + '…' : content;
  return (
    <div className="card-raise overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <PlatformIcon id={platformId} size={18} />
        <span className="text-[12.5px] font-semibold">{lang === 'zh' ? p.nameZh : p.nameEn}</span>
        <span className="ml-auto text-[11px] text-faint">{p.aspect}</span>
      </div>
      <div className="p-3">
        {media.length ? (
          <div className="mb-2 flex gap-1.5">
            {media.slice(0, 3).map((m) => (
              <div key={m.id} className="h-16 w-16 shrink-0 overflow-hidden rounded-md">
                {m.dataUrl ? (
                  <img src={m.dataUrl} alt="" className="h-full w-full object-cover" />
                ) : m.url ? (
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: m.gradient }} />
                )}
              </div>
            ))}
          </div>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-fg">{shown || '…'}</p>
        {firstComment ? (
          <p className="mt-2 rounded-md border border-line bg-bg px-2 py-1 text-[11.5px] text-muted">
            <MessageSquare size={11} className="mr-1 inline" />
            {firstComment}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className={over ? 'font-semibold text-[#ef4444]' : 'text-faint'}>
            {content.length}/{p.maxLength}
          </span>
          {over ? <span className="text-[#ef4444]">⚠</span> : null}
          {p.features.hashtag ? <Hash size={11} className="text-faint" /> : null}
        </div>
      </div>
    </div>
  );
}

export function PostEditorModal({
  post,
  onClose,
}: {
  post: Post | null;
  onClose: () => void;
}) {
  const { i18n } = useStore();
  return (
    <Modal open={!!post} onClose={onClose} title={i18n.t('comp.editPost')} width={980}>
      <PostEditor post={post} embedded onClose={onClose} />
    </Modal>
  );
}

export function StatusBadge({ status }: { status: PostStatus }) {
  const { i18n } = useStore();
  const t = i18n.t;
  const map: Record<PostStatus, { bg: string; fg: string }> = {
    draft: { bg: 'var(--sd-line)', fg: 'var(--sd-muted)' },
    scheduled: { bg: 'color-mix(in srgb,#6366f1 20%, transparent)', fg: '#a5b4fc' },
    published: { bg: 'color-mix(in srgb,#22c55e 18%, transparent)', fg: '#4ade80' },
    failed: { bg: 'color-mix(in srgb,#ef4444 18%, transparent)', fg: '#f87171' },
  };
  const s = map[status];
  return (
    <Badge style={{ background: s.bg, color: s.fg }}>{t(`status.${status}` as never)}</Badge>
  );
}

export function usePostLabel(post: Post): string {
  const { i18n } = useStore();
  return fmtDate(post.scheduledAt ?? post.publishedAt, i18n.lang);
}

export const ALL_PLATFORMS = PLATFORMS;
