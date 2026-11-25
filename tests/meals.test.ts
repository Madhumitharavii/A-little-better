import { describe, expect, it } from 'vitest';
import type { CareEntry } from '@/db/schema';
import { breakfastHistory, breakfastNudge, nextMealState } from '@/features/today/meals';
import { mealNudgeDue } from '@/lib/mealReminders';

const e = (date: string, itemKey: CareEntry['itemKey'], status: CareEntry['status'] = 'done'): CareEntry => ({
  id: `${date}-${itemKey}`,
  date,
  itemKey,
  status,
  createdAt: '',
  updatedAt: '',
});

describe('meals', () => {
  it('cycles none → ate → skipped → none', () => {
    expect(nextMealState('none')).toBe('ate');
    expect(nextMealState('ate')).toBe('skipped');
    expect(nextMealState('skipped')).toBe('none');
  });

  it('counts a skip when breakfast is marked skipped, or missing on a day other meals were ticked', () => {
    const entries = [e('2026-03-09', 'breakfast', 'skipped'), e('2026-03-08', 'lunch'), e('2026-03-07', 'breakfast'), e('2026-03-01', 'breakfast', 'skipped')];
    expect(breakfastHistory(entries, '2026-03-10')).toEqual({ logged: 3, skipped: 2, skippedInARow: 2 });
  });

  it("doesn't guess about days with nothing logged", () => {
    expect(breakfastHistory([], '2026-03-10')).toEqual({ logged: 0, skipped: 0, skippedInARow: 0 });
    expect(breakfastNudge([], '2026-03-10')).toBeNull();
  });

  it('nudges to wake up 30 minutes earlier after two skips', () => {
    const nudge = breakfastNudge([e('2026-03-09', 'breakfast', 'skipped'), e('2026-03-08', 'breakfast', 'skipped')], '2026-03-10');
    expect(nudge).toMatch(/2 days in a row/);
    expect(nudge).toMatch(/30 minutes earlier/);
    expect(nudge).toMatch(/Health before everything/);
    expect(breakfastNudge([e('2026-03-09', 'breakfast'), e('2026-03-08', 'breakfast', 'skipped')], '2026-03-10')).toBeNull();
  });

  it('reminds about an unmarked meal once, in its window', () => {
    const at = (h: number, m = 0) => new Date(2026, 2, 10, h, m);
    expect(mealNudgeDue(at(8), [], [], [])).toBeNull();
    expect(mealNudgeDue(at(10), [], [], [])?.key).toBe('breakfast');
    expect(mealNudgeDue(at(10), [e('2026-03-10', 'breakfast', 'skipped')], [], [])).toBeNull();
    expect(mealNudgeDue(at(10), [], [], ['breakfast'])).toBeNull();
    expect(mealNudgeDue(at(14, 30), [], [], [])?.key).toBe('lunch');
  });

  it('in the evening, plans tomorrow’s breakfast when it keeps getting skipped', () => {
    const night = new Date(2026, 2, 10, 22, 0);
    const today = [e('2026-03-10', 'breakfast', 'skipped'), e('2026-03-10', 'dinner')];
    const recent = [e('2026-03-09', 'breakfast', 'skipped')];
    const due = mealNudgeDue(night, today, recent, []);
    expect(due?.key).toBe('plan');
    expect(due?.message).toMatch(/30 minutes earlier/);
    expect(mealNudgeDue(night, today, [e('2026-03-09', 'breakfast')], [])).toBeNull();
  });
});
