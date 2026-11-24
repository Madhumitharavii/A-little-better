import { useState } from 'react';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { useAiEnabled, useAiState } from './aiEngine';
import { sameLine, useSavedLines } from './savedLines';

function Heart({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={on ? 'Remove from lines you loved' : 'Save to lines you loved'}
      aria-pressed={on}
      title={on ? 'Saved — tap to remove' : 'Save this line'}
      className={`shrink-0 text-base leading-none p-1 -m-1 transition-transform active:scale-125 ${on ? 'text-terracotta-400' : 'text-sand-800/30 hover:text-terracotta-400'}`}
    >
      {on ? '♥' : '♡'}
    </button>
  );
}

/** "Your week in three sentences" — an extractive summary (TextRank + MMR) of the last 7 days of writing — plus the lines you ♥'d. */
export default function WeekSummaryCard() {
  const enabled = useAiEnabled();
  const ai = useAiState();
  const [saved, toggle] = useSavedLines();
  const [showSaved, setShowSaved] = useState(false);
  const summaryOn = enabled && ai.ready;
  if (!summaryOn && !saved.length) return null;

  return (
    <section className="bg-white p-5 rounded-3xl border border-sand-200 shadow-sm space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-sand-800/60">✍️ Your week in three sentences</p>
        <p className="text-[11px] text-sand-800/50">Picked from your own writing — the lines that best capture the last 7 days. Worked out on this device.</p>
      </div>
      {!summaryOn ? null : ai.weekSummary ? (
        <>
          <ol className="space-y-2">
            {ai.weekSummary.sentences.map((s) => (
              <li key={s.text} className="pl-3 border-l-2 border-terracotta-400/50 flex gap-3 items-start">
                <div className="min-w-0 flex-1">
                  <p className="serif italic text-sand-900 text-[15px] leading-snug">"{s.text}"</p>
                  <p className="text-[10px] text-sand-800/50 mt-0.5">{formatDisplayDate(s.date)}</p>
                </div>
                <Heart on={saved.some((l) => sameLine(l, s))} onClick={() => toggle(s)} />
              </li>
            ))}
          </ol>
          <p className="text-[10px] text-sand-800/40">From {ai.weekSummary.fromCount} sentences you wrote this week. Tap ♡ to keep a line.</p>
        </>
      ) : (
        <p className="text-[11px] text-sand-800/60">Write a little more this week — a few journal entries or reflections — and your week will be summed up here.</p>
      )}

      {saved.length > 0 && (
        <div className="pt-2 border-t border-sand-100">
          <button onClick={() => setShowSaved((v) => !v)} className="text-xs font-semibold text-terracotta-600 hover:text-terracotta-400">
            ♥ Lines you loved ({saved.length}) {showSaved ? '▴' : '▾'}
          </button>
          {showSaved && (
            <ul className="space-y-2 mt-2">
              {saved.map((l) => (
                <li key={l.text} className="pl-3 border-l-2 border-terracotta-400 flex gap-3 items-start">
                  <div className="min-w-0 flex-1">
                    <p className="serif italic text-sand-900 text-[14px] leading-snug">"{l.text}"</p>
                    <p className="text-[10px] text-sand-800/50 mt-0.5">{formatDisplayDate(l.date)}</p>
                  </div>
                  <Heart on onClick={() => toggle(l)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
