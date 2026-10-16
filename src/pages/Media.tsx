import { useRef, useState } from 'react';
import {
  Upload, Link2, Search, Trash2, Copy, Plus, Images, Wand2, FolderOpen,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { Button, Card, Empty, Modal, SectionLabel, Badge } from '../components/ui';
import { copyText, fmtBytes, pickGradient, uid, truncate } from '../lib/utils';
import bridge from '../lib/bridge';
import type { MediaItem } from '../types';

export function MediaPage({ onInsertToDraft }: { onInsertToDraft: (mediaId: string) => void }) {
  const { db, setDB, i18n, pushToast } = useStore();
  const t = i18n.t;
  const [q, setQ] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');
  const [tagEdit, setTagEdit] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const list = db.media.filter((m) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return m.name.toLowerCase().includes(s) || m.tags.some((tg) => tg.toLowerCase().includes(s));
  });

  async function addFile(file: File) {
    /* ——— 独立版：直接写进磁盘的素材目录，没有 5MB 限制，发布时主进程直读文件 ——— */
    if (bridge.isDesktop) {
      const buf = await file.arrayBuffer();
      const res = await bridge.saveMedia(file.name, file.type, buf);
      if (!res || !res.ok || !res.url) {
        pushToast(res?.error ?? '保存失败', 'error');
        return;
      }
      const item: MediaItem = {
        id: uid('media'),
        type: file.type.startsWith('video') ? 'video' : 'image',
        name: file.name,
        url: res.url,
        path: res.path,
        mime: file.type,
        gradient: pickGradient(file.name),
        tags: [],
        createdAt: new Date().toISOString(),
        size: fmtBytes(res.bytes ?? file.size),
      };
      setDB((d) => ({ ...d, media: [item, ...d.media] }));
      pushToast(`${file.name} · ${fmtBytes(res.bytes ?? file.size)}`, 'ok');
      return;
    }

    /* ——— 浏览器版：仍然受 localStorage 限制 ——— */
    if (file.size > 1.6 * 1024 * 1024) {
      pushToast(t('media.storedHint'), 'warn');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const item: MediaItem = {
        id: uid('media'),
        type: file.type.startsWith('video') ? 'video' : 'image',
        name: file.name,
        dataUrl: String(reader.result),
        gradient: pickGradient(file.name),
        tags: [],
        createdAt: new Date().toISOString(),
        size: fmtBytes(file.size),
      };
      setDB((d) => ({ ...d, media: [item, ...d.media] }));
    };
    reader.readAsDataURL(file);
  }

  function addUrl() {
    if (!url.trim()) return;
    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url);
    const item: MediaItem = {
      id: uid('media'),
      type: isVideo ? 'video' : 'image',
      name: url.split('/').pop()?.slice(0, 40) || 'media',
      url: url.trim(),
      gradient: pickGradient(url),
      tags: [],
      createdAt: new Date().toISOString(),
      size: '—',
    };
    setDB((d) => ({ ...d, media: [item, ...d.media] }));
    setUrl('');
    setShowUrl(false);
  }

  function makePlaceholder() {
    const item: MediaItem = {
      id: uid('media'),
      type: 'image',
      name: `${t('media.useTemplate')} ${db.media.length + 1}`,
      gradient: pickGradient(uid('p')),
      tags: [t('media.gradient')],
      createdAt: new Date().toISOString(),
      size: '0 B',
    };
    setDB((d) => ({ ...d, media: [item, ...d.media] }));
  }

  function remove(id: string) {
    const item = db.media.find((m) => m.id === id);
    // 独立版：磁盘上的原件也一起删掉，别留垃圾
    if (item && bridge.isDesktop && item.path) {
      void bridge.deleteMedia({ path: item.path, url: item.url });
    }
    setDB((d) => ({
      ...d,
      media: d.media.filter((m) => m.id !== id),
      posts: d.posts.map((p) => ({ ...p, mediaIds: p.mediaIds.filter((x) => x !== id) })),
    }));
  }

  async function copyLink(m: MediaItem) {
    const link = m.dataUrl ? m.dataUrl : m.url ?? '';
    const ok = await copyText(link);
    pushToast(ok ? t('common.copied') : '—', ok ? 'ok' : 'error');
  }

  function addTag(m: MediaItem) {
    const v = tagInput.trim();
    if (!v) return;
    setDB((d) => ({
      ...d,
      media: d.media.map((x) => (x.id === m.id ? { ...x, tags: Array.from(new Set([...x.tags, v])) } : x)),
    }));
    setTagInput('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('media.search')} className="input w-[240px] pl-8" />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              Array.from(e.target.files ?? []).forEach((f) => void addFile(f));
              e.target.value = '';
            }}
          />
          <Button onClick={() => fileRef.current?.click()}><Upload size={15} /> {t('media.upload')}</Button>
          <Button onClick={() => setShowUrl(true)}><Link2 size={15} /> {t('media.addUrl')}</Button>
          <Button onClick={makePlaceholder}><Wand2 size={15} /> {t('media.useTemplate')}</Button>
        </div>
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty icon={<Images size={30} />} title={t('media.empty')} hint={t('media.emptyHint')} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {list.map((m) => (
            <div key={m.id} className="card group overflow-hidden">
              <div className="relative aspect-square">
                {m.dataUrl ? (
                  <img src={m.dataUrl} alt={m.name} className="h-full w-full object-cover" />
                ) : m.url ? (
                  <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center" style={{ background: m.gradient }}>
                    <span className="rounded bg-black/30 px-2 py-1 text-[11px] font-bold text-white">{m.type === 'video' ? 'VIDEO' : 'IMG'}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => onInsertToDraft(m.id)} title={t('media.insert')} className="rounded bg-black/50 p-1 text-white hover:bg-brand">
                    <Plus size={12} />
                  </button>
                  <button onClick={() => copyLink(m)} title={t('media.copy')} className="rounded bg-black/50 p-1 text-white hover:bg-brand">
                    <Copy size={12} />
                  </button>
                  <button onClick={() => remove(m.id)} title={t('media.delete')} className="ml-auto rounded bg-black/50 p-1 text-white hover:bg-danger">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="p-2">
                <div className="truncate text-[12px] font-medium" title={m.name}>{truncate(m.name, 22)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {m.tags.slice(0, 2).map((tg) => (
                    <Badge key={tg} className="bg-line text-muted">{tg}</Badge>
                  ))}
                  <button
                    onClick={() => {
                      setTagEdit(tagEdit === m.id ? null : m.id);
                      setTagInput('');
                    }}
                    className="text-[11px] text-faint hover:text-fg"
                  >
                    <Plus size={10} className="inline" />
                  </button>
                </div>
                {tagEdit === m.id ? (
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addTag(m);
                        setTagEdit(null);
                      }
                      if (e.key === 'Escape') setTagEdit(null);
                    }}
                    placeholder={t('media.tagPlaceholder')}
                    className="input mt-1 h-6 px-1.5 text-[11px]"
                  />
                ) : null}
                <div className="mt-1 text-[11px] text-faint">{m.size}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="p-4">
        <SectionLabel>{t('set.storage')}</SectionLabel>
        <p className="text-[13px] text-muted">{t('media.storedHint')}</p>
      </Card>

      <Modal open={showUrl} onClose={() => setShowUrl(false)} title={t('media.addUrl')} width={520}>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addUrl();
          }}
          placeholder={t('media.urlPlaceholder')}
          className="input"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowUrl(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={addUrl}><FolderOpen size={14} /> {t('common.add')}</Button>
        </div>
        <p className="mt-3 text-[12px] text-faint">{t('media.storedHint')}</p>
      </Modal>
    </div>
  );
}
