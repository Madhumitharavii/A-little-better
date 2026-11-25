import { useMemo, useState, type ReactNode } from 'react';
import type { MovieItem } from '@/db/schema';
import { useLifeItemsOfType } from '@/features/life/useLifeItems';
import { useSavedLines } from '@/features/ai/savedLines';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { comfortFilms } from './badDay';

function Poster({ movie }: { movie: MovieItem }) {
  const own = useLifeImageUrl(movie.posterImageId);
  const src = own ?? movie.posterUrl;
  return (
    <div className="w-20 h-[120px] rounded-xl overflow-hidden bg-sand-100 flex items-center justify-center shrink-0 shadow-sm">
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <span className="text-3xl">🎬</span>}
    </div>
  );
}

interface Props {
  /** The meals row (same as in Care for Me). */
  meals: ReactNode;
  /** This Evening. */
  evening: ReactNode;
  onEnd: () => void;
}

/** Today, on a hard day: just the basics, a line you loved, and a comfort film. */
export default function BadDayView({ meals, evening, onEnd }: Props) {
  const movies = useLifeItemsOfType('movie') as MovieItem[];
  const comfort = useMemo(() => comfortFilms(movies), [movies]);
  const [lines] = useSavedLines();
  const [lineAt, setLineAt] = useState(() => Math.random());
  const [filmAt, setFilmAt] = useState(() => Math.random());
  const line = lines.length ? lines[Math.floor(lineAt * lines.length)] : undefined;
  const film = comfort.length ? comfort[Math.floor(filmAt * comfort.length)] : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-4xl mx-auto">
      <section className="md:col-span-2 bg-gradient-to-br from-slate-100 to-sage-100/60 p-6 sm:p-8 rounded-3xl border border-slate-500/20 space-y-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-800/60">☁️ A hard day</p>
        <h2 className="serif text-2xl sm:text-3xl text-sand-900">That’s allowed.</h2>
        <p className="text-sm text-sand-800/80 leading-relaxed">
          Nothing to get through today. Just eat something, sip some water, and be gentle with yourself. Everything else can wait — it’ll all be here
          tomorrow.
        </p>
      </section>

      <section className="bg-sage-100/50 p-5 sm:p-6 rounded-3xl border border-sage-300/70 space-y-3">
        <h3 className="serif text-lg font-semibold text-sand-900">Only the basics</h3>
        {meals}
        <ul className="text-xs text-sand-800/80 space-y-1.5 px-1">
          <li>💧 A glass of water, whenever you remember.</li>
          <li>🛌 Rest counts as doing something.</li>
          <li>🌬️ One slow breath out, longer than the breath in.</li>
        </ul>
      </section>

      <div className="space-y-6">
        {line && (
          <section className="bg-terracotta-100/50 p-5 sm:p-6 rounded-3xl border border-terracotta-400/20 space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-terracotta-600">♥ A line you loved</p>
            <p className="serif italic text-base text-sand-900 leading-relaxed">“{line.text}”</p>
            {lines.length > 1 && (
              <button
                onClick={() => setLineAt(Math.random())}
                className="text-[11px] text-sand-800/60 hover:text-sand-900 underline underline-offset-2"
              >
                Another one
              </button>
            )}
          </section>
        )}

        {film && (
          <section className="bg-white p-5 sm:p-6 rounded-3xl border border-sand-200 space-y-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-sand-800/60">🍿 A comfort film</p>
            <div className="flex gap-4 items-center">
              <Poster movie={film} />
              <div className="min-w-0 space-y-2">
                <p className="serif text-lg font-semibold text-sand-900 leading-snug">
                  {film.title} {film.year && <span className="text-sm font-normal text-sand-800/60">({film.year})</span>}
                </p>
                <p className="text-[11px] text-sand-800/60">One you loved before. No pressure to watch it.</p>
                <div className="flex gap-3 text-[11px] font-semibold">
                  {film.letterboxdUri && (
                    <a href={film.letterboxdUri} target="_blank" rel="noreferrer" className="text-slate-800 underline underline-offset-2">
                      Letterboxd
                    </a>
                  )}
                  {comfort.length > 1 && (
                    <button onClick={() => setFilmAt(Math.random())} className="text-sand-800/60 hover:text-sand-900 underline underline-offset-2">
                      Another
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="md:col-span-2">{evening}</div>

      <div className="md:col-span-2 text-center">
        <button onClick={onEnd} className="text-xs text-sand-800/60 hover:text-sand-900 underline underline-offset-2">
          Feeling a bit better? Show everything
        </button>
      </div>
    </div>
  );
}
