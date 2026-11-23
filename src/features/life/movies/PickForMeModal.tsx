import { useEffect, useMemo, useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { MovieItem } from '@/db/schema';
import { updateLifeItem } from '@/db/repositories/lifeRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { moviePoster } from '@/lib/coverFill';
import { pickFrom, pickPool, todaysPick } from './moviePick';

interface Props {
  movies: MovieItem[];
  onClose: () => void;
  onOpenMovie: (m: MovieItem) => void;
}

const SPIN_MS = 2800;

function Poster({ movie, big }: { movie: MovieItem; big?: boolean }) {
  const own = useLifeImageUrl(movie.posterImageId);
  const src = own ?? movie.posterUrl;
  return (
    <div className={`${big ? 'w-40 h-60' : 'w-28 h-[168px]'} mx-auto rounded-2xl overflow-hidden bg-sand-100 flex items-center justify-center shadow-md`}>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <span className="text-4xl">🎬</span>}
    </div>
  );
}

/**
 * "Pick for me": a random film from the watchlist, and a promise.
 * The film is logged as watched today the moment it's chosen (before the
 * spin even finishes), so there's no closing the window to try again.
 * One pick a day.
 */
export default function PickForMeModal({ movies, onClose, onOpenMovie }: Props) {
  const today = getLocalDateKey();
  const pool = useMemo(() => pickPool(movies), [movies]);
  const already = useMemo(() => todaysPick(movies, today), [movies, today]);
  const [chosen, setChosen] = useState<MovieItem | null>(null);
  const [flash, setFlash] = useState<MovieItem | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const result = chosen ?? (spinning ? null : already ?? null);
  const live = result ? movies.find((m) => m.id === result.id) ?? result : null; // shows the poster once it arrives

  async function spin() {
    const film = pickFrom(pool);
    if (!film) return;
    setSpinning(true);
    // Logged right away — the promise is made when you press the button.
    await updateLifeItem(film.id, { type: 'movie', status: 'watched', dateWatched: today, pickedOn: today });
    if (!film.posterUrl && !film.posterImageId && film.letterboxdUri) {
      moviePoster(film)
        .then((p) => (typeof p === 'string' && p !== 'retry' ? updateLifeItem(film.id, { type: 'movie', posterUrl: p }) : undefined))
        .catch(() => undefined);
    }
    // The show: titles flick past, slowing down, then land on the film.
    let t = 0;
    let step = 60;
    while (t < SPIN_MS) {
      timers.current.push(window.setTimeout(() => setFlash(pickFrom(pool) ?? null), t));
      t += step;
      step = Math.round(step * 1.12);
    }
    timers.current.push(
      window.setTimeout(() => {
        setChosen(film);
        setSpinning(false);
      }, t),
    );
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-md">
      <ModalHeader icon="🎲" title="Pick for me" onClose={onClose} />

      {spinning ? (
        <div className="text-center space-y-4 py-2" aria-live="polite">
          {flash && <Poster movie={flash} />}
          <p className="serif text-lg font-semibold text-sand-900 truncate">{flash?.title ?? '…'}</p>
          <p className="text-xs text-sand-800/60">Spinning…</p>
        </div>
      ) : live ? (
        <div className="text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">{chosen ? 'Tonight you’re watching' : 'Today’s pick'}</p>
          <Poster movie={live} big />
          <div>
            <p className="serif text-xl font-semibold text-sand-900">{live.title}</p>
            {live.year && <p className="text-xs text-sand-800/60">{live.year}</p>}
          </div>
          <p className="text-xs text-sand-800/70 bg-sand-50 rounded-2xl p-3">
            ✓ Logged as watched today and taken off your watchlist. A promise is a promise.
            {live.letterboxdUri && ' Log it on Letterboxd too when you’ve seen it — the app will match the two up.'}
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {live.letterboxdUri && (
              <a
                href={live.letterboxdUri}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl"
              >
                Open on Letterboxd
              </a>
            )}
            <button
              onClick={() => onOpenMovie(live)}
              className="px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl"
            >
              Rate or review it
            </button>
          </div>
          {!chosen && <p className="text-[11px] text-sand-800/50">One pick a day — come back tomorrow for another.</p>}
        </div>
      ) : pool.length === 0 ? (
        <p className="text-sm text-sand-800/70 text-center py-4">Your watchlist is empty — nothing to pick from.</p>
      ) : (
        <div className="space-y-5 text-center">
          <span className="text-5xl block">🎲</span>
          <p className="text-sm text-sand-900">
            One film from your watchlist of <b>{pool.length.toLocaleString()}</b>, chosen at random.
          </p>
          <ul className="text-xs text-sand-800/70 text-left bg-sand-50 rounded-2xl p-4 space-y-1.5">
            <li>• Whatever comes up, you watch it.</li>
            <li>• It’s logged as watched today the moment you spin.</li>
            <li>• No re-rolls — one pick a day.</li>
          </ul>
          <button
            onClick={spin}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 text-white text-sm font-semibold rounded-2xl shadow-sm"
          >
            I promise — spin
          </button>
        </div>
      )}
    </Modal>
  );
}
