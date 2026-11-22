import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { BookItem, CareEntry, WishItem } from '@/db/schema';
import { getLifeItems, updateLifeItem } from '@/db/repositories/lifeRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { booksFinishedIn, readingGoalTarget } from '@/features/life/wishlist/visionList';
import { shuffle } from '@/features/toolbox/boredIdeas';
import { seededRandom } from '@/features/ai/ml';

interface ReadingTrackerProps {
  entry: CareEntry | undefined;
  onAddMinutes: (minutes: number) => void;
  onToggleDone: () => void;
  showToast: (msg: string) => void;
}

/**
 * Daily reading minutes, tied to the books in Life: shows the book you're
 * reading (status "Reading"), lets you mark it finished — which counts
 * toward a "Read N books" vision goal — and, with nothing on the go,
 * helps pick one from Want to Read.
 */
export default function ReadingTracker({ entry, onAddMinutes, onToggleDone, showToast }: ReadingTrackerProps) {
  const isDone = entry?.status === 'done';
  const minutes = entry?.valueMinutes ?? 0;
  const books = (useLiveQuery(() => getLifeItems('book'), []) ?? []) as BookItem[];
  const wishes = (useLiveQuery(() => getLifeItems('wish'), []) ?? []) as WishItem[];

  const reading = useMemo(
    () => books.filter((b) => b.status === 'inProgress').sort((a, b) => (b.dateStarted ?? b.updatedAt).localeCompare(a.dateStarted ?? a.updatedAt)),
    [books],
  );
  const toRead = useMemo(() => books.filter((b) => b.status === 'wantTo'), [books]);
  const [which, setWhich] = useState(0);
  const current = reading.length ? reading[which % reading.length] : undefined;

  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [seed, setSeed] = useState(() => Math.random());
  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return toRead.filter((b) => b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q)).slice(0, 5);
    // Three random suggestions (stable until "Surprise me" is tapped).
    return shuffle(toRead, seededRandom(Math.floor(seed * 1e9))).slice(0, 3);
  }, [toRead, query, seed]);

  const year = new Date().getFullYear();
  const goal = wishes.find((w) => w.listType === 'annualVision' && !w.done && !w.missed && (w.year ?? year) === year && readingGoalTarget(w.title));
  const target = goal ? readingGoalTarget(goal.title) : null;

  const startBook = async (book: BookItem) => {
    await updateLifeItem(book.id, { type: 'book', status: 'inProgress', dateStarted: getLocalDateKey() });
    setPicking(false);
    setQuery('');
    setWhich(0);
    showToast(`Happy reading: ${book.title} 📖`);
  };

  const finishBook = async (book: BookItem) => {
    await updateLifeItem(book.id, { type: 'book', status: 'finished', dateFinished: getLocalDateKey() });
    const done = booksFinishedIn(books, year) + 1;
    showToast(target ? `Finished ${book.title}! That's ${done} of ${target} this year 📚` : `Finished ${book.title}! 📚`);
  };

  return (
    <div className="p-3 bg-sand-50/50 border border-sand-200 rounded-2xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">📖</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sand-900">Reading</p>
            <p className="text-[11px] text-sand-800/60">
              {minutes} mins today
              {target ? ` · ${booksFinishedIn(books, year)} of ${target} books this year` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleDone}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border shrink-0 ${
            isDone ? 'bg-sage-500 text-white border-sage-500' : 'bg-sand-50 border-sand-300 text-sand-800'
          }`}
        >
          {isDone ? 'Done ✓' : 'Mark Done'}
        </button>
      </div>

      {current ? (
        <div className="flex items-center gap-2 bg-sand-100/70 rounded-xl px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-sand-800/50 font-semibold">Now reading</p>
            <p className="text-xs font-semibold text-sand-900 leading-snug break-words">
              {current.title}
              {current.author && <span className="font-normal text-sand-800/60"> · {current.author}</span>}
            </p>
          </div>
          {reading.length > 1 && (
            <button onClick={() => setWhich((w) => w + 1)} className="text-[10px] text-sand-800/60 hover:text-sand-900 shrink-0 px-1" title="Switch book">
              {(which % reading.length) + 1}/{reading.length} ›
            </button>
          )}
          <button
            onClick={() => finishBook(current)}
            className="text-[11px] px-2.5 py-1.5 bg-sage-500 hover:bg-sage-700 text-white rounded-lg font-semibold shrink-0"
          >
            Finished it 🎉
          </button>
        </div>
      ) : picking ? (
        <div className="space-y-1.5 bg-sand-100/70 rounded-xl p-2">
          <input
            aria-label="Search your Want to Read"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={toRead.length ? `Search your ${toRead.length} Want to Read…` : 'Your Want to Read is empty'}
            className="w-full px-3 py-2 bg-sand-50 border border-sand-200 rounded-lg text-xs text-sand-900 focus:outline-none"
          />
          {choices.map((b) => (
            <button
              key={b.id}
              onClick={() => startBook(b)}
              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-sand-50 text-xs text-sand-900 leading-snug"
            >
              {b.title}
              {b.author && <span className="text-sand-800/60"> · {b.author}</span>}
            </button>
          ))}
          <div className="flex justify-between text-[11px] px-1">
            <button onClick={() => setSeed(Math.random())} disabled={!toRead.length} className="text-sand-800/70 hover:text-sand-900 underline underline-offset-2">
              Surprise me 🎲
            </button>
            <button onClick={() => setPicking(false)} className="text-sand-800/60 hover:text-sand-900">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="w-full text-left text-[11px] text-sand-800/70 hover:text-sand-900 bg-sand-100/60 hover:bg-sand-100 rounded-xl px-3 py-2"
        >
          No book on the go. <span className="font-semibold underline underline-offset-2">Start a book</span>
        </button>
      )}

      <div className="flex gap-2 pt-1">
        {[5, 10, 15].map((mins) => (
          <button
            key={mins}
            onClick={() => onAddMinutes(mins)}
            className="flex-1 py-2 bg-sand-50 hover:bg-sand-100 border border-sand-200 rounded-xl text-[11px] font-medium text-sand-800 transition-colors"
          >
            +{mins}m
          </button>
        ))}
      </div>
    </div>
  );
}
