import { formatDisplayDate } from '@/shared/utils/formatDate';
import { useAiEnabled, useAiState } from './aiEngine';

/** "Your week in three sentences" — an extractive summary (TextRank + MMR) of the last 7 days of writing. */
export default function WeekSummaryCard() {
  const enabled = useAiEnabled();
  const ai = useAiState();
  if (!enabled || !ai.ready) return null;

  return (
    <section className="bg-white p-5 rounded-3xl border border-sand-200 shadow-sm space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-sand-800/60">✍️ Your week in three sentences</p>
        <p className="text-[11px] text-sand-800/50">Picked from your own writing — the lines that best capture the last 7 days. Worked out on this device.</p>
      </div>
      {ai.weekSummary ? (
        <>
          <ol className="space-y-2">
            {ai.weekSummary.sentences.map((s) => (
              <li key={s.text} className="pl-3 border-l-2 border-terracotta-400/50">
                <p className="serif italic text-sand-900 text-[15px] leading-snug">"{s.text}"</p>
                <p className="text-[10px] text-sand-800/50 mt-0.5">{formatDisplayDate(s.date)}</p>
              </li>
            ))}
          </ol>
          <p className="text-[10px] text-sand-800/40">From {ai.weekSummary.fromCount} sentences you wrote this week.</p>
        </>
      ) : (
        <p className="text-[11px] text-sand-800/60">Write a little more this week — a few journal entries or reflections — and your week will be summed up here.</p>
      )}
    </section>
  );
}
