import { getLifeRows, subscribeLifeRows } from '@/db/lifeStore';
import { bulkUpdateLifeItems } from '@/db/repositories/lifeRepository';
import type { BookItem, LifeItemPatch, MovieItem } from '@/db/schema';
import { genresFrom } from './bookGenres';

/**
 * Fills in posters and covers for films and books that don't have one yet,
 * slowly, in the background, while the app is open:
 *
 *  - films: the poster link from the film's Letterboxd page (via the app's
 *    own relay, /api/feed?source=letterboxd-poster);
 *  - books: a cover from Open Library (openlibrary.org, a free non-profit
 *    catalogue), found by ISBN or by title + author.
 *
 * Only LINKS are saved (a few dozen characters each) — no images are
 * downloaded into the app or synced. The only things ever sent out are a
 * film's Letterboxd link and a book's title/author/ISBN. A poster or cover
 * you added yourself is never replaced. Films/books with nothing found are
 * remembered on this device and not asked about again for a month.
 */

const MISSED_KEY = 'alb.covers.missed';
const RETRY_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const FILMS_PER_ROUND = 32;
const BOOKS_PER_ROUND = 8;
const FILMS_AT_ONCE = 4;
const FILM_GAP_MS = 400;
const BOOK_GAP_MS = 1100; // gentle on Open Library
const PAUSE_MS = 3000; // between batches

type Missed = Record<string, number>;
function readMissed(): Missed {
  try {
    return JSON.parse(localStorage.getItem(MISSED_KEY) ?? '{}') as Missed;
  } catch {
    return {};
  }
}
function saveMissed(m: Missed) {
  try {
    localStorage.setItem(MISSED_KEY, JSON.stringify(m));
  } catch {
    /* fine — it'll just ask again next time */
  }
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** "Dune (Dune, #1)" → "dune" — for searching and comparing titles. */
export const plainTitle = (t: string) =>
  t
    .replace(/\s*\([^)]*\)\s*$/, '')
    .split(':')[0]
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

type Candidate = { kind: 'movie'; item: MovieItem } | { kind: 'book'; item: BookItem };

/** What still needs a picture — most recently active first, so what you see first fills first. */
export function candidates(rows: readonly { type: string }[], missed: Missed, now = Date.now()): Candidate[] {
  const recent = (m: Missed[string] | undefined) => m !== undefined && now - m < RETRY_AFTER_MS;
  const out: Candidate[] = [];
  for (const r of rows as Array<MovieItem | BookItem>) {
    if (r.deletedAt) continue;
    if (r.type === 'movie' && !recent(missed[r.id]) && !r.posterUrl && !r.posterImageId && r.letterboxdUri) out.push({ kind: 'movie', item: r });
    if (r.type === 'book' && r.title.trim() && (r.genres === undefined || (!r.coverUrl && !r.coverImageId && !recent(missed[r.id]))))
      out.push({ kind: 'book', item: r });
  }
  const when = (c: Candidate) =>
    c.kind === 'movie' ? c.item.dateWatched ?? c.item.updatedAt : c.item.dateFinished ?? c.item.dateStarted ?? c.item.updatedAt;
  return out.sort((a, b) => when(b).localeCompare(when(a)));
}

export async function moviePoster(m: MovieItem): Promise<string | null | 'retry'> {
  const res = await fetch(`/api/feed?source=letterboxd-poster&uri=${encodeURIComponent(m.letterboxdUri!)}`);
  if (res.status === 400) return null;
  if (!res.ok) return 'retry';
  const body = (await res.json()) as { poster?: string | null };
  return body.poster ?? null;
}

type OlDoc = { title?: string; cover_i?: number; subject?: string[] };
const coverLink = (id: number) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
const titleMatches = (d: OlDoc, want: string) => {
  if (!d.title) return false;
  const t = plainTitle(d.title);
  return t === want || t.startsWith(want) || want.startsWith(t);
};

/** The first Open Library result whose title matches ours (so we never show some other book's cover). */
export function pickCover(docs: OlDoc[], title: string): string | null {
  const want = plainTitle(title);
  const hit = docs.find((d) => d.cover_i && titleMatches(d, want));
  return hit ? coverLink(hit.cover_i!) : null;
}

type BookInfo = { cover: string | null; genres: string[] };

/** A cover and genres for a book, from Open Library — by ISBN first, then title + author. */
export async function bookInfo(b: BookItem): Promise<BookInfo | 'retry'> {
  const base = 'https://openlibrary.org/search.json?limit=5&fields=title,cover_i,subject';
  const tries = [
    b.isbn ? `${base}&isbn=${encodeURIComponent(b.isbn)}` : null,
    `${base}&title=${encodeURIComponent(plainTitle(b.title))}${b.author ? `&author=${encodeURIComponent(b.author)}` : ''}`,
  ].filter((u): u is string => !!u);
  let genres: string[] | undefined;
  const want = plainTitle(b.title);
  for (const url of tries) {
    const res = await fetch(url);
    if (!res.ok) return 'retry';
    const docs = ((await res.json()) as { docs?: OlDoc[] }).docs ?? [];
    // An ISBN match is the exact book, whatever its title says.
    const isbn = url.includes('&isbn=');
    const withCover = isbn ? docs.find((d) => d.cover_i) : docs.find((d) => d.cover_i && titleMatches(d, want));
    const any = withCover ?? (isbn ? docs[0] : docs.find((d) => titleMatches(d, want)));
    if (!genres?.length && any?.subject?.length) genres = genresFrom(any.subject);
    if (withCover) return { cover: coverLink(withCover.cover_i!), genres: genres ?? [] };
  }
  return { cover: null, genres: genres ?? [] };
}

let running = false;

async function fillSome(): Promise<void> {
  if (running) return;
  running = true;
  try {
    let failures = 0;
    while (document.visibilityState === 'visible' && navigator.onLine && failures < 3) {
      const rows = getLifeRows();
      if (!rows) break;
      const missed = readMissed();
      const all = candidates(rows, missed);
      // Each round: a handful of films and a few books, so neither waits on the other.
      const films = all.filter((c) => c.kind === 'movie').slice(0, FILMS_PER_ROUND);
      const books = all.filter((c) => c.kind === 'book').slice(0, BOOKS_PER_ROUND);
      if (!films.length && !books.length) break;
      const updates: { id: string; patch: LifeItemPatch }[] = [];
      const lookUp = async (c: Candidate) => {
        if (document.visibilityState !== 'visible' || failures >= 3) return;
        try {
          if (c.kind === 'movie') {
            const found = await moviePoster(c.item);
            if (found === 'retry') failures++;
            else if (found) updates.push({ id: c.item.id, patch: { type: 'movie', posterUrl: found } });
            else missed[c.item.id] = Date.now();
          } else {
            const info = await bookInfo(c.item);
            if (info === 'retry') failures++;
            else {
              const hasCover = c.item.coverUrl || c.item.coverImageId;
              if (!info.cover && !hasCover) missed[c.item.id] = Date.now();
              updates.push({ id: c.item.id, patch: { type: 'book', genres: info.genres, ...(info.cover && !hasCover ? { coverUrl: info.cover } : {}) } });
            }
          }
        } catch {
          failures++;
        }
      };
      // Films go through the app's own relay (cached), a few at a time; books go to Open Library one by one.
      await Promise.all([
        (async () => {
          for (let i = 0; i < films.length; i += FILMS_AT_ONCE) {
            await Promise.all(films.slice(i, i + FILMS_AT_ONCE).map(lookUp));
            await sleep(FILM_GAP_MS);
          }
        })(),
        (async () => {
          for (const b of books) {
            await lookUp(b);
            await sleep(BOOK_GAP_MS);
          }
        })(),
      ]);
      saveMissed(missed);
            const latest = new Map((getLifeRows() ?? []).map((r) => [r.id, r as unknown as MovieItem | BookItem]));
      // Never replace a picture you added meanwhile, or genres already there.
      const still = updates.flatMap((u) => {
        const r = latest.get(u.id);
        if (!r) return [];
        if (r.type === 'movie') return !r.posterUrl && !r.posterImageId ? [u] : [];
        if (r.type !== 'book' || u.patch.type !== 'book') return [];
        const patch: LifeItemPatch = { type: 'book' };
        if (u.patch.coverUrl && !r.coverUrl && !r.coverImageId) patch.coverUrl = u.patch.coverUrl;
        if (r.genres === undefined) patch.genres = u.patch.genres;
        return patch.coverUrl || patch.genres ? [{ id: u.id, patch }] : [];
      });
      if (still.length) await bulkUpdateLifeItems(still);
      await sleep(PAUSE_MS);
    }
  } finally {
    running = false;
  }
}

export function startCoverFill(): void {
  if (import.meta.env.MODE === 'test') return;
  const kick = () => void fillSome();
  window.setTimeout(kick, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.setTimeout(kick, 5000);
  });
  // New films/books (e.g. from the Letterboxd feed) — pick them up within a few minutes.
  let t: number | undefined;
  subscribeLifeRows(() => {
    window.clearTimeout(t);
    t = window.setTimeout(kick, 60_000);
  });
}
