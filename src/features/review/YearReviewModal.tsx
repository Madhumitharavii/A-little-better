import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { db } from '@/db/db';
import { useLifeRows } from '@/db/lifeStore';
import { useSavedLines } from '@/features/ai/savedLines';
import { reviewYears, yearReview, type Titled } from './yearReview';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const stars = (r?: number) => (r == null ? '' : `${'★'.repeat(Math.floor(r))}${r % 1 ? '½' : ''}`);

function Block({ icon, title, children, tone = 'bg-sand-50 border-sand-200' }: { icon: string; title: string; children: ReactNode; tone?: string }) {
  return (
    <section className={`rounded-3xl border p-5 space-y-3 ${tone}`}>
      <h4 className="text-[11px] uppercase tracking-wider font-semibold text-sand-800/70">
        {icon} {title}
      </h4>
      {children}
    </section>
  );
}

function Big({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <p className="serif text-3xl sm:text-4xl font-semibold text-sand-900 leading-none">{typeof n === 'number' ? n.toLocaleString() : n}</p>
      <p className="text-[11px] text-sand-800/60 mt-1">{label}</p>
    </div>
  );
}

function TopList({ items }: { items: Titled[] }) {
  if (!items.length) return null;
  return (
    <ol className="space-y-1">
      {items.map((t, i) => (
        <li key={t.id} className="flex items-baseline gap-2 text-xs text-sand-900">
          <span className="text-sand-800/40 w-3 shrink-0">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{t.title}</span>
            {t.sub && <span className="text-sand-800/60"> · {t.sub}</span>}
          </span>
          <span className="text-terracotta-600 shrink-0">{stars(t.rating)}</span>
        </li>
      ))}
    </ol>
  );
}

const hours = (mins: number) => (mins >= 120 ? `${Math.round(mins / 60)} hours` : `${mins} min`);

/** Your year, looked back on: films, books, words, wins, lines you loved, and how you looked after yourself. */
export default function YearReviewModal({ onClose, initialYear }: { onClose: () => void; initialYear?: number }) {
  const thisYear = new Date().getFullYear();
  const life = useLifeRows();
  const [savedLines] = useSavedLines();
  const journal = useLiveQuery(() => db.journalEntries.toArray(), []);
  const reflections = useLiveQuery(() => db.dailyReflections.toArray(), []);
  const care = useLiveQuery(() => db.careEntries.toArray(), []);
  const ready = life && journal && reflections && care;
  const input = useMemo(
    () => (ready ? { life: life!, journal: journal!, reflections: reflections!, care: care!, savedLines } : null),
    [ready, life, journal, reflections, care, savedLines],
  );
  const years = useMemo(() => (input ? reviewYears(input, thisYear) : [thisYear]), [input, thisYear]);
  const [year, setYear] = useState(initialYear ?? thisYear);
  const r = useMemo(() => (input ? yearReview(input, year) : null), [input, year]);

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-2xl">
      <ModalHeader icon="✨" title={`Your ${year}`} onClose={onClose} />
      {years.length > 1 && (
        <div className="flex gap-1.5 flex-wrap -mt-2">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-3 py-1 rounded-full text-xs border ${y === year ? 'bg-sage-500 text-white border-sage-500' : 'bg-white text-sand-800 border-sand-200'}`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {!r ? (
        <p className="text-sm text-sand-800/60 text-center py-8">Gathering your year…</p>
      ) : r.empty ? (
        <p className="text-sm text-sand-800/60 text-center py-8">Nothing logged for {year} yet.</p>
      ) : (
        <div className="space-y-4">
          <p className="serif text-lg text-sand-900 text-center italic">
            {year === thisYear ? 'Here’s your year so far — every bit of it counts.' : `A look back at ${year}.`}
          </p>

          {r.films.watches > 0 && (
            <Block icon="🎬" title="Films" tone="bg-slate-100/70 border-slate-500/20">
              <div className="grid grid-cols-3 gap-3">
                <Big n={r.films.films} label="films watched" />
                <Big n={r.films.rewatches} label="rewatches" />
                {r.films.busiestMonth && <Big n={MONTHS[r.films.busiestMonth.month]} label={`your biggest month (${r.films.busiestMonth.count})`} />}
              </div>
              {r.films.top.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-sand-900">Your favourites</p>
                  <TopList items={r.films.top} />
                </div>
              )}
              {r.films.first && r.films.last && r.films.first.id !== r.films.last.id && (
                <p className="text-[11px] text-sand-800/60">
                  Started the year with <b>{r.films.first.title}</b> and {year === thisYear ? 'most recently' : 'ended it with'} <b>{r.films.last.title}</b>.
                </p>
              )}
            </Block>
          )}

          {(r.books.finished > 0 || r.books.started > 0) && (
            <Block icon="📚" title="Books" tone="bg-sage-100/50 border-sage-300/70">
              <div className="grid grid-cols-3 gap-3">
                <Big n={r.books.finished} label="books finished" />
                <Big n={r.books.started} label="books started" />
                {r.seriesFinished > 0 && <Big n={r.seriesFinished} label="series finished" />}
              </div>
              {r.books.top.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-sand-900">Your favourites</p>
                  <TopList items={r.books.top} />
                </div>
              )}
            </Block>
          )}

          {r.promises.made > 0 && (
            <Block icon="🤝" title="Pick for me">
              <Big n={`${r.promises.kept} of ${r.promises.made}`} label="promises to yourself kept" />
            </Block>
          )}

          {r.experiences.length > 0 && (
            <Block icon="✨" title="Things you did">
              <ul className="space-y-1">
                {r.experiences.slice(0, 8).map((e) => (
                  <li key={e.id} className="text-xs text-sand-900">
                    • <b>{e.title}</b>
                    {e.sub && <span className="text-sand-800/60"> · {e.sub}</span>}
                  </li>
                ))}
              </ul>
              {r.experiences.length > 8 && <p className="text-[11px] text-sand-800/60">…and {r.experiences.length - 8} more.</p>}
            </Block>
          )}

          {(r.journal.entries > 0 || r.smallWins.count > 0) && (
            <Block icon="📝" title="Your words" tone="bg-terracotta-100/40 border-terracotta-400/20">
              <div className="grid grid-cols-3 gap-3">
                {r.journal.entries > 0 && <Big n={r.journal.entries} label="journal entries" />}
                {r.journal.words > 0 && <Big n={r.journal.words} label="words written" />}
                {r.smallWins.count > 0 && <Big n={r.smallWins.count} label="small wins noted" />}
              </div>
              {r.smallWins.some.length > 0 && (
                <ul className="space-y-1">
                  {r.smallWins.some.map((w) => (
                    <li key={w} className="text-xs text-sand-900">
                      🌱 {w}
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          )}

          {r.lines.length > 0 && (
            <Block icon="♥" title="Lines you loved" tone="bg-terracotta-100/40 border-terracotta-400/20">
              <ul className="space-y-2">
                {r.lines.slice(0, 6).map((l) => (
                  <li key={l.text} className="serif italic text-sm text-sand-900 leading-relaxed">
                    “{l.text}”
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {(r.care.bath || r.care.movement || r.care.fruit || r.care.breakfasts || r.care.readingMinutes || r.care.focusMinutes || r.studyMinutes) > 0 && (
            <Block icon="🛁" title="Looking after you" tone="bg-sage-100/50 border-sage-300/70">
              <div className="grid grid-cols-3 gap-3">
                {r.care.breakfasts > 0 && <Big n={r.care.breakfasts} label="days with breakfast" />}
                {r.care.movement > 0 && <Big n={r.care.movement} label="days you moved" />}
                {r.care.bath > 0 && <Big n={r.care.bath} label="warm refreshes" />}
                {r.care.fruit > 0 && <Big n={r.care.fruit} label="days with fruit" />}
                {r.care.readingMinutes > 0 && <Big n={hours(r.care.readingMinutes)} label="of reading" />}
                {r.care.focusMinutes > 0 && <Big n={hours(r.care.focusMinutes)} label="of focus" />}
                {r.studyMinutes > 0 && <Big n={hours(r.studyMinutes)} label="of study" />}
              </div>
            </Block>
          )}

          {(r.letters.written > 0 || r.letters.opened > 0) && (
            <Block icon="💌" title="Letters to future you">
              <div className="grid grid-cols-3 gap-3">
                {r.letters.written > 0 && <Big n={r.letters.written} label="written" />}
                {r.letters.opened > 0 && <Big n={r.letters.opened} label="opened" />}
              </div>
            </Block>
          )}
        </div>
      )}
    </Modal>
  );
}
