import { describe, it, expect } from 'vitest';
import { filmPageUrl, posterFromPage } from '../api/feed';
import { posterFrom, parseLetterboxdFeed } from '@/features/life/feeds/letterboxdFeed';
import { cleanIsbn } from '@/features/life/books/goodreadsImport';
import { candidates, pickCover, plainTitle } from '@/lib/coverFill';
import { planImport } from '@/features/life/movies/letterboxdImport';
import type { MovieItem } from '@/db/schema';

const POSTER = 'https://a.ltrbxd.com/resized/film-poster/1/2/3/123-some-film-0-600-0-900-crop.jpg?v=abc';

describe('movie posters', () => {
  it('only looks up Letterboxd film links', () => {
    expect(filmPageUrl('https://boxd.it/aB3x')).toBe('https://boxd.it/aB3x');
    expect(filmPageUrl('https://letterboxd.com/someone/film/some-film-2026/')).toBe('https://letterboxd.com/film/some-film-2026/');
    expect(filmPageUrl('https://letterboxd.com/someone/film/some-film/2/')).toBe('https://letterboxd.com/film/some-film/');
    expect(filmPageUrl('https://example.com/film/x/')).toBeNull();
    expect(filmPageUrl('https://letterboxd.com/someone/')).toBeNull();
    expect(filmPageUrl(null)).toBeNull();
  });

  it('reads the poster from a film page at card size, and only from Letterboxd\'s image host', () => {
    expect(posterFromPage(`<script>{"image":"${POSTER}","name":"x"}</script>`)).toBe(POSTER.replace('-0-600-0-900-crop', '-0-230-0-345-crop'));
    expect(posterFromPage('{"image":"https://example.com/x.jpg"}')).toBeNull();
  });

  it('takes the poster from a feed entry and gives it to a new film', () => {
    expect(posterFrom(`<p><img src="${POSTER}"/></p><p>Watched</p>`)).toContain('-0-230-0-345-crop');
    const xml = `<rss><channel><item><guid>letterboxd-watch-1</guid><link>https://letterboxd.com/someone/film/some-film/</link>
      <letterboxd:filmTitle>Some Film</letterboxd:filmTitle><letterboxd:filmYear>2026</letterboxd:filmYear>
      <letterboxd:watchedDate>2026-11-22</letterboxd:watchedDate>
      <description><![CDATA[<p><img src="${POSTER}"/></p><p>Watched on Sunday.</p>]]></description></item></channel></rss>`;
    const plan = planImport(parseLetterboxdFeed(xml), []);
    expect(plan.creates[0].posterUrl).toContain('a.ltrbxd.com');
  });

  it('adds a poster to a film already in the app, but never over your own picture', () => {
    const exp = { films: [{ key: 'some film|2026', title: 'Some Film', year: 2026, watches: [], liked: false, onWatchlist: false, seen: true, lists: [], tags: [], poster: POSTER }], kinds: [], listNames: [] };
    const base = { id: 'm', type: 'movie', title: 'Some Film', year: 2026, status: 'watched', createdAt: 'x', updatedAt: 'x' } as MovieItem;
    expect(planImport(exp as never, [base]).updates[0].patch).toMatchObject({ posterUrl: POSTER });
    expect(planImport(exp as never, [{ ...base, posterImageId: 'mine' }]).updates).toHaveLength(0);
  });
});

describe('book covers', () => {
  it('cleans Goodreads ISBNs', () => {
    expect(cleanIsbn('="9780000000002"')).toBe('9780000000002');
    expect(cleanIsbn('="000000000X"')).toBe('000000000X');
    expect(cleanIsbn('=""')).toBeUndefined();
  });

  it('only takes a cover whose title matches', () => {
    expect(plainTitle('A Made-Up Book (Some Series, #1)')).toBe('a made up book');
    expect(pickCover([{ title: 'Something Else', cover_i: 1 }, { title: 'A Made-Up Book', cover_i: 2 }], 'A Made-Up Book (Some Series, #1)')).toBe('https://covers.openlibrary.org/b/id/2-M.jpg');
    expect(pickCover([{ title: 'Something Else', cover_i: 1 }], 'A Made-Up Book')).toBeNull();
    expect(pickCover([{ title: 'A Made-Up Book' }], 'A Made-Up Book')).toBeNull();
  });

  it('picks what still needs a picture, newest first, skipping recent misses and your own pictures', () => {
    const rows = [
      { id: 'a', type: 'book', title: 'Old', dateFinished: '2020-01-01', updatedAt: '2020' },
      { id: 'b', type: 'book', title: 'New', dateFinished: '2026-01-01', updatedAt: '2026' },
      { id: 'c', type: 'book', title: 'Has photo', coverImageId: 'x', updatedAt: '2026' },
      { id: 'd', type: 'movie', title: 'No link', updatedAt: '2026' },
      { id: 'e', type: 'movie', title: 'Linked', letterboxdUri: 'https://boxd.it/x', dateWatched: '2025-01-01', updatedAt: '2025' },
      { id: 'f', type: 'book', title: 'Missed', updatedAt: '2026' },
    ];
    const now = Date.parse('2026-11-23T00:00:00Z');
    expect(candidates(rows, { f: now - 1000 }, now).map((c) => c.item.id)).toEqual(['b', 'e', 'a']);
    expect(candidates(rows, { f: now - 40 * 86400000 }, now).map((c) => c.item.id)).toContain('f');
  });
});
