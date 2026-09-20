import { useEffect, useMemo, useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, toggleFavorite, deleteLifeItem, logBookReread } from '@/db/repositories/lifeRepository';
import type { BookItem } from '@/db/schema';
import BookCard from './BookCard';
import BookEditorModal from './BookEditorModal';
import BookDetailModal from './BookDetailModal';
import GoodreadsImportModal from './GoodreadsImportModal';

interface BooksPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: BookItem;
}

type FilterTab = 'all' | 'wantTo' | 'inProgress' | 'finished' | 'didNotFinish' | 'favorites';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'wantTo', label: 'Want to Read' },
  { id: 'inProgress', label: 'Reading' },
  { id: 'finished', label: 'Finished' },
  { id: 'didNotFinish', label: 'Did Not Finish' },
  { id: 'favorites', label: 'Favorites' },
];

export default function BooksPage({ showToast, onBack, initialOpenItem }: BooksPageProps) {
  const books = useLifeItemsOfType('book') as BookItem[];
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<'closed' | 'new' | BookItem>('closed');
  const [detail, setDetail] = useState<BookItem | null>(initialOpenItem ?? null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (initialOpenItem) setDetail(initialOpenItem);
  }, [initialOpenItem]);

  const filtered = useMemo(() => {
    let list = books;
    if (tab === 'favorites') list = list.filter((b) => b.favorite);
    else if (tab !== 'all') list = list.filter((b) => b.status === tab);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((b) => b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q));
    return list;
  }, [books, tab, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sand-800/60 hover:text-sand-900 text-sm px-1">
          ← Life
        </button>
        <h2 className="serif text-xl font-semibold text-sand-900">Books</h2>
        <div className="ml-auto flex gap-2">
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
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your books…"
        className="w-full p-3 bg-white border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 shadow-sm"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              tab === t.id ? 'bg-sage-500 text-white' : 'bg-sand-100 text-sand-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">📖</span>
          <p className="text-sm text-sand-800/70">Nothing here yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((book) => (
            <BookCard key={book.id} book={book} onClick={() => setDetail(book)} />
          ))}
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

      {importing && (
        <GoodreadsImportModal
          existingBooks={books}
          onClose={() => setImporting(false)}
          onImported={(count) => {
            setImporting(false);
            showToast(count > 0 ? `Imported ${count} book${count === 1 ? '' : 's'} from Goodreads 📚` : 'Nothing new to import');
          }}
        />
      )}
    </div>
  );
}
