import { useEffect, useMemo, useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, toggleFavorite, deleteLifeItem, logMovieRewatch } from '@/db/repositories/lifeRepository';
import type { MovieItem } from '@/db/schema';
import MovieCard from './MovieCard';
import MovieEditorModal from './MovieEditorModal';
import MovieDetailModal from './MovieDetailModal';
import LetterboxdImportModal from './LetterboxdImportModal';

interface MoviesPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: MovieItem;
}

type FilterTab = 'all' | 'recent' | 'favorites' | 'rewatches';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Recently Watched' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'rewatches', label: 'Rewatches' },
];

export default function MoviesPage({ showToast, onBack, initialOpenItem }: MoviesPageProps) {
  const movies = useLifeItemsOfType('movie') as MovieItem[];
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<'closed' | 'new' | MovieItem>('closed');
  const [detail, setDetail] = useState<MovieItem | null>(initialOpenItem ?? null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (initialOpenItem) setDetail(initialOpenItem);
  }, [initialOpenItem]);

  const filtered = useMemo(() => {
    let list = movies;
    if (tab === 'favorites') list = list.filter((m) => m.favorite);
    else if (tab === 'rewatches') list = list.filter((m) => m.rewatch);
    else if (tab === 'recent') list = [...list].sort((a, b) => (b.dateWatched ?? '').localeCompare(a.dateWatched ?? ''));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((m) => m.title.toLowerCase().includes(q));
    return list;
  }, [movies, tab, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="text-sand-800/60 hover:text-sand-900 text-sm px-1">
          ← Life
        </button>
        <h2 className="serif text-xl font-semibold text-sand-900">Movies</h2>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setImporting(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl"
          >
            Import from Letterboxd
          </button>
          <button
            onClick={() => setEditing('new')}
            className="px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
          >
            + Add Movie
          </button>
        </div>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your movies…"
        className="w-full p-3 bg-white border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 shadow-sm"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === t.id ? 'bg-terracotta-400 text-white' : 'bg-sand-100 text-sand-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">🎬</span>
          <p className="text-sm text-sand-800/70">Nothing here yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onClick={() => setDetail(movie)} />
          ))}
        </div>
      )}

      {editing !== 'closed' && (
        <MovieEditorModal
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing('closed')}
          onSave={async (input) => {
            if (editing === 'new') {
              await createLifeItem({ type: 'movie', ...input });
              showToast('Movie added 🎬');
            } else {
              await updateLifeItem(editing.id, { type: 'movie', ...input });
              showToast('Movie updated');
            }
            setEditing('closed');
          }}
        />
      )}

      {detail && (
        <MovieDetailModal
          movie={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
          onToggleFavorite={async () => {
            const updated = await toggleFavorite(detail.id);
            if (updated?.type === 'movie') setDetail(updated);
          }}
          onDelete={async () => {
            await deleteLifeItem(detail.id);
            showToast('Movie removed');
            setDetail(null);
          }}
          onLogRewatch={async () => {
            const updated = await logMovieRewatch(detail.id);
            if (updated) {
              setDetail(updated);
              showToast('New watch logged — your last one is saved in history 🎬');
            }
          }}
        />
      )}

      {importing && (
        <LetterboxdImportModal
          existingMovies={movies}
          onClose={() => setImporting(false)}
          onImported={(count) => {
            setImporting(false);
            showToast(`Imported ${count} movie${count === 1 ? '' : 's'} from Letterboxd 🎞️`);
          }}
        />
      )}
    </div>
  );
}
