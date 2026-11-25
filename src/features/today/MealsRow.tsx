import type { CareEntry } from '@/db/schema';
import { MEALS, mealState, nextMealState, type MealKey, type MealState } from './meals';

interface Props {
  findEntry: (key: MealKey) => CareEntry | undefined;
  onSet: (key: MealKey, state: MealState) => void;
  /** The breakfast nudge, when breakfast has been skipped a lot lately. */
  nudge: string | null;
}

/** Breakfast · lunch · dinner — tap once for eaten, again for skipped, again to clear. */
export default function MealsRow({ findEntry, onSet, nudge }: Props) {
  return (
    <div className="p-3 rounded-2xl border border-sand-200 bg-sand-50/50 space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-sand-900 flex items-center gap-2">
          <span className="text-lg">🍽️</span> Meals
        </p>
        <p className="text-[10px] text-sand-800/50">Tap: ate · again: skipped</p>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MEALS.map((m) => {
          const s = mealState(findEntry(m.key));
          return (
            <button
              key={m.key}
              onClick={() => onSet(m.key, nextMealState(s))}
              aria-label={`${m.label}: ${s === 'ate' ? 'eaten' : s === 'skipped' ? 'skipped' : 'not marked'}`}
              className={`py-2 px-1 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                s === 'ate'
                  ? 'bg-sage-500 border-sage-500 text-white'
                  : s === 'skipped'
                    ? 'bg-terracotta-100 border-terracotta-400/40 text-terracotta-600'
                    : 'bg-white border-sand-200 text-sand-800 hover:border-sand-300'
              }`}
            >
              <span className="text-base leading-none">{m.icon}</span>
              <span>{m.label}</span>
              <span className="text-[10px] font-medium opacity-80">{s === 'ate' ? '✓ ate' : s === 'skipped' ? 'skipped' : ' '}</span>
            </button>
          );
        })}
      </div>
      {nudge && <p className="text-[11px] text-terracotta-600 bg-terracotta-100/60 rounded-xl px-3 py-2 leading-relaxed">{nudge}</p>}
    </div>
  );
}
