import { useState } from 'react';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { useAiEnabled, useAiState } from './aiEngine';
import type { Emotion } from './ml';

/** Colour and label per emotion (palette classes so they follow light/dark mode). */
export const EMOTION_STYLE: Record<Emotion, { label: string; emoji: string; bar: string; chip: string }> = {
  joy: { label: 'Joy', emoji: '☀️', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  calm: { label: 'Calm', emoji: '🌿', bar: 'bg-sage-500', chip: 'bg-sage-100 text-sage-700' },
  gratitude: { label: 'Gratitude', emoji: '💛', bar: 'bg-sage-300', chip: 'bg-sage-100 text-sage-700' },
  sadness: { label: 'Sadness', emoji: '🌧️', bar: 'bg-slate-500', chip: 'bg-slate-100 text-slate-800' },
  anxiety: { label: 'Stress', emoji: '🌊', bar: 'bg-terracotta-400', chip: 'bg-terracotta-100 text-terracotta-600' },
  anger: { label: 'Anger', emoji: '🔥', bar: 'bg-terracotta-600', chip: 'bg-terracotta-100 text-terracotta-600' },
  loneliness: { label: 'Loneliness', emoji: '🫧', bar: 'bg-slate-800', chip: 'bg-slate-100 text-slate-800' },
  tiredness: { label: 'Tiredness', emoji: '😴', bar: 'bg-sand-300', chip: 'bg-sand-100 text-sand-800' },
};
const ORDER: Emotion[] = ['joy', 'calm', 'gratitude', 'tiredness', 'anxiety', 'sadness', 'loneliness', 'anger'];

const weekLabel = (monday: string) => new Date(`${monday}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

/** How your writing has felt, week by week — the on-device emotion model applied over time. */
export default function EmotionTrendCard() {
  const enabled = useAiEnabled();
  const ai = useAiState();
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  if (!enabled || !ai.ready) return null;

  const weeks = ai.emotionWeeks;
  const anyWriting = weeks.some((w) => w.entries.length > 0);
  const maxEntries = Math.max(1, ...weeks.map((w) => w.entries.length));
  const used = ORDER.filter((e) => weeks.some((w) => w.counts[e]));
  const selected = weeks.find((w) => w.weekStart === openWeek);

  return (
    <div className="p-3 bg-white rounded-2xl border border-sand-200 space-y-3">
      <div>
        <p className="font-semibold text-sand-900 text-xs">💭 How my writing has felt</p>
        <p className="text-[11px] text-sand-800/60">The feeling in each journal entry and reflection, week by week — read on this device. A record, not a score.</p>
      </div>
      {!anyWriting ? (
        <p className="text-[11px] text-sand-800/60">As you write, the feelings in your entries will show up here week by week.</p>
      ) : (
        <>
          <div className="flex items-end gap-1.5 h-24" role="list" aria-label="Feelings per week">
            {weeks.map((w) => {
              const total = w.entries.length;
              const label = `Week of ${weekLabel(w.weekStart)}: ${total ? ORDER.filter((e) => w.counts[e]).map((e) => `${EMOTION_STYLE[e].label} ${w.counts[e]}`).join(', ') || 'neutral' : 'no entries'}`;
              return (
                <button
                  key={w.weekStart}
                  role="listitem"
                  onClick={() => setOpenWeek(openWeek === w.weekStart ? null : w.weekStart)}
                  aria-label={label}
                  aria-pressed={openWeek === w.weekStart}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-lg ${openWeek === w.weekStart ? 'bg-sand-100' : ''}`}
                >
                  <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: `${Math.max(4, (total / maxEntries) * 72)}px` }}>
                    {total === 0 ? (
                      <div className="w-full h-full bg-sand-100" />
                    ) : (
                      [...ORDER.filter((e) => w.counts[e]).map((e) => ({ e, n: w.counts[e]! })), ...(total - Object.values(w.counts).reduce((a, b) => a + (b ?? 0), 0) > 0 ? [{ e: null, n: total - Object.values(w.counts).reduce((a, b) => a + (b ?? 0), 0) }] : [])].map(({ e, n }) => (
                        <div key={e ?? 'neutral'} className={e ? EMOTION_STYLE[e].bar : 'bg-sand-200'} style={{ height: `${(n / total) * 100}%` }} />
                      ))
                    )}
                  </div>
                  <span className="text-[8px] text-sand-800/50">{weekLabel(w.weekStart)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {used.map((e) => (
              <span key={e} className={`text-[10px] px-2 py-0.5 rounded-full ${EMOTION_STYLE[e].chip}`}>
                {EMOTION_STYLE[e].emoji} {EMOTION_STYLE[e].label}
              </span>
            ))}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sand-100 text-sand-800/70">Neutral</span>
          </div>
          {selected && (
            <ul className="space-y-1 border-t border-sand-100 pt-2">
              {selected.entries.length === 0 ? (
                <li className="text-[11px] text-sand-800/60">No entries that week.</li>
              ) : (
                selected.entries.map((en) => (
                  <li key={en.key} className="text-[11px] text-sand-800/80 flex items-center justify-between gap-2">
                    <span className="truncate">
                      <span className="text-sand-800/50">{formatDisplayDate(en.date)} · </span>
                      {en.title}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${en.emotion ? EMOTION_STYLE[en.emotion].chip : 'bg-sand-100 text-sand-800/70'}`}>
                      {en.emotion ? `${EMOTION_STYLE[en.emotion].emoji} ${EMOTION_STYLE[en.emotion].label}` : 'Neutral'}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
