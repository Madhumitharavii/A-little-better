import { useEffect, useMemo, useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, toggleFavorite, deleteLifeItem } from '@/db/repositories/lifeRepository';
import type { SeriesItem } from '@/db/schema';
import SeriesCard from './SeriesCard';
import SeriesEditorModal from './SeriesEditorModal';
import SeriesDetailModal from './SeriesDetailModal';

interface SeriesPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: SeriesItem;
}

type FilterTab = 'all' | 'wantTo' | 'watching' | 'finished' | 'favorites';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'wantTo', label: 'Want to Watch' },
  { id: 'watching', label: 'Watching' },
  { id: 'finished', label: 'Finished' },
  { id: 'favorites', label: 'Favorites' },
];

export default function SeriesPage({ showToast, onBack, initialOpenItem }: SeriesPageProps) {
  const seriesList = useLifeItemsOfType('series') as SeriesItem[];
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<'closed' | 'new' | SeriesItem>('closed');
  const [detail, setDetail] = useState<SeriesItem | null>(initialOpenItem ?? null);

  useEffect(() => {
    if (initialOpenItem) setDetail(initialOpenItem);
  }, [initialOpenItem]);

  const filtered = useMemo(() => {
    let list = seriesList;
    if (tab === 'favorites') list = list.filter((s) => s.favorite);
    else if (tab !== 'all') list = list.filter((s) => s.status === tab);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((s) => s.title.toLowerCase().includes(q));
    return list;
  }, [seriesList, tab, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sand-800/60 hover:text-sand-900 text-sm px-1">
          ← Life
        </button>
        <h2 className="serif text-xl font-semibold text-sand-900">Series</h2>
        <button
          onClick={() => setEditing('new')}
          className="ml-auto px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
        >
          + Add Series
        </button>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your series…"
        className="w-full p-3 bg-white border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 shadow-sm"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === t.id ? 'bg-slate-800 text-white' : 'bg-sand-100 text-sand-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">📺</span>
          <p className="text-sm text-sand-800/70">Nothing here yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((series) => (
            <SeriesCard key={series.id} series={series} onClick={() => setDetail(series)} />
          ))}
        </div>
      )}

      {editing !== 'closed' && (
        <SeriesEditorModal
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing('closed')}
          onSave={async (input) => {
            if (editing === 'new') {
              await createLifeItem({ type: 'series', ...input });
              showToast('Series added 📺');
            } else {
              await updateLifeItem(editing.id, { type: 'series', ...input });
              showToast('Series updated');
            }
            setEditing('closed');
          }}
        />
      )}

      {detail && (
        <SeriesDetailModal
          series={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
          onToggleFavorite={async () => {
            const updated = await toggleFavorite(detail.id);
            if (updated?.type === 'series') setDetail(updated);
          }}
          onDelete={async () => {
            await deleteLifeItem(detail.id);
            showToast('Series removed');
            setDetail(null);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
