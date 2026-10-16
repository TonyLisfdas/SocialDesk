import { useState } from 'react';
import { Lightbulb, Trash2, PenLine, CheckCircle2, Link2, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Button, Card, Empty, Badge } from '../components/ui';
import { uid, truncate } from '../lib/utils';

export function IdeasPage({ onConvert }: { onConvert: (ideaId: string) => void }) {
  const { db, setDB, i18n } = useStore();
  const t = i18n.t;
  const [text, setText] = useState('');
  const [source, setSource] = useState('');

  function add() {
    if (!text.trim()) return;
    setDB((d) => ({
      ...d,
      ideas: [
        { id: uid('idea'), text: text.trim(), tags: [], source: source.trim(), createdAt: new Date().toISOString(), converted: false },
        ...d.ideas,
      ],
    }));
    setText('');
    setSource('');
  }

  function remove(id: string) {
    setDB((d) => ({ ...d, ideas: d.ideas.filter((i) => i.id !== id) }));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              add();
            }
          }}
          rows={3}
          placeholder={t('ideas.placeholder')}
          className="input"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={t('ideas.sourcePlaceholder')}
            className="input max-w-[280px] flex-1"
          />
          <Button variant="primary" onClick={add}>
            <Lightbulb size={15} /> {t('ideas.add')}
          </Button>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span>{db.ideas.length} {t('ideas.count')}</span>
      </div>

      {db.ideas.length === 0 ? (
        <Card>
          <Empty icon={<Lightbulb size={30} />} title={t('ideas.empty')} hint={t('ideas.emptyHint')} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {db.ideas.map((idea) => (
            <div key={idea.id} className="card flex flex-col gap-2 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 rounded-[var(--sd-r-sm)] bg-brand/15 p-1.5 text-brand"><Lightbulb size={13} /></span>
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed">{idea.text}</p>
                {idea.converted ? <CheckCircle2 size={15} className="shrink-0 text-ok" /> : null}
              </div>
              {idea.source ? (
                <span className="flex items-center gap-1 text-[11px] text-faint">
                  <Link2 size={11} /> {truncate(idea.source, 48)}
                </span>
              ) : null}
              <div className="mt-auto flex items-center gap-1.5 pt-1">
                {idea.converted ? (
                  <Badge className="bg-[color-mix(in_srgb,#22c55e_18%,transparent)] text-ok">{t('ideas.done')}</Badge>
                ) : (
                  <Button size="sm" onClick={() => onConvert(idea.id)}>
                    <PenLine size={13} /> {t('ideas.toPost')}
                  </Button>
                )}
                <button
                  onClick={() => remove(idea.id)}
                  className="ml-auto rounded p-1.5 text-faint transition-colors hover:text-danger"
                  title={t('ideas.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[12px] text-faint">
        <X size={11} className="mr-1 inline" />
        {t('ideas.placeholder')}
      </p>
    </div>
  );
}
