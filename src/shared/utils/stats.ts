import type { CareEntry, CareItemKey } from '@/db/schema';
import { calculateStreaks } from './streaks';

/**
 * Gentle, descriptive statistics only. Deliberately excluded, per
 * product spec: scores, percentages, grades, "adherence" rates, or
 * anything that ranks or judges a day. Every stat here reads like a
 * fact about a life, not a performance review.
 */

export interface GentleStats {
  daysReadThisMonth: number;
  roomResetsCompleted: number;
  longestReadingStreak: number;
  currentShowingUpStreak: number;
  totalDaysShowedUp: number;
  focusMinutesThisMonth: number;
}

function countDoneDaysForItem(entries: CareEntry[], itemKey: CareItemKey, withinMonthKey?: string): number {
  const dates = new Set<string>();
  for (const e of entries) {
    if (e.itemKey !== itemKey || e.status !== 'done') continue;
    if (withinMonthKey && !e.date.startsWith(withinMonthKey)) continue;
    dates.add(e.date);
  }
  return dates.size;
}

function longestStreakFor(entries: CareEntry[], itemKey: CareItemKey): number {
  const doneDates = Array.from(
    new Set(entries.filter((e) => e.itemKey === itemKey && e.status === 'done').map((e) => e.date)),
  ).sort();

  let longest = 0;
  let current = 0;
  let prevDate: string | null = null;

  for (const date of doneDates) {
    if (prevDate) {
      const prev = new Date(prevDate);
      const expectedNext = new Date(prev);
      expectedNext.setDate(prev.getDate() + 1);
      const expectedKey = `${expectedNext.getFullYear()}-${String(expectedNext.getMonth() + 1).padStart(2, '0')}-${String(expectedNext.getDate()).padStart(2, '0')}`;
      current = date === expectedKey ? current + 1 : 1;
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    prevDate = date;
  }
  return longest;
}

export function computeGentleStats(allCareEntries: CareEntry[], todayKey: string): GentleStats {
  const monthKey = todayKey.slice(0, 7); // "YYYY-MM"
  const streaks = calculateStreaks(allCareEntries, todayKey);

  const totalDaysShowedUp = new Set(
    allCareEntries.filter((e) => e.status === 'done').map((e) => e.date),
  ).size;

  const focusMinutesThisMonth = allCareEntries
    .filter((e) => e.itemKey === 'focus' && e.date.startsWith(monthKey))
    .reduce((sum, e) => sum + (e.valueMinutes ?? 0), 0);

  return {
    daysReadThisMonth: countDoneDaysForItem(allCareEntries, 'reading', monthKey),
    roomResetsCompleted: countDoneDaysForItem(allCareEntries, 'spaceReset'),
    longestReadingStreak: longestStreakFor(allCareEntries, 'reading'),
    currentShowingUpStreak: streaks.showingUpStreak,
    totalDaysShowedUp,
    focusMinutesThisMonth,
  };
}
