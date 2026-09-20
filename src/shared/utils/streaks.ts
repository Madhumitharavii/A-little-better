import type { CareEntry } from '@/db/schema';
import { addDays, getLocalDateKey } from '@/db/dateUtils';

/**
 * Streaks are always derived from careEntries at read time — never
 * stored as a counter — so there is nothing to get "out of sync" and
 * nothing that can be silently lost.
 *
 * Rules (explicit, do not change without re-reading the product spec):
 *  - A day with at least one 'done' entry extends the showing-up streak.
 *  - A day with only 'skipped' entries is recorded, but does NOT
 *    extend the streak, and does NOT reset it to a visible "broken"
 *    state either — it's simply not counted as showing up.
 *  - A day with no entries at all is a gap. Gaps are never framed as
 *    failure anywhere in the UI.
 */

export interface StreakMetrics {
  showingUpStreak: number;
  readingStreak: number;
  isReturningAfterGap: boolean;
}

function hasDoneEntry(entriesByDate: Map<string, CareEntry[]>, date: string): boolean {
  const entries = entriesByDate.get(date);
  return !!entries?.some((e) => e.status === 'done');
}

function hasAnyEntry(entriesByDate: Map<string, CareEntry[]>, date: string): boolean {
  return !!entriesByDate.get(date)?.length;
}

function hasDoneReading(entriesByDate: Map<string, CareEntry[]>, date: string): boolean {
  const entries = entriesByDate.get(date);
  return !!entries?.some((e) => e.itemKey === 'reading' && e.status === 'done');
}

function countStreak(
  today: string,
  isDayCounted: (date: string) => boolean,
): number {
  const yesterday = addDays(today, -1);
  const countedToday = isDayCounted(today);
  const countedYesterday = isDayCounted(yesterday);

  // If nothing logged yet today, start counting from yesterday so the
  // streak number doesn't drop to zero the instant the clock rolls
  // over — it only breaks once a full day genuinely passes with no
  // done items.
  let cursor = countedToday || !countedYesterday ? today : yesterday;
  let streak = 0;

  // Cap the walk so a very old, very long-lived database can't cause
  // an unbounded loop.
  for (let i = 0; i < 3650; i++) {
    if (isDayCounted(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

export function calculateStreaks(allEntries: CareEntry[], today: string = getLocalDateKey()): StreakMetrics {
  const entriesByDate = new Map<string, CareEntry[]>();
  for (const entry of allEntries) {
    const bucket = entriesByDate.get(entry.date) ?? [];
    bucket.push(entry);
    entriesByDate.set(entry.date, bucket);
  }

  const showingUpStreak = countStreak(today, (d) => hasDoneEntry(entriesByDate, d));
  const readingStreak = countStreak(today, (d) => hasDoneReading(entriesByDate, d));

  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);
  const activeRecently = hasAnyEntry(entriesByDate, yesterday) || hasAnyEntry(entriesByDate, twoDaysAgo);
  const activeToday = hasAnyEntry(entriesByDate, today);
  const hasAnyHistoryAtAll = allEntries.length > 0;

  return {
    showingUpStreak,
    readingStreak,
    isReturningAfterGap: hasAnyHistoryAtAll && !activeToday && !activeRecently,
  };
}
