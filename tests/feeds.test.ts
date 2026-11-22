import { describe, it, expect } from 'vitest';
import { parseRssItems } from '@/features/life/feeds/rss';
import { parseLetterboxdFeed } from '@/features/life/feeds/letterboxdFeed';
import { parseGoodreadsFeed } from '@/features/life/feeds/goodreadsFeed';
import { planImport } from '@/features/life/movies/letterboxdImport';
import { planGoodreadsImport } from '@/features/life/books/goodreadsImport';
import { goodreadsIdFrom, goodreadsKeyFrom, letterboxdUserFrom } from '@/lib/feedSync';
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

describe('edited reviews from Letterboxd', () => {
  const feedWith = (review: string) =>
    LB.replace('Still perfect &amp; kind.', review);
  const fromFeed = (review: string) => parseLetterboxdFeed(feedWith(review));
  const opts = { updateLetterboxdReviews: true };

  it('replaces a Letterboxd review you edited on Letterboxd', () => {
    const lib = planImport(fromFeed('First thoughts.'), []).creates.map((c, i) => ({ ...c, id: `n${i}`, createdAt: 'x', updatedAt: 'x' })) as MovieItem[];
    const plan = planImport(fromFeed('Edited: even better the second time.'), lib, opts);
    const p = plan.updates.find((u) => lib.find((m) => m.id === u.id)?.title === 'Paddington 2');
    expect(p?.patch).toMatchObject({ review: 'Edited: even better the second time.', reviewFrom: 'letterboxd' });
  });

  it('never replaces a review written or edited in the app', () => {
    const mine = { id: 'p', type: 'movie', title: 'Paddington 2', year: 2017, status: 'watched', dateWatched: '2026-11-14', review: 'My own words', reviewFrom: 'app', source: 'letterboxd', createdAt: 'x', updatedAt: 'x' } as MovieItem;
    const plan = planImport(fromFeed('Something else'), [mine], opts);
    const u = plan.updates.find((x) => x.id === 'p');
    expect(u?.patch.review ?? mine.review).toBe('My own words');
  });

  it('a normal export import still never overwrites an existing review', () => {
    const lib = planImport(fromFeed('First thoughts.'), []).creates.map((c, i) => ({ ...c, id: `n${i}`, createdAt: 'x', updatedAt: 'x' })) as MovieItem[];
    const plan = planImport(fromFeed('Edited text'), lib); // no option
    expect(plan.updates).toHaveLength(0);
  });

  it('keeps an earlier watch\'s Letterboxd review updatable after a rewatch moves it into history', () => {
    const film = { id: 'x', type: 'movie', title: 'Paddington 2', year: 2017, status: 'watched', dateWatched: '2026-11-20', source: 'letterboxd', previousWatches: [{ id: 'w', dateWatched: '2026-11-14', review: 'Old text', source: 'letterboxd', reviewFrom: 'letterboxd' }], createdAt: 'x', updatedAt: 'x' } as MovieItem;
    const plan = planImport(fromFeed('New text for that watch'), [film], opts);
    const prev = (plan.updates[0]?.patch as MovieItem).previousWatches;
    expect(prev?.find((w) => w.dateWatched === '2026-11-14')?.review).toBe('New text for that watch');
  });
});

describe('Goodreads private RSS link', () => {
  it('passes the key from the My Books RSS link through, and nothing else', () => {
    expect(goodreadsKeyFrom('https://www.goodreads.com/review/list_rss/123?key=AbC-123_xyz&shelf=%23ALL%23')).toBe('AbC-123_xyz');
    expect(goodreadsKeyFrom('https://www.goodreads.com/user/show/123-someone')).toBeUndefined();
    expect(feedUrl(new URLSearchParams('source=goodreads&user=123&shelf=read&key=AbC-123_xyz'))).toBe('https://www.goodreads.com/review/list_rss/123?shelf=read&per_page=100&key=AbC-123_xyz');
    expect(feedUrl(new URLSearchParams('source=goodreads&user=123&shelf=read&key=bad%26evil=1'))).toBeNull();
  });
});
