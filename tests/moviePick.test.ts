import { describe, expect, it } from 'vitest';
import type { MovieItem } from '@/db/schema';
import { pickFrom, pickPool, todaysPick } from '@/features/life/movies/moviePick';
import { mergeFilmIntoExisting, type LetterboxdFilm } from '@/features/life/movies/letterboxdImport';

const movie = (over: Partial<MovieItem>): MovieItem =>
  ({ id: over.title ?? 'x', type: 'movie', title: 'Example', createdAt: '2026-01-01', updatedAt: '2026-01-01', ...over }) as MovieItem;

const film = (over: Partial<LetterboxdFilm>): LetterboxdFilm =>
  ({ title: 'Example Film', watches: [], lists: [], tags: [], ...over }) as LetterboxdFilm;

describe('Pick for me', () => {
  it('picks only from the watchlist', () => {
    const pool = pickPool([movie({ title: 'A', status: 'watchlist' }), movie({ title: 'B' }), movie({ title: 'C', status: 'watchlist', deletedAt: '2026-01-02' })]);
    expect(pool.map((m) => m.title)).toEqual(['A']);
  });

  it('picks evenly and never runs off the end', () => {
    const pool = ['a', 'b', 'c'];
    expect(pickFrom(pool, () => 0)).toBe('a');
    expect(pickFrom(pool, () => 0.5)).toBe('b');
    expect(pickFrom(pool, () => 0.9999999)).toBe('c');
    expect(pickFrom([], () => 0.5)).toBeUndefined();
  });

  it("finds today's pick", () => {
    const ms = [movie({ title: 'A', pickedOn: '2026-11-22' }), movie({ title: 'B', pickedOn: '2026-11-23' })];
    expect(todaysPick(ms, '2026-11-23')?.title).toBe('B');
    expect(todaysPick(ms, '2026-11-24')).toBeUndefined();
  });

  it('a picked film logged on Letterboxd the next day is the same watch, not a rewatch', () => {
    const picked = movie({ status: 'watched', pickedOn: '2026-11-23', dateWatched: '2026-11-23' });
    const patch = mergeFilmIntoExisting(picked, film({ watches: [{ date: '2026-11-24', rating: 4 }] }));
    expect(patch).toMatchObject({ dateWatched: '2026-11-24', rating: 4 });
    expect(patch && 'rewatch' in patch ? patch.rewatch : undefined).toBeFalsy();
    expect(patch && 'previousWatches' in patch ? patch.previousWatches ?? [] : []).toEqual([]);
  });

  it('an older Letterboxd watch from before the pick stays a separate watch', () => {
    const picked = movie({ status: 'watched', pickedOn: '2026-11-23', dateWatched: '2026-11-23' });
    const patch = mergeFilmIntoExisting(picked, film({ watches: [{ date: '2020-05-01' }] }));
    expect(patch).toMatchObject({ dateWatched: '2026-11-23', rewatch: true });
  });
});
