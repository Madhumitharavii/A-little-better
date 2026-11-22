import { describe, it, expect } from 'vitest';
import { parseVisionList, newVisionLines, readingGoalTarget, booksFinishedIn } from '@/features/life/wishlist/visionList';
import type { BookItem, WishItem } from '@/db/schema';

// Made-up goals — no real data in tests.
describe('vision board: add several', () => {
  const text = 'Learning:\n- Read 12 books\n2. Learn to bake bread\n\nAdventures:\n✓ Plant a herb garden\n[x] See the sea\n[ ] Ride a hot-air balloon\n\nRide a hot-air balloon\n';
  const lines = parseVisionList(text);

  it('reads categories, bullets and achieved marks', () => {
    expect(lines).toEqual([
      { title: 'Read 12 books', category: 'Learning', done: false },
      { title: 'Learn to bake bread', category: 'Learning', done: false },
      { title: 'Plant a herb garden', category: 'Adventures', done: true },
      { title: 'See the sea', category: 'Adventures', done: true },
      { title: 'Ride a hot-air balloon', category: 'Adventures', done: false },
      { title: 'Ride a hot-air balloon', category: 'Adventures', done: false },
    ]);
  });

  it('skips repeats and goals already on that year’s board', () => {
    const existing = [{ id: 'a', type: 'wish', listType: 'annualVision', title: 'read 12  books', year: 2026, createdAt: 'x', updatedAt: 'x' } as WishItem];
    expect(newVisionLines(lines, existing, 2026).map((l) => l.title)).toEqual(['Learn to bake bread', 'Plant a herb garden', 'See the sea', 'Ride a hot-air balloon']);
    expect(newVisionLines(lines, existing, 2027)).toHaveLength(5);
  });

  it('tracks a reading goal from Books', () => {
    expect(readingGoalTarget('Read 12 books')).toBe(12);
    expect(readingGoalTarget('12 books')).toBe(12);
    expect(readingGoalTarget('Read more')).toBeNull();
    const b = (status: BookItem['status'], dateFinished?: string) => ({ id: Math.random().toString(), type: 'book', title: 't', status, dateFinished, createdAt: 'x', updatedAt: 'x' }) as BookItem;
    expect(booksFinishedIn([b('finished', '2026-03-01'), b('finished', '2025-12-31'), b('didNotFinish', '2026-04-01'), b('wantTo')], 2026)).toBe(1);
  });
});

describe('vision paste edge cases (from the audit)', () => {
  it('keeps "#1 …" and "X …" goals as goals, and ignores reading paces', () => {
    const lines = parseVisionList('# Fun\n#1 Run a 5k\nX Factor audition\n[x] Already done');
    expect(lines).toEqual([
      { title: '#1 Run a 5k', category: 'Fun', done: false },
      { title: 'X Factor audition', category: 'Fun', done: false },
      { title: 'Already done', category: 'Fun', done: true },
    ]);
    expect(readingGoalTarget('Read 1 book a month')).toBeNull();
  });
  it('counts rereads finished this year', () => {
    const book = { id: 'a', type: 'book', title: 'A', status: 'inProgress', previousReadings: [{ id: 'r', status: 'finished', dateFinished: '2026-03-01' }], createdAt: 'x', updatedAt: 'x' } as BookItem;
    expect(booksFinishedIn([book], 2026)).toBe(1);
  });
});
