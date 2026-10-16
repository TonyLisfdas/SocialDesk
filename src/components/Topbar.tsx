import { Languages, Moon, Sun, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { Button } from './ui';
import type { PageKey } from './Sidebar';

const TITLES: Record<PageKey, { zh: string; en: string }> = {
  dashboard: { zh: '总览', en: 'Dashboard' },
  calendar: { zh: '内容日历', en: 'Content calendar' },
  composer: { zh: '创作台', en: 'Composer' },
  media: { zh: '素材库', en: 'Media library' },
  ideas: { zh: '灵感库', en: 'Ideas' },
  queue: { zh: '发布队列', en: 'Publishing queue' },
  inbox: { zh: '统一收件箱', en: 'Unified inbox' },
  analytics: { zh: '数据分析', en: 'Analytics' },
  accounts: { zh: '账号管理', en: 'Accounts' },
  engine: { zh: '发布引擎', en: 'Publish engine' },
  settings: { zh: '设置', en: 'Settings' },
};

export function Topbar({ page, onNew }: { page: PageKey; onNew: () => void }) {
  const { i18n, setLang, db, updateSettings, pushToast } = useStore();
  const t = i18n.t;
  const [q, setQ] = useState('');
  const title = TITLES[page][i18n.lang];

  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
      </div>

      <div className="relative ml-auto hidden md:block">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('common.search')}
          className="input h-[32px] w-[200px] pl-8"
        />
        {q ? (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-faint">{db.posts.length}</span>
        ) : null}
      </div>

      <Button size="sm" variant="ghost" onClick={() => { setLang(i18n.lang === 'zh' ? 'en' : 'zh'); pushToast(t('toast.langChanged')); }}>
        <Languages size={15} />
        {i18n.lang === 'zh' ? 'EN' : '中文'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          const next = db.settings.theme === 'dark' ? 'light' : 'dark';
          updateSettings({ theme: next });
          pushToast(t('toast.themeChanged'));
        }}
        title={t('set.theme')}
      >
        {db.settings.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </Button>
      <Button size="sm" variant="primary" onClick={onNew}>
        <Plus size={15} /> {t('dash.newPost')}
      </Button>
    </header>
  );
}
