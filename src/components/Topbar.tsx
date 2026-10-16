import { Languages, Moon, Sun, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { Button, IconButton } from './ui';
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
  messenger: { zh: '消息聚合', en: 'Messages' },
  settings: { zh: '设置', en: 'Settings' },
};

export function Topbar({ page, onNew }: { page: PageKey; onNew: () => void }) {
  const { i18n, setLang, db, updateSettings, pushToast } = useStore();
  const t = i18n.t;
  const [q, setQ] = useState('');
  const title = TITLES[page][i18n.lang];

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
      <div className="min-w-0">
        <h1 className="truncate text-[16px] font-semibold leading-tight tracking-tight">{title}</h1>
      </div>

      <div className="relative ml-auto hidden md:block">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('common.search')}
          className="input w-[220px] pl-8"
        />
        {q ? (
          <span className="tnum pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-faint">
            {db.posts.length}
          </span>
        ) : null}
      </div>

      <Button
        variant="ghost"
        onClick={() => {
          setLang(i18n.lang === 'zh' ? 'en' : 'zh');
          pushToast(t('toast.langChanged'));
        }}
        title={t('set.language')}
      >
        <Languages size={15} />
        <span className="text-[13px]">{i18n.lang === 'zh' ? 'EN' : '中文'}</span>
      </Button>

      <IconButton
        label={t('set.theme')}
        size="md"
        onClick={() => {
          const next = db.settings.theme === 'dark' ? 'light' : 'dark';
          updateSettings({ theme: next });
          pushToast(t('toast.themeChanged'));
        }}
      >
        {db.settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </IconButton>

      <Button variant="primary" onClick={onNew}>
        <Plus size={15} /> {t('dash.newPost')}
      </Button>
    </header>
  );
}
