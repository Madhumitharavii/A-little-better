import { useEffect, useMemo, useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, toggleFavorite, deleteLifeItem, logMovieRewatch } from '@/db/repositories/lifeRepository';
import type { MovieItem } from '@/db/schema';
import { compareTitles } from '@/shared/utils/collate';
import { getLocalDateKey } from '@/db/dateUtils';
import MovieCard from './MovieCard';
import MovieEditorModal from './MovieEditorModal';
import MovieDetailModal from './MovieDetailModal';
import LetterboxdImportModal from './LetterboxdImportModal';

interface MoviesPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: MovieItem;
}

type FilterTab = 'all' | 'recent' | 'favorites' | 'rewatches' | 'reviews' | 'watchlist' | 'lists';

const PAGE = 60;

const hasReview = (m: MovieItem) => !!m.review || !!m.previousWatches?.some((w) => w.review);
/** Newest watch first; films with no watch date after, by title. */
const byLatest = (a: MovieItem, b: MovieItem) =>
  (b.dateWatched ?? '').localeCompare(a.dateWatched ?? '') || compareTitles(a.title, b.title);

export default function MoviesPage({ showToast, onBack, initialOpenItem }: MoviesPageProps) {
  const movies = useLifeItemsOfType('movie') as MovieItem[];
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<'closed' | 'new' | MovieItem>('closed');
  const [detail, setDetail] = useState<MovieItem | null>(initialOpenItem ?? null);
  const [importing, setImporting] = useState(false);
  const [list, setList] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => setVisible(PAGE), [tab, query, list]);

  const watched = useMemo(() => movies.filter((m) => m.status !== 'watchlist'), [movies]);
  const watchlist = useMemo(() => movies.filter((m) => m.status === 'watchlist'), [movies]);
  // Sorted once per change to the library — not on every keystroke or tab switch.
  const watchedSorted = useMemo(() => [...watched].sort(byLatest), [watched]);
  const watchlistSorted = useMemo(
    () => [...watchlist].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || compareTitles(a.title, b.title)),
    [watchlist],
  );
  const listNames = useMemo(() => {
    const names = new Map<string, number>();
    for (const m of movies) for (const l of m.lists ?? []) names.set(l.name, (names.get(l.name) ?? 0) + 1);
    return [...names.entries()];
  }, [movies]);

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: watched.length },
    { id: 'recent', label: 'Recently Watched' },
    { id: 'favorites', label: 'Favorites', count: watched.filter((m) => m.favorite).length },
    { id: 'rewatches', label: 'Rewatches', count: watched.filter((m) => m.rewatch).length },
    { id: 'reviews', label: 'Reviews', count: watched.filter(hasReview).length },
    { id: 'watchlist', label: 'Watchlist', count: watchlist.length },
    ...(listNames.length ? [{ id: 'lists' as const, label: 'Lists', count: listNames.length }] : []),
  ];

  useEffect(() => {
    if (initialOpenItem) setDetail(initialOpenItem);
  }, [initialOpenItem]);

  const filtered = useMemo(() => {
    let out: MovieItem[];
    if (tab === 'watchlist') out = watchlistSorted;
    else if (tab === 'lists') {
      if (!list) out = [];
      else {
        const pos = (m: MovieItem) => m.lists?.find((l) => l.name === list)?.position ?? Infinity;
        out = movies.filter((m) => m.lists?.some((l) => l.name === list)).sort((a, b) => pos(a) - pos(b));
      }
    } else {
      out = watchedSorted;
      if (tab === 'favorites') out = out.filter((m) => m.favorite);
      else if (tab === 'rewatches') out = out.filter((m) => m.rewatch);
      else if (tab === 'reviews') out = out.filter(hasReview);
      else if (tab === 'recent') out = out.filter((m) => m.dateWatched);
    }
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((m) => m.title.toLowerCase().includes(q));
    return out;
  }, [movies, watchedSorted, watchlistSorted, tab, query, list]);

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
        aria-label="Search your movies"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your movies…"
        className="w-full p-3 bg-white border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 shadow-sm"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === t.id ? 'bg-terracotta-400 text-white' : 'bg-sand-100 text-sand-800'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && <span className="ml-1 opacity-70">{t.count.toLocaleString()}</span>}
          </button>
        ))}
      </div>

      {tab === 'lists' && (
        <div className="flex flex-wrap gap-2">
          {listNames.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setList(list === name ? null : name)}
              className={`px-3 py-2 rounded-2xl text-xs font-medium border transition-all ${
                list === name ? 'bg-slate-500 text-white border-slate-500' : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              📋 {name} <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'lists' && !list ? (
        <p className="text-xs text-sand-800/60 px-1">Choose a list to see its films in order.</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">🎬</span>
          <p className="text-sm text-sand-800/70">Nothing here yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
          {filtered.slice(0, visible).map((movie) => (
            <MovieCard key={movie.id} movie={movie} onClick={() => setDetail(movie)} />
          ))}
          {filtered.length > visible && (
            <button
              onClick={() => setVisible((v) => v + PAGE * 2)}
              className="sm:col-span-2 lg:col-span-3 2xl:col-span-4 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl"
            >
              Show more ({(filtered.length - visible).toLocaleString()} left)
            </button>
          )}
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
          onMarkWatched={async () => {
            const updated = await updateLifeItem(detail.id, { type: 'movie', status: 'watched', dateWatched: getLocalDateKey() });
            if (updated?.type === 'movie') setDetail(updated);
            showToast('Moved from your watchlist to watched 🎬');
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
            showToast(count > 0 ? `Imported ${count.toLocaleString()} movie${count === 1 ? '' : 's'} from Letterboxd 🎞️` : 'Everything was already up to date');
          }}
        />
      )}
    </div>
  );
}
