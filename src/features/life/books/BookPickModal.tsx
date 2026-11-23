import { useEffect, useMemo, useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { BookItem } from '@/db/schema';
import { updateLifeItem } from '@/db/repositories/lifeRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { bookInfo } from '@/lib/coverFill';
import { pickFrom } from '../movies/moviePick';
import { bookPool, genreOptions, inGenre, todaysBookPick } from './bookPick';

interface Props {
  books: BookItem[];
  onClose: () => void;
  onOpenBook: (b: BookItem) => void;
}

const SPIN_MS = 2800;

function Cover({ book, big }: { book: BookItem; big?: boolean }) {
  const own = useLifeImageUrl(book.coverImageId);
  const src = own ?? book.coverUrl;
  return (
    <div className={`${big ? 'w-40 h-60' : 'w-28 h-[168px]'} mx-auto rounded-2xl overflow-hidden bg-sand-100 flex items-center justify-center shadow-md`}>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <span className="text-4xl">📖</span>}
    </div>
  );
}

/**
 * "Pick for me" for books: a random book from want-to-read — any book, or
 * from a genre you choose. The moment you spin, it's marked as reading
 * (started today). One pick a day, no re-rolls.
 */
export default function BookPickModal({ books, onClose, onOpenBook }: Props) {
  const today = getLocalDateKey();
  const pool = useMemo(() => bookPool(books), [books]);
  const options = useMemo(() => genreOptions(pool), [pool]);
  const unsorted = useMemo(() => pool.filter((b) => b.genres === undefined).length, [pool]);
  const already = useMemo(() => todaysBookPick(books, today), [books, today]);
  const [mode, setMode] = useState<'any' | 'genre'>('any');
  const [genre, setGenre] = useState<string | null>(null);
  const [chosen, setChosen] = useState<BookItem | null>(null);
  const [flash, setFlash] = useState<BookItem | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const from = mode === 'genre' ? inGenre(pool, genre) : pool;
  const result = chosen ?? (spinning ? null : already ?? null);
  const live = result ? books.find((b) => b.id === result.id) ?? result : null;

  async function spin() {
    const book = pickFrom(from);
    if (!book) return;
    setSpinning(true);
    // Made the moment you press the button — closing the window doesn't undo it.
    await updateLifeItem(book.id, { type: 'book', status: 'inProgress', dateStarted: today, pickedOn: today });
    if (!book.coverUrl && !book.coverImageId) {
      bookInfo(book)
        .then((info) => (info !== 'retry' && info.cover ? updateLifeItem(book.id, { type: 'book', coverUrl: info.cover, genres: book.genres ?? info.genres }) : undefined))
        .catch(() => undefined);
    }
    let t = 0;
    let step = 60;
    while (t < SPIN_MS) {
      timers.current.push(window.setTimeout(() => setFlash(pickFrom(from) ?? null), t));
      t += step;
      step = Math.round(step * 1.12);
    }
    timers.current.push(
      window.setTimeout(() => {
        setChosen(book);
        setSpinning(false);
      }, t),
    );
  }

  const tabClass = (on: boolean) =>
    `flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${on ? 'bg-sage-500 text-white' : 'bg-sand-100 text-sand-800'}`;

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-md">
      <ModalHeader icon="🎲" title="Pick for me" onClose={onClose} />

      {spinning ? (
        <div className="text-center space-y-4 py-2" aria-live="polite">
          {flash && <Cover book={flash} />}
          <p className="serif text-lg font-semibold text-sand-900 truncate">{flash?.title ?? '…'}</p>
          <p className="text-xs text-sand-800/60">Spinning…</p>
        </div>
      ) : live ? (
        <div className="text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-700">{chosen ? 'You’re reading next' : 'Today’s pick'}</p>
          <Cover book={live} big />
          <div>
            <p className="serif text-xl font-semibold text-sand-900">{live.title}</p>
            {live.author && <p className="text-xs text-sand-800/60">{live.author}</p>}
          </div>
          <p className="text-xs text-sand-800/70 bg-sand-50 rounded-2xl p-3">
            ✓ Moved from want-to-read to reading, started today. A promise is a promise.
          </p>
          <button
            onClick={() => onOpenBook(live)}
            className="px-4 py-2 bg-sage-500 hover:bg-sage-700 text-white text-xs font-semibold rounded-2xl"
          >
            Open the book
          </button>
          {!chosen && <p className="text-[11px] text-sand-800/50">One pick a day — come back tomorrow for another.</p>}
        </div>
      ) : pool.length === 0 ? (
        <p className="text-sm text-sand-800/70 text-center py-4">Nothing on your want-to-read shelf to pick from.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button className={tabClass(mode === 'any')} onClick={() => setMode('any')}>
              Any book
            </button>
            <button className={tabClass(mode === 'genre')} onClick={() => setMode('genre')}>
              Choose a genre
            </button>
          </div>

          {mode === 'genre' && (
            <div className="space-y-2">
              {options.length === 0 ? (
                <p className="text-xs text-sand-800/60">Genres are still being worked out — try again in a little while.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                  {options.map((o) => (
                    <button
                      key={o.name}
                      onClick={() => setGenre(genre === o.name ? null : o.name)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                        genre === o.name ? 'bg-sage-500 text-white border-sage-500' : 'bg-white text-sand-800 border-sand-200'
                      }`}
                    >
                      {o.name} <span className="opacity-60">{o.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {unsorted > 0 && (
                <p className="text-[11px] text-sand-800/50">
                  {unsorted.toLocaleString()} book{unsorted === 1 ? '' : 's'} not sorted into genres yet — that happens in the background while the app is open.
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-sand-900 text-center">
            {mode === 'genre' && !genre ? (
              'Choose a genre above.'
            ) : (
              <>
                One book from <b>{from.length.toLocaleString()}</b>
                {mode === 'genre' && genre ? ` in ${genre}` : ' on your want-to-read shelf'}, chosen at random.
              </>
            )}
          </p>
          <ul className="text-xs text-sand-800/70 bg-sand-50 rounded-2xl p-4 space-y-1.5">
            <li>• Whatever comes up, you read it.</li>
            <li>• It’s marked as reading, started today, the moment you spin.</li>
            <li>• No re-rolls — one pick a day.</li>
          </ul>
          <button
            onClick={spin}
            disabled={from.length === 0 || (mode === 'genre' && !genre)}
            className="w-full py-3 bg-sage-500 hover:bg-sage-700 disabled:opacity-40 text-white text-sm font-semibold rounded-2xl shadow-sm"
          >
            I promise — spin
          </button>
        </div>
      )}
    </Modal>
  );
}
