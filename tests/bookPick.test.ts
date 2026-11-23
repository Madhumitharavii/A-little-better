import { describe, expect, it } from 'vitest';
import type { BookItem } from '@/db/schema';
import { genresFrom, NON_FICTION } from '@/lib/bookGenres';
import { bookPool, genreOptions, inGenre, todaysBookPick } from '@/features/life/books/bookPick';
import { candidates } from '@/lib/coverFill';

const book = (over: Partial<BookItem>): BookItem =>
  ({ id: over.title ?? 'x', type: 'book', title: 'Example', createdAt: '2026-01-01', updatedAt: '2026-01-01', ...over }) as BookItem;

describe('book genres from Open Library subjects', () => {
  it('reads messy subject tags', () => {
    expect(genresFrom(['FICTION / Thrillers / Suspense', 'Fiction', 'Married people'])).toEqual(['Mystery & thriller']);
    expect(genresFrom(['Fantasy', 'dragons', 'Juvenile fiction', 'Classics'])).toEqual(['Fantasy', 'Classics', 'Young adult & children’s']);
    expect(genresFrom(['Habit', 'Behavior modification', 'Personal Growth'])).toEqual(['Self-help', NON_FICTION]);
    expect(genresFrom(['World history', 'Non-Fiction', 'Science'])).toEqual([NON_FICTION]);
    expect(genresFrom([])).toEqual([]);
  });
});

describe('Pick for me (books)', () => {
  const pool = bookPool([
    book({ title: 'A', status: 'wantTo', genres: ['Fantasy'] }),
    book({ title: 'B', status: 'wantTo', genres: ['Romance', 'Fantasy'], shelves: ['summer-reads'] }),
    book({ title: 'C', status: 'finished', genres: ['Romance'] }),
    book({ title: 'D', status: 'wantTo' }),
  ]);

  it('picks from want-to-read only', () => expect(pool.map((b) => b.title)).toEqual(['A', 'B', 'D']));

  it('offers genres and your own shelves, most books first', () =>
    expect(genreOptions(pool)).toEqual([
      { name: 'Fantasy', count: 2 },
      { name: 'Romance', count: 1 },
      { name: 'summer-reads', count: 1 },
    ]));

  it('narrows to a genre, or not at all', () => {
    expect(inGenre(pool, 'Romance').map((b) => b.title)).toEqual(['B']);
    expect(inGenre(pool, 'summer-reads').map((b) => b.title)).toEqual(['B']);
    expect(inGenre(pool, null)).toHaveLength(3);
  });

  it("finds today's pick", () => {
    expect(todaysBookPick([book({ title: 'A', pickedOn: '2026-11-23' })], '2026-11-23')?.title).toBe('A');
  });

  it('books with a cover still get looked up once for genres', () => {
    const rows = [book({ title: 'Has cover', coverUrl: 'https://x/y.jpg' }), book({ title: 'Done', coverUrl: 'https://x/y.jpg', genres: [] })];
    expect(candidates(rows, {}).map((c) => c.item.title)).toEqual(['Has cover']);
  });

  it('a book with no cover found recently is still looked up if it has no genres yet', () => {
    const now = Date.parse('2026-11-23');
    const rows = [book({ title: 'Missed' }), book({ title: 'Missed, sorted', genres: ['Poetry'] })];
    const missed = { Missed: now, 'Missed, sorted': now };
    expect(candidates(rows, missed, now).map((c) => c.item.title)).toEqual(['Missed']);
  });
});
