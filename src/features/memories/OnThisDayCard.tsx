import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useLifeRows } from '@/db/lifeStore';
import { useSavedLines } from '@/features/ai/savedLines';
import { onThisDay } from './onThisDay';

/** What you were doing on this date in earlier years. Hidden when there's nothing. */
export default function OnThisDayCard({ today }: { today: string }) {
  const md = today.slice(5);
  const life = useLifeRows();
  const [savedLines] = useSavedLines();
  const journal = useLiveQuery(() => db.journalEntries.filter((j) => j.date?.slice(5, 10) === md).toArray(), [md]);
  const reflections = useLiveQuery(() => db.dailyReflections.filter((r) => r.date?.slice(5, 10) === md).toArray(), [md]);

  const years = useMemo(
    () => (life && journal && reflections ? onThisDay({ life, journal, reflections, savedLines }, today) : []),
    [life, journal, reflections, savedLines, today],
  );
  if (!years.length) return null;

  return (
    <section className="bg-white p-5 sm:p-6 rounded-3xl border border-sand-200 shadow-sm space-y-4">
      <div>
        <h3 className="serif text-lg font-semibold text-sand-900">🕰️ On this day</h3>
        <p className="text-xs text-sand-800/60">What you were up to on this date before.</p>
      </div>
      <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
        {years.map((y) => (
          <div key={y.year} className="space-y-1.5">
            <p className="text-[11px] font-semibold text-terracotta-600">
              {y.year} · {y.ago === 1 ? 'a year ago' : `${y.ago} years ago`}
            </p>
            <ul className="space-y-1">
              {y.items.map((m) => (
                <li key={m.key} className="flex gap-2 text-xs text-sand-900 leading-snug">
                  <span className="shrink-0">{m.icon}</span>
                  <span className="break-words min-w-0">{m.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
