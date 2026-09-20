import type { PeriodEntry } from '@/db/schema';
import { addDays, getLocalDateKey } from '@/db/dateUtils';

/**
 * Everything here is descriptive, computed from the person's own
 * logged history — never stored, never framed as medical advice.
 * "Predicted" always means "based on your own recent pattern."
 */
export interface CycleStats {
  cycleCount: number;
  averageCycleLengthDays?: number;
  averagePeriodLengthDays?: number;
  lastPeriodStart?: string;
  predictedNextStart?: string;
  daysUntilPredicted?: number;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad);
  const db_ = new Date(by, bm - 1, bd);
  return Math.round((db_.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeCycleStats(entries: PeriodEntry[], today: string = getLocalDateKey()): CycleStats {
  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (sorted.length === 0) {
    return { cycleCount: 0 };
  }

  const lastPeriodStart = sorted[sorted.length - 1].startDate;

  // Use up to the last 6 cycle gaps for a recency-weighted average.
  const recentStarts = sorted.slice(-7).map((e) => e.startDate);
  const gaps: number[] = [];
  for (let i = 1; i < recentStarts.length; i++) {
    gaps.push(daysBetween(recentStarts[i - 1], recentStarts[i]));
  }
  const averageCycleLengthDays = gaps.length > 0 ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : undefined;

  const periodLengths = sorted
    .filter((e) => e.endDate)
    .map((e) => daysBetween(e.startDate, e.endDate!) + 1)
    .filter((n) => n > 0 && n < 20); // sanity bound against bad data
  const averagePeriodLengthDays =
    periodLengths.length > 0 ? Math.round(periodLengths.reduce((s, n) => s + n, 0) / periodLengths.length) : undefined;

  const predictedNextStart = averageCycleLengthDays ? addDays(lastPeriodStart, averageCycleLengthDays) : undefined;
  const daysUntilPredicted = predictedNextStart ? daysBetween(today, predictedNextStart) : undefined;

  return {
    cycleCount: sorted.length,
    averageCycleLengthDays,
    averagePeriodLengthDays,
    lastPeriodStart,
    predictedNextStart,
    daysUntilPredicted,
  };
}
