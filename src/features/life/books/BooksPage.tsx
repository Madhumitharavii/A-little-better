import { useEffect, useMemo, useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, toggleFavorite, deleteLifeItem, logBookReread } from '@/db/repositories/lifeRepository';
import type { BookItem } from '@/db/schema';
import { compareTitles } from '@/shared/utils/collate';
import BookCard from './BookCard';
import BookEditorModal from './BookEditorModal';
import BookDetailModal from './BookDetailModal';
import GoodreadsImportModal from './GoodreadsImportModal';
import BookPickModal from './BookPickModal';

interface BooksPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: BookItem;
}

type FilterTab = 'all' | 'wantTo' | 'inProgress' | 'finished' | 'didNotFinish' | 'favorites' | 'shelves';

const PAGE = 60;
/** Most recently finished first; then by title (numbers in order). */
const byLatest = (a: BookItem, b: BookItem) =>
  (b.dateFinished ?? b.dateStarted ?? '').localeCompare(a.dateFinished ?? a.dateStarted ?? '') ||
  compareTitles(a.title, b.title);

export default function BooksPage({ showToast, onBack, initialOpenItem }: BooksPageProps) {
  const books = useLifeItemsOfType('book') as BookItem[];
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<'closed' | 'new' | BookItem>('closed');
  const [detail, setDetail] = useState<BookItem | null>(initialOpenItem ?? null);
  const [importing, setImporting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [shelf, setShelf] = useState<string | null>(null);
  const sortedBooks = useMemo(() => [...books].sort(byLatest), [books]);
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => setVisible(PAGE), [tab, query, shelf]);

  const shelfNames = useMemo(() => {
    const names = new Map<string, number>();
    for (const b of books) for (const sh of b.shelves ?? []) names.set(sh, (names.get(sh) ?? 0) + 1);
    return [...names.entries()].sort((a, b) => b[1] - a[1]);
  }, [books]);
  const countOf = (pred: (b: BookItem) => boolean) => books.filter(pred).length;
  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    // "All" is what's been read or started — want-to-read lives in its own tab.
    { id: 'all', label: 'All', count: countOf((b) => b.status !== 'wantTo') },
    { id: 'inProgress', label: 'Reading', count: countOf((b) => b.status === 'inProgress') },
    { id: 'finished', label: 'Finished', count: countOf((b) => b.status === 'finished') },
    { id: 'favorites', label: 'Favorites', count: countOf((b) => !!b.favorite) },
    { id: 'wantTo', label: 'Want to Read', count: countOf((b) => b.status === 'wantTo') },
    { id: 'didNotFinish', label: 'Did Not Finish', count: countOf((b) => b.status === 'didNotFinish') },
    ...(shelfNames.length ? [{ id: 'shelves' as const, label: 'Shelves', count: shelfNames.length }] : []),
  ];

  useEffect(() => {
    if (initialOpenItem) setDetail(initialOpenItem);
  }, [initialOpenItem]);

  const filtered = useMemo(() => {
    let list = sortedBooks;
    if (tab === 'all') list = list.filter((b) => b.status !== 'wantTo');
    else if (tab === 'favorites') list = list.filter((b) => b.favorite);
    else if (tab === 'shelves') list = shelf ? list.filter((b) => b.shelves?.includes(shelf)) : [];
    else if (tab === 'wantTo') list = list.filter((b) => b.status === 'wantTo').sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''));
    else list = list.filter((b) => b.status === tab);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((b) => b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q));
    return list;
  }, [sortedBooks, tab, query, shelf]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="text-sand-800/60 hover:text-sand-900 text-sm px-1">
          ← Life
        </button>
        <h2 className="serif text-xl font-semibold text-sand-900">Books</h2>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setPicking(true)}
            className="px-3 py-2 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl"
          >
            🎲 Pick for me
          </button>
          <button
            onClick={() => setImporting(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl"
          >
            Import from Goodreads
          </button>
          <button
            onClick={() => setEditing('new')}
            className="px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
          >
            + Add Book
          </button>
        </div>
      </div>

      <input
        aria-label="Search your books"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your books…"
        className="w-full p-3 bg-white border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 shadow-sm"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === t.id ? 'bg-sage-500 text-white' : 'bg-sand-100 text-sand-800'
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && <span className="ml-1 opacity-70">{t.count.toLocaleString()}</span>}
          </button>
        ))}
      </div>

      {tab === 'shelves' && (
        <div className="flex flex-wrap gap-2">
          {shelfNames.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setShelf(shelf === name ? null : name)}
              className={`px-3 py-2 rounded-2xl text-xs font-medium border transition-all ${
                shelf === name ? 'bg-sage-500 text-white border-sage-500' : 'bg-sage-100 text-sage-700 border-sage-300/40'
              }`}
            >
              🗂️ {name} <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'shelves' && !shelf ? (
        <p className="text-xs text-sand-800/60 px-1">Choose a shelf to see its books.</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">📖</span>
          <p className="text-sm text-sand-800/70">Nothing here yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
          {filtered.slice(0, visible).map((book) => (
            <BookCard key={book.id} book={book} onClick={() => setDetail(book)} />
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
        <BookEditorModal
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing('closed')}
          onSave={async (input) => {
            if (editing === 'new') {
              await createLifeItem({ type: 'book', ...input });
              showToast('Book added to your library 📖');
            } else {
              await updateLifeItem(editing.id, { type: 'book', ...input });
              showToast('Book updated');
            }
            setEditing('closed');
          }}
        />
      )}

      {detail && (
        <BookDetailModal
          book={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
          onToggleFavorite={async () => {
            const updated = await toggleFavorite(detail.id);
            if (updated?.type === 'book') setDetail(updated);
          }}
          onDelete={async () => {
            await deleteLifeItem(detail.id);
            showToast('Book removed');
            setDetail(null);
          }}
          onLogReread={async () => {
            const updated = await logBookReread(detail.id);
            if (updated) {
              setDetail(updated);
              showToast('New reading started — your last one is saved in history 📖');
            }
          }}
        />
      )}

      {picking && (
        <BookPickModal
          books={books}
          onClose={() => setPicking(false)}
          onOpenBook={(b) => {
            setPicking(false);
            setDetail(b);
          }}
        />
      )}

      {importing && (
        <GoodreadsImportModal
          existingBooks={books}
          onClose={() => setImporting(false)}
          onImported={(count) => {
            setImporting(false);
            showToast(count > 0 ? `Imported ${count.toLocaleString()} book${count === 1 ? '' : 's'} from Goodreads 📚` : 'Everything was already up to date');
          }}
        />
      )}
    </div>
  );
}
