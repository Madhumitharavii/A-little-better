import type { CareEntry } from '@/db/schema';
import { addDays } from '@/db/dateUtils';

export type MealKey = 'breakfast' | 'lunch' | 'dinner';

export const MEALS: { key: MealKey; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: '🍳' },
  { key: 'lunch', label: 'Lunch', icon: '🥗' },
  { key: 'dinner', label: 'Dinner', icon: '🍲' },
];

export type MealState = 'ate' | 'skipped' | 'none';

export function mealState(entry: CareEntry | undefined): MealState {
  if (!entry) return 'none';
  return entry.status === 'done' ? 'ate' : 'skipped';
}

/** Tapping a meal goes: not marked → ate → skipped → not marked. */
export function nextMealState(s: MealState): MealState {
  return s === 'none' ? 'ate' : s === 'ate' ? 'skipped' : 'none';
}

/** How many days back the breakfast pattern looks. */
export const LOOK_BACK_DAYS = 7;

/**
 * Breakfast over the days before `today`. A day counts only if some meal
 * was marked; breakfast counts as skipped if it was marked skipped — or
 * left unmarked on a day lunch or dinner was ticked (you logged meals
 * that day, just not breakfast).
 */
export function breakfastHistory(entries: CareEntry[], today: string): { logged: number; skipped: number; skippedInARow: number } {
  const byDay = new Map<string, Map<string, CareEntry>>();
  for (const e of entries) {
    if (e.itemKey !== 'breakfast' && e.itemKey !== 'lunch' && e.itemKey !== 'dinner') continue;
    if (!byDay.has(e.date)) byDay.set(e.date, new Map());
    byDay.get(e.date)!.set(e.itemKey, e);
  }
  let logged = 0;
  let skipped = 0;
  let skippedInARow = 0;
  let streakOpen = true;
  for (let i = 1; i <= LOOK_BACK_DAYS; i++) {
    const day = byDay.get(addDays(today, -i));
    if (!day) continue; // nothing logged that day — don't guess
    logged++;
    const b = day.get('breakfast');
    const missed = b ? b.status === 'skipped' : day.get('lunch')?.status === 'done' || day.get('dinner')?.status === 'done';
    if (missed) {
      skipped++;
      if (streakOpen) skippedInARow++;
    } else {
      streakOpen = false;
    }
  }
  return { logged, skipped, skippedInARow };
}

/**
 * The "health before everything" nudge, or null when breakfast has been
 * going fine. Shows once breakfast was missed on at least 2 of the logged
 * days this past week, or the last 2 logged days in a row.
 */
export function breakfastNudge(entries: CareEntry[], today: string): string | null {
  const { skipped, skippedInARow } = breakfastHistory(entries, today);
  if (skipped < 2 && skippedInARow < 2) return null;
  const lead =
    skippedInARow >= 2
      ? `You’ve skipped breakfast ${skippedInARow} days in a row.`
      : `You’ve skipped breakfast ${skipped} times this week.`;
  return `${lead} Tomorrow, try waking up 30 minutes earlier so there’s time to eat. Health before everything 💛`;
}
