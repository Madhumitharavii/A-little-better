import { describe, expect, it } from 'vitest';
import type { BookItem, CareEntry, JournalEntry, MovieItem } from '@/db/schema';
import { onThisDay } from '@/features/memories/onThisDay';
import { yearReview } from '@/features/review/yearReview';
import { comfortFilms } from '@/features/today/badDay';

const movie = (id: string, p: Partial<MovieItem>): MovieItem => ({ id, type: 'movie', title: `Film ${id}`, createdAt: '', updatedAt: '', ...p });
const book = (id: string, p: Partial<BookItem>): BookItem => ({ id, type: 'book', title: `Book ${id}`, createdAt: '', updatedAt: '', ...p });
const journal = (id: string, date: string, body: string): JournalEntry => ({ id, date, body, createdAt: '', updatedAt: '' });
const care = (date: string, itemKey: CareEntry['itemKey'], valueMinutes?: number): CareEntry => ({ id: `${date}${itemKey}`, date, itemKey, status: 'done', valueMinutes, createdAt: '', updatedAt: '' });

describe('On this day', () => {
  it('finds the same date in earlier years, newest first', () => {
    const years = onThisDay(
      {
        life: [movie('a', { status: 'watched', dateWatched: '2024-03-10' }), book('b', { status: 'finished', dateFinished: '2025-03-10' }), movie('c', { status: 'watched', dateWatched: '2025-03-11' })],
        journal: [journal('j', '2023-03-10', 'A made-up day at the sea.')],
        reflections: [{ id: 'r', date: '2025-03-10', smallWin: 'Went for a walk', createdAt: '', updatedAt: '' }],
        savedLines: [],
      },
      '2026-03-10',
    );
    expect(years.map((y) => [y.year, y.ago])).toEqual([[2025, 1], [2024, 2], [2023, 3]]);
    expect(years[0].items.map((i) => i.icon)).toEqual(['📚', '🌱']);
    expect(years[2].items[0].text).toContain('sea');
  });

  it('leaves out this year and the watchlist', () => {
    expect(onThisDay({ life: [movie('a', { status: 'watchlist', dateWatched: '2024-03-10' })], journal: [journal('j', '2026-03-10', 'today')], reflections: [], savedLines: [] }, '2026-03-10')).toEqual([]);
  });
});

describe('Year in review', () => {
  it('counts the year’s films, books, words and care', () => {
    const r = yearReview(
      {
        life: [
          movie('a', { status: 'watched', dateWatched: '2026-02-01', rating: 5, previousWatches: [{ id: 'w', dateWatched: '2026-01-05' }] }),
          movie('b', { status: 'watched', dateWatched: '2026-02-09', rating: 3.5 }),
          movie('c', { status: 'watched', dateWatched: '2025-06-01', rating: 5 }),
          book('d', { status: 'finished', dateFinished: '2026-04-01', rating: 4 }),
          book('e', { status: 'inProgress', dateStarted: '2026-05-01' }),
        ],
        journal: [journal('j', '2026-01-01', 'one two three')],
        reflections: [],
        care: [care('2026-01-01', 'breakfast'), care('2026-01-02', 'breakfast'), care('2026-01-02', 'reading', 30)],
        savedLines: [{ text: 'a line', date: '2026-07-07', savedAt: '' }],
      },
      2026,
    );
    expect(r.films).toMatchObject({ watches: 3, films: 2, rewatches: 1, busiestMonth: { month: 1, count: 2 } });
    expect(r.films.top.map((t) => t.id)).toEqual(['a', 'b']);
    expect(r.films.first?.id).toBe('a');
    expect(r.books).toMatchObject({ finished: 1, started: 1 });
    expect(r.journal).toEqual({ entries: 1, words: 3 });
    expect(r.care).toMatchObject({ breakfasts: 2, readingMinutes: 30 });
    expect(r.lines).toHaveLength(1);
    expect(r.empty).toBe(false);
  });
});

describe('Bad-day comfort films', () => {
  it('are the watched films you loved', () => {
    const list = comfortFilms([
      movie('a', { status: 'watched', rating: 5 }),
      movie('b', { status: 'watched', rating: 3, favorite: true }),
      movie('c', { status: 'watched', rating: 4 }),
      movie('d', { status: 'watchlist', favorite: true }),
    ]);
    expect(list.map((m) => m.id)).toEqual(['a', 'b']);
  });
});
