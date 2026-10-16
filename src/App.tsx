import { useCallback, useMemo, useState } from 'react';
import { useStore } from './lib/store';
import { Sidebar, type PageKey } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Toasts } from './components/Toasts';
import { PostEditorModal } from './components/PostEditor';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Composer, type ComposerSeed } from './pages/Composer';
import { MediaPage } from './pages/Media';
import { IdeasPage } from './pages/Ideas';
import { QueuePage } from './pages/Queue';
import { InboxPage } from './pages/Inbox';
import { AnalyticsPage } from './pages/Analytics';
import { AccountsPage } from './pages/Accounts';
import { SettingsPage } from './pages/Settings';
import { EnginePage } from './pages/Engine';
import { MessengerPage } from './pages/Messenger';
import { uid } from './lib/utils';

export default function App() {
  const { db, setDB, i18n, pushToast } = useStore();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composerPostId, setComposerPostId] = useState<string | null>(null);
  const [composerSeed, setComposerSeed] = useState<ComposerSeed | undefined>(undefined);
  const [composerKey, setComposerKey] = useState(0);

  const editingPost = useMemo(
    () => (editingId ? db.posts.find((p) => p.id === editingId) ?? null : null),
    [editingId, db.posts],
  );
  const composerPost = useMemo(
    () => (composerPostId ? db.posts.find((p) => p.id === composerPostId) ?? null : null),
    [composerPostId, db.posts],
  );

  const openComposer = useCallback((postId: string | null, seed?: ComposerSeed) => {
    setComposerPostId(postId);
    setComposerSeed(seed);
    setComposerKey((k) => k + 1);
    setPage('composer');
  }, []);

  const handleNew = useCallback(() => {
    openComposer(null, undefined);
  }, [openComposer]);

  const handleEditFromCalendar = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleCreateFromCalendar = useCallback(
    (dateISO?: string) => {
      const scheduledAt = dateISO ? new Date(dateISO) : undefined;
      if (scheduledAt) {
        scheduledAt.setHours(10, 0, 0, 0);
        if (scheduledAt.getTime() < Date.now()) scheduledAt.setDate(scheduledAt.getDate() + 1);
      }
      openComposer(null, scheduledAt ? { scheduledAt: toLocal(scheduledAt) } : undefined);
    },
    [openComposer],
  );

  const handleInsertMedia = useCallback(
    (mediaId: string) => {
      openComposer(null, { mediaIds: [mediaId] });
      pushToast(i18n.t('media.insert'));
    },
    [openComposer, pushToast, i18n.t],
  );

  const handleConvertIdea = useCallback(
    (ideaId: string) => {
      const idea = db.ideas.find((i) => i.id === ideaId);
      if (!idea) return;
      const now = new Date().toISOString();
      const post = {
        id: uid('post'),
        content: idea.text,
        platforms: [],
        status: 'draft' as const,
        mediaIds: [],
        hashtags: idea.tags,
        note: idea.source ?? '',
        createdAt: now,
        updatedAt: now,
      };
      setDB((d) => ({
        ...d,
        posts: [post, ...d.posts],
        ideas: d.ideas.map((i) => (i.id === ideaId ? { ...i, converted: true } : i)),
      }));
      openComposer(post.id);
    },
    [db.ideas, setDB, openComposer],
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-fg">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar page={page} onNew={handleNew} />
        <main key={page} className="page-enter scroll-thin flex-1 overflow-y-auto p-5">
          {page === 'dashboard' ? (
            <Dashboard onNavigate={setPage} onEdit={(id) => { openComposer(id); }} />
          ) : null}
          {page === 'calendar' ? (
            <Calendar onEdit={handleEditFromCalendar} onCreate={handleCreateFromCalendar} />
          ) : null}
          {page === 'composer' ? (
            <Composer key={`${composerKey}-${composerPostId ?? 'new'}`} post={composerPost} seed={composerSeed} />
          ) : null}
          {page === 'media' ? <MediaPage onInsertToDraft={handleInsertMedia} /> : null}
          {page === 'ideas' ? <IdeasPage onConvert={handleConvertIdea} /> : null}
          {page === 'queue' ? <QueuePage onEdit={(id) => { openComposer(id); }} /> : null}
          {page === 'inbox' ? <InboxPage /> : null}
          {page === 'analytics' ? <AnalyticsPage /> : null}
          {page === 'accounts' ? <AccountsPage /> : null}
          {page === 'engine' ? <EnginePage /> : null}
          {page === 'messenger' ? <MessengerPage /> : null}
          {page === 'settings' ? <SettingsPage /> : null}
        </main>
      </div>

      <PostEditorModal
        post={editingPost}
        onClose={() => setEditingId(null)}
      />
      <Toasts />
    </div>
  );
}

function toLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
