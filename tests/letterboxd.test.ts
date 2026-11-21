import { describe, it, expect } from 'vitest';
import {
  classifyExportFile,
  cleanReview,
  parseLetterboxdExport,
  planImport,
  type ExportFile,
} from '@/features/life/movies/letterboxdImport';
import { lifeItemActivityDates } from '@/db/lifeDates';
import type { MovieItem } from '@/db/schema';

const F = 'letterboxd-someone-2026-01-01-00-00-utc';
const files: ExportFile[] = [
  {
    path: `${F}/diary.csv`,
    text: [
      'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
      // Each log has its own link — rewatches must still group by film.
      '2025-01-02,Paddington 2,2017,https://boxd.it/aaa1,4.5,,cozy,2025-01-01',
      '2025-06-11,Paddington 2,2017,https://boxd.it/aaa2,5,Yes,,2025-06-10',
      '2025-03-05,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/bbb1,4,,,2025-03-04',
    ].join('\n'),
  },
  {
    path: `${F}/reviews.csv`,
    text: [
      'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date',
      '2025-06-11,Paddington 2,2017,https://boxd.it/aaa2,5,Yes,"Still <i>perfect</i>.<br />Marmalade &amp; kindness.",,2025-06-10',
    ].join('\n'),
  },
  {
    path: `${F}/watched.csv`,
    text: [
      'Date,Name,Year,Letterboxd URI',
      '2025-01-02,Paddington 2,2017,https://boxd.it/film1',
      '2025-03-05,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/film2',
      '2024-12-01,Spirited Away,2001,https://boxd.it/film3',
    ].join('\n'),
  },
  { path: `${F}/ratings.csv`, text: 'Date,Name,Year,Letterboxd URI,Rating\n2024-12-01,Spirited Away,2001,https://boxd.it/film3,5' },
  { path: `${F}/likes/films.csv`, text: 'Date,Name,Year,Letterboxd URI\n2024-12-01,Spirited Away,2001,https://boxd.it/film3' },
  { path: `${F}/watchlist.csv`, text: 'Date,Name,Year,Letterboxd URI\n2025-02-02,Perfect Days,2023,https://boxd.it/film4' },
  {
    path: `${F}/lists/comfort-films.csv`,
    text: [
      'Letterboxd list export v7',
      'Date,Name,Tags,URL,Description',
      '2025-04-23,Comfort films,,https://boxd.it/list1,',
      '',
      'Position,Name,Year,URL,Description',
      '1,Spirited Away,2001,https://letterboxd.com/film/spirited-away/,',
      '2,Paddington 2,2017,https://letterboxd.com/film/paddington-2/,',
    ].join('\n'),
  },
  // Ignored: other people's content and deleted/orphaned entries.
  { path: `${F}/likes/reviews.csv`, text: 'Date,Content\n2025-01-01,https://boxd.it/x' },
  { path: `${F}/deleted/diary.csv`, text: 'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2025-01-01,Deleted Film,1999,u,1,,,2025-01-01' },
  { path: `${F}/profile.csv`, text: 'Date Joined,Username\n2020-01-01,someone' },
];

/** Applies a plan to an in-memory library, the way the import modal does. */
function apply(library: MovieItem[], plan: ReturnType<typeof planImport>): MovieItem[] {
  const out = library.map((m) => {
    const u = plan.updates.find((x) => x.id === m.id);
    return u ? ({ ...m, ...u.patch } as MovieItem) : m;
  });
  plan.creates.forEach((c, i) => out.push({ ...c, id: `new-${i}`, createdAt: '2026-11-21T10:00:00Z', updatedAt: '2026-11-21T10:00:00Z' } as MovieItem));
  return out;
}

describe('Letterboxd full export import', () => {
  const exp = parseLetterboxdExport(files);
  const byTitle = (t: string) => exp.films.find((f) => f.title === t)!;

  it('uses the right files and ignores the rest', () => {
    expect(classifyExportFile(`${F}/likes/films.csv`)).toBe('likes');
    expect(classifyExportFile(`${F}/likes/reviews.csv`)).toBeNull();
    expect(classifyExportFile(`${F}/deleted/diary.csv`)).toBeNull();
    expect(classifyExportFile('diary.csv')).toBe('diary');
    expect(exp.films.map((f) => f.title)).not.toContain('Deleted Film');
  });

  it('groups rewatches by film even though each log has its own link, and attaches the review to its watch', () => {
    const p = byTitle('Paddington 2');
    expect(p.watches).toHaveLength(2);
    expect(p.watches[1]).toMatchObject({ date: '2025-06-10', rating: 5, rewatch: true, review: 'Still perfect.\nMarmalade & kindness.' });
    expect(p.uri).toBe('https://boxd.it/film1'); // the film's own link, from watched.csv
  });

  it('handles quoted titles, undated watched films, ratings, likes, watchlist and lists', () => {
    expect(byTitle('Crouching Tiger, Hidden Dragon').watches).toHaveLength(1);
    const s = byTitle('Spirited Away');
    expect(s).toMatchObject({ seen: true, rating: 5, liked: true, watches: [] });
    expect(s.lists).toEqual([{ name: 'Comfort films', position: 1 }]);
    expect(byTitle('Perfect Days').onWatchlist).toBe(true);
    expect(exp.listNames).toEqual(['Comfort films']);
  });

  it('plans new movies correctly', () => {
    const plan = planImport(exp, []);
    expect(plan.summary).toMatchObject({ films: 4, newFilms: 4, watched: 3, dated: 2, watches: 3, reviews: 1, favorites: 1, watchlist: 1, lists: ['Comfort films'] });
    const lib = apply([], plan);
    const p = lib.find((m) => m.title === 'Paddington 2')!;
    expect(p).toMatchObject({ status: 'watched', dateWatched: '2025-06-10', rewatch: true, review: 'Still perfect.\nMarmalade & kindness.', tags: ['cozy'] });
    expect(p.previousWatches).toHaveLength(1);
    expect(lib.find((m) => m.title === 'Spirited Away')).toMatchObject({ status: 'watched', favorite: true, rating: 5, dateWatched: undefined });
    expect(lib.find((m) => m.title === 'Perfect Days')!.status).toBe('watchlist');
  });

  it('is safe to re-run — a second import changes nothing', () => {
    const lib = apply([], planImport(exp, []));
    const again = planImport(exp, lib);
    expect(again.creates).toHaveLength(0);
    expect(again.updates).toHaveLength(0);
    expect(again.summary.unchangedFilms).toBe(4);
  });

  it('merges into movies already in the app without losing anything', () => {
    const mine: MovieItem = {
      id: 'm1', type: 'movie', title: 'paddington 2', year: 2017, status: 'watched',
      dateWatched: '2025-01-01', rating: 4, review: 'My own note', favorite: false,
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    };
    const wl: MovieItem = { id: 'm2', type: 'movie', title: 'Spirited Away', year: 2001, status: 'watchlist', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' };
    const plan = planImport(exp, [mine, wl]);
    const lib = apply([mine, wl], plan);
    const p = lib.find((m) => m.id === 'm1')!;
    expect(p.dateWatched).toBe('2025-06-10');
    expect(p.previousWatches?.[0]).toMatchObject({ dateWatched: '2025-01-01', rating: 4, review: 'My own note' });
    expect(lib.find((m) => m.id === 'm2')).toMatchObject({ status: 'watched', favorite: true });
    expect(lib.filter((m) => m.title.toLowerCase() === 'paddington 2')).toHaveLength(1);
  });

  it('cleans review HTML', () => {
    expect(cleanReview('<p>One</p><p>Two &quot;quoted&quot; &#8212; done</p>')).toBe('One\n\nTwo "quoted" — done');
  });
});

describe('activity dates (what counts as "this week")', () => {
  const base = { id: 'x', title: 'X', createdAt: '2026-11-21T10:00:00Z', updatedAt: '2026-11-21T10:00:00Z' };
  it('does not count imported undated films or watchlist films as watched on import day', () => {
    expect(lifeItemActivityDates({ ...base, type: 'movie', source: 'letterboxd' } as MovieItem)).toEqual([]);
    expect(lifeItemActivityDates({ ...base, type: 'movie', status: 'watchlist' } as MovieItem)).toEqual([]);
    expect(lifeItemActivityDates({ ...base, type: 'movie', source: 'letterboxd', dateWatched: '2025-06-10' } as MovieItem)).toEqual(['2025-06-10']);
    expect(lifeItemActivityDates({ ...base, type: 'movie' } as MovieItem)).toEqual(['2026-11-21']);
  });
});
