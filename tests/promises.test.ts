import { describe, expect, it } from 'vitest';
import type { BookItem, MovieItem } from '@/db/schema';
import { promiseRows, undoAutoLog } from '@/features/life/promises';

const movie = (p: Partial<MovieItem>): MovieItem => ({ id: 'm', type: 'movie', title: 'A Made-up Film', createdAt: '', updatedAt: '', ...p });
const book = (p: Partial<BookItem>): BookItem => ({ id: 'b', type: 'book', title: 'A Made-up Book', createdAt: '', updatedAt: '', ...p });

describe('Pick for me promises', () => {
  it('a picked film is a promise until it is watched', () => {
    expect(promiseRows([movie({ status: 'watchlist', pickedOn: '2026-12-01' })], [])[0].state).toBe('waiting');
    const kept = promiseRows([movie({ status: 'watched', dateWatched: '2026-12-03', pickedOn: '2026-12-01' })], [])[0];
    expect(kept).toMatchObject({ state: 'kept', keptOn: '2026-12-03' });
  });

  it('a picked book counts once you start it', () => {
    expect(promiseRows([], [book({ status: 'wantTo', pickedOn: '2026-12-01' })])[0].state).toBe('waiting');
    expect(promiseRows([], [book({ status: 'inProgress', dateStarted: '2026-12-02', pickedOn: '2026-12-01' })])[0].state).toBe('kept');
  });

  it('ignores things never picked', () => {
    expect(promiseRows([movie({ status: 'watched' })], [book({})])).toEqual([]);
  });

  it('undoes the old straight-away logging, but not real watches', () => {
    expect(undoAutoLog(movie({ status: 'watched', dateWatched: '2026-11-20', pickedOn: '2026-11-20' }), '2026-11-25')).toEqual({ status: 'watchlist', dateWatched: undefined });
    expect(undoAutoLog(movie({ status: 'watched', dateWatched: '2026-11-20', pickedOn: '2026-11-20', rating: 4 }), '2026-11-25')).toBeNull();
    expect(undoAutoLog(movie({ status: 'watched', dateWatched: '2026-11-22', pickedOn: '2026-11-20' }), '2026-11-25')).toBeNull();
    expect(undoAutoLog(movie({ status: 'watched', dateWatched: '2026-12-01', pickedOn: '2026-12-01' }), '2026-11-25')).toBeNull();
    expect(undoAutoLog(book({ status: 'inProgress', dateStarted: '2026-11-20', pickedOn: '2026-11-20' }), '2026-11-25')).toEqual({ status: 'wantTo', dateStarted: undefined });
    expect(undoAutoLog(book({ status: 'finished', dateStarted: '2026-11-20', dateFinished: '2026-11-24', pickedOn: '2026-11-20' }), '2026-11-25')).toBeNull();
  });
});
