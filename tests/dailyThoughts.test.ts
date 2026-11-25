import { describe, it, expect } from 'vitest';
import { DAILY_THOUGHTS, thoughtForDate } from '@/features/today/dailyThoughts';

describe('Thought of the Day', () => {
  it('stays the same all day', () => {
    expect(thoughtForDate(new Date(2026, 10, 21, 0, 5))).toBe(thoughtForDate(new Date(2026, 10, 21, 23, 55)));
  });

  it('shows every thought once before any repeats', () => {
    const n = DAILY_THOUGHTS.length;
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) seen.add(thoughtForDate(new Date(2028, 0, 1 + i, 12)).text);
    expect(seen.size).toBe(n);
  });

  it('has no duplicates, and every thought says who it is from', () => {
    expect(new Set(DAILY_THOUGHTS.map((t) => t.text)).size).toBe(DAILY_THOUGHTS.length);
    expect(DAILY_THOUGHTS.every((t) => t.text && t.by)).toBe(true);
  });

  it('mixes things up — the next day is not usually by the same person', () => {
    let same = 0;
    for (let i = 0; i < 100; i++) if (thoughtForDate(new Date(2028, 0, 1 + i)).by === thoughtForDate(new Date(2028, 0, 2 + i)).by) same++;
    expect(same).toBeLessThan(5);
  });
});
