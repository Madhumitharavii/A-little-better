import { describe, expect, it } from 'vitest';
import type { LetterItem } from '@/db/schema';
import { addMonthsKey, isOpen, lettersFrom, nextNewYear, unreadOpen, untilText } from '@/features/letters/letters';

const letter = (id: string, openOn: string, extra: Partial<LetterItem> = {}): LetterItem => ({
  id,
  type: 'letter',
  title: 'Letter to future me',
  body: 'A made-up note',
  writtenOn: '2026-01-01',
  openOn,
  createdAt: '',
  updatedAt: '',
  ...extra,
});

describe('letters to future me', () => {
  it('stays sealed until its day, then opens', () => {
    const l = letter('a', '2027-01-01');
    expect(isOpen(l, '2026-12-31')).toBe(false);
    expect(isOpen(l, '2027-01-01')).toBe(true);
    expect(isOpen(l, '2027-03-01')).toBe(true);
  });

  it('only lists letters, not other rows or deleted ones', () => {
    const rows = [letter('a', '2027-01-01'), { id: 'x', type: 'book' }, letter('b', '2026-06-01', { deletedAt: '2026-02-01' })];
    expect(lettersFrom(rows).map((l) => l.id)).toEqual(['a']);
  });

  it('shows open letters that have not been read', () => {
    const ls = [letter('a', '2026-05-01'), letter('b', '2026-05-02', { readAt: 'x' }), letter('c', '2027-01-01')];
    expect(unreadOpen(ls, '2026-06-01').map((l) => l.id)).toEqual(['a']);
  });

  it('works out dates', () => {
    expect(nextNewYear('2026-01-01')).toBe('2027-01-01');
    expect(addMonthsKey('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsKey('2026-11-25', 12)).toBe('2027-11-25');
    expect(untilText('2026-01-01', '2026-01-02')).toBe('tomorrow');
    expect(untilText('2026-01-01', '2026-01-11')).toBe('in 10 days');
    expect(untilText('2026-01-01', '2026-07-01')).toBe('in 6 months');
    expect(untilText('2026-01-01', '2027-01-01')).toBe('in about a year');
  });
});
