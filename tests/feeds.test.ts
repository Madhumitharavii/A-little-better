import { describe, it, expect } from 'vitest';
import { parseRssItems } from '@/features/life/feeds/rss';
import { parseLetterboxdFeed } from '@/features/life/feeds/letterboxdFeed';
import { parseGoodreadsFeed } from '@/features/life/feeds/goodreadsFeed';
import { planImport } from '@/features/life/movies/letterboxdImport';
import { planGoodreadsImport } from '@/features/life/books/goodreadsImport';
import { goodreadsIdFrom, letterboxdUserFrom } from '@/lib/feedSync';
import { feedUrl } from '../api/feed';
import type { MovieItem } from '@/db/schema';

// Made-up feeds in the same shape as Letterboxd's and Goodreads' real ones.
const LB = `<?xml version="1.0"?><rss xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org"><channel>
<item><title>Paddington 2, 2017 - ★★★★★</title><link>https://letterboxd.com/someone/film/paddington-2/</link><guid isPermaLink="false">letterboxd-review-1</guid>
<letterboxd:watchedDate>2026-11-14</letterboxd:watchedDate><letterboxd:rewatch>Yes</letterboxd:rewatch><letterboxd:filmTitle>Paddington 2</letterboxd:filmTitle><letterboxd:filmYear>2017</letterboxd:filmYear>
<letterboxd:memberRating>5.0</letterboxd:memberRating><letterboxd:memberLike>Yes</letterboxd:memberLike>
<description><![CDATA[ <p><img src="https://a.ltrbxd.com/x.jpg"/></p> <p><em>This review may contain spoilers.</em></p> <p>Still perfect &amp; kind.</p> ]]></description></item>
<item><title>Dune, 2021</title><link>https://letterboxd.com/someone/film/dune/</link><guid isPermaLink="false">letterboxd-watch-2</guid>
<letterboxd:watchedDate>2026-11-10</letterboxd:watchedDate><letterboxd:rewatch>No</letterboxd:rewatch><letterboxd:filmTitle>Dune</letterboxd:filmTitle><letterboxd:filmYear>2021</letterboxd:filmYear>
<letterboxd:memberRating>4.0</letterboxd:memberRating><description><![CDATA[ <p><img src="x"/></p> <p>Watched on Tuesday November 10, 2026.</p> ]]></description></item>
<item><title>A list</title><guid isPermaLink="false">letterboxd-list-3</guid><description>list</description></item>
</channel></rss>`;

const GR = `<?xml version="1.0"?><rss><channel>
<item><guid>https://www.goodreads.com/review/show/1</guid><title><![CDATA[Piranesi]]></title><author_name>Susanna Clarke</author_name>
<user_rating>5</user_rating><user_read_at><![CDATA[Sat, 14 Nov 2026 00:00:00 +0000]]></user_read_at><user_date_added><![CDATA[Mon, 02 Nov 2026 10:00:00 -0800]]></user_date_added>
<user_shelves>favorites, fantasy</user_shelves><user_review><![CDATA[Strange and lovely.<br/>A house of tides.]]></user_review></item>
<item><guid>https://www.goodreads.com/review/show/2</guid><title><![CDATA[Atomic Habits]]></title><author_name>James Clear</author_name>
<user_rating>0</user_rating><user_read_at></user_read_at><user_date_added><![CDATA[Tue, 03 Nov 2026 10:00:00 -0800]]></user_date_added><user_shelves></user_shelves><user_review></user_review></item>
</channel></rss>`;

describe('Letterboxd feed', () => {
  it('reads diary entries — reviews, plain watches, likes, rewatches — and skips list updates', () => {
    const exp = parseLetterboxdFeed(LB);
    expect(exp.films.map((f) => f.title)).toEqual(['Paddington 2', 'Dune']);
    const [p, d] = exp.films;
    expect(p).toMatchObject({ year: 2017, liked: true, seen: true });
    expect(p.watches).toEqual([{ date: '2026-11-14', rating: 5, review: 'Still perfect & kind.', rewatch: true }]);
    expect(d.watches[0]).toMatchObject({ date: '2026-11-10', rating: 4, review: undefined, rewatch: false });
  });

  it('merges into the library without duplicating, and a second check changes nothing', () => {
    const exp = parseLetterboxdFeed(LB);
    const mine = { id: 'm', type: 'movie', title: 'Dune', year: 2021, status: 'watchlist', letterboxdUri: 'https://boxd.it/x', createdAt: 'x', updatedAt: 'x' } as MovieItem;
    const plan = planImport(exp, [mine]);
    expect(plan.creates.map((c) => c.title)).toEqual(['Paddington 2']);
    expect(plan.updates[0].patch).toMatchObject({ status: 'watched', dateWatched: '2026-11-10', letterboxdUri: 'https://boxd.it/x' });
    const lib = [{ ...mine, ...plan.updates[0].patch }, ...plan.creates.map((c, i) => ({ ...c, id: `n${i}`, createdAt: 'x', updatedAt: 'x' }))] as MovieItem[];
    expect(planImport(parseLetterboxdFeed(LB), lib).summary).toMatchObject({ newFilms: 0, updatedFilms: 0 });
  });
});

describe('Goodreads feed', () => {
  it('reads a shelf: rating, dates, review, favourites and custom shelves', () => {
    const rows = parseGoodreadsFeed(GR, 'read');
    expect(rows[0]).toMatchObject({ title: 'Piranesi', author: 'Susanna Clarke', rating: 5, dateRead: '2026-11-14', status: 'finished', favorite: true, shelves: ['fantasy'], notes: 'Strange and lovely.\nA house of tides.' });
    expect(parseGoodreadsFeed(GR, 'currently-reading')[1]).toMatchObject({ title: 'Atomic Habits', status: 'inProgress', rating: undefined, dateRead: undefined });
    expect(planGoodreadsImport(rows, []).creates).toHaveLength(2);
  });
});

describe('the feed relay and account inputs', () => {
  it('only ever builds Letterboxd / Goodreads feed addresses', () => {
    const q = (s: string) => feedUrl(new URLSearchParams(s));
    expect(q('source=letterboxd&user=someone')).toBe('https://letterboxd.com/someone/rss/');
    expect(q('source=goodreads&user=123&shelf=to-read')).toBe('https://www.goodreads.com/review/list_rss/123?shelf=to-read&per_page=100');
    expect(q('source=letterboxd&user=../../evil')).toBeNull();
    expect(q('source=goodreads&user=abc')).toBeNull();
    expect(q('source=goodreads&user=123&shelf=secret')).toBeNull();
    expect(q('source=elsewhere&user=x')).toBeNull();
  });
  it('accepts usernames and profile links in the forms people paste', () => {
    expect(letterboxdUserFrom('@someone')).toBe('someone');
    expect(letterboxdUserFrom('https://letterboxd.com/someone/')).toBe('someone');
    expect(goodreadsIdFrom('https://www.goodreads.com/user/show/12345678-someone')).toBe('12345678');
    expect(goodreadsIdFrom('12345678')).toBe('12345678');
    expect(goodreadsIdFrom('not a link')).toBeUndefined();
  });
});

describe('rss reader', () => {
  it('handles CDATA, entities and namespaced fields', () => {
    const [item] = parseRssItems('<rss><item><a:b>x &amp; y</a:b><c><![CDATA[<p>raw</p>]]></c></item></rss>');
    expect(item).toEqual({ b: 'x & y', c: '<p>raw</p>' });
  });
});
