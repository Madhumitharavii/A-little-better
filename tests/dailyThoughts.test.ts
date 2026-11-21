import { describe, it, expect } from 'vitest';
import { DAILY_THOUGHTS, thoughtForDate } from '@/features/today/dailyThoughts';

describe('Thought of the Day', () => {
  it('stays the same all day', () => {
    expect(thoughtForDate(new Date(2026, 10, 21, 0, 5))).toBe(thoughtForDate(new Date(2026, 10, 21, 23, 55)));
  });

  it('never repeats within a year (leap years included)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 366; i++) seen.add(thoughtForDate(new Date(2028, 0, 1 + i, 12)));
    expect(seen.size).toBe(366);
  });

  it('has no duplicate thoughts in the list', () => {
    expect(new Set(DAILY_THOUGHTS).size).toBe(DAILY_THOUGHTS.length);
  });
});
