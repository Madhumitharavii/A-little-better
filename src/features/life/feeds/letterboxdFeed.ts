import { cleanReview } from '@/shared/utils/html';
import { filmKey, type LetterboxdExport, type LetterboxdFilm } from '../movies/letterboxdImport';
import { parseRssItems } from './rss';

/**
 * Your Letterboxd diary feed (letterboxd.com/<username>/rss/) → the same shape
 * the export importer uses, so the same merge rules apply: new films are added,
 * films already in the app get the new watch / rating / review / ♥, nothing is
 * duplicated. The feed holds your ~50 most recent diary entries.
 */
export function parseLetterboxdFeed(xml: string): LetterboxdExport {
  const films = new Map<string, LetterboxdFilm>();
  for (const item of parseRssItems(xml)) {
    const guid = item.guid ?? '';
    const isReview = guid.startsWith('letterboxd-review');
    if (!isReview && !guid.startsWith('letterboxd-watch')) continue; // list updates etc.
    const title = item.filmTitle?.trim();
    if (!title) continue;
    const year = item.filmYear ? Number(item.filmYear) : undefined;
    const key = filmKey(title, year);
    let film = films.get(key);
    if (!film) {
      film = { key, title, year, uri: item.link || undefined, watches: [], liked: false, onWatchlist: false, seen: true, lists: [], tags: [] };
      films.set(key, film);
    }
    if (item.memberLike === 'Yes') film.liked = true;
    film.poster ??= posterFrom(item.description ?? '');
    film.watches.push({
      date: item.watchedDate || undefined,
      rating: item.memberRating ? Number(item.memberRating) : undefined,
      review: isReview ? reviewText(item.description ?? '') : undefined,
      rewatch: item.rewatch === 'Yes',
    });
  }
  for (const f of films.values()) f.watches.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  return { films: [...films.values()], kinds: ['diary'], listNames: [] };
}

/** The review part of an entry: drop the poster image and Letterboxd's spoiler notice. */
function reviewText(html: string): string | undefined {
  const text = cleanReview(html.replace(/<p>\s*<img[^>]*>\s*<\/p>/gi, '').replace(/<p>\s*<em>\s*This review may contain spoilers\.?\s*<\/em>\s*<\/p>/gi, ''));
  return text || undefined;
}

/** The poster image in an entry, at card size (Letterboxd's own image host only). */
export function posterFrom(html: string): string | undefined {
  const m = html.match(/<img[^>]+src="(https:\/\/a\.ltrbxd\.com\/resized\/[^"]+)"/);
  return m ? m[1].replace(/&amp;/g, '&').replace(/-0-\d+-0-\d+-crop/, '-0-230-0-345-crop') : undefined;
}
