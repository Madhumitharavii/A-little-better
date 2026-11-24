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
const FILMS_AT_ONCE = 4;
const FILM_GAP_MS = 300;
const BOOK_GAP_MS = 400; // plus Open Library's own ~1s answer — about one request a second
const SAVE_EVERY = 8;
const SAVE_AFTER_MS = 8000;
const BACK_OFF_MS = 15_000;

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
    c.kind === 'movie' ? c.item.dateWatched ?? c.item.updatedAt : c.item.dateFinished ?? c.item.dateStarted ?? c.item.dateAdded ?? c.item.updatedAt;
  // Missing pictures first (what you notice); books that only need genres after.
  const genresOnly = (c: Candidate) => (c.kind === 'book' && (c.item.coverUrl || c.item.coverImageId) ? 1 : 0);
  return out.sort((a, b) => genresOnly(a) - genresOnly(b) || when(b).localeCompare(when(a)));
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

type Update = { id: string; patch: LifeItemPatch };

/** Saves found pictures/genres — never replacing a picture you added meanwhile, or genres already there. */
async function save(updates: Update[]) {
  if (!updates.length) return;
  const latest = new Map((getLifeRows() ?? []).map((r) => [r.id, r as unknown as MovieItem | BookItem]));
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
}

const running = { movie: false, book: false };
const canWork = () => document.visibilityState === 'visible' && navigator.onLine;

/**
 * One lane per kind, so films and books never wait on each other: films go
 * through the app's own (cached) relay a few at a time; books go to Open
 * Library one at a time (it asks apps to stay around one request a second).
 * A slow or failed answer just pauses that lane for a bit — it doesn't stop.
 */
async function lane(kind: 'movie' | 'book') {
  if (running[kind]) return;
  running[kind] = true;
  const atOnce = kind === 'movie' ? FILMS_AT_ONCE : 1;
  const gap = kind === 'movie' ? FILM_GAP_MS : BOOK_GAP_MS;
  const tried = new Set<string>(); // this run — a failed one waits for the next run
  let pending: Update[] = [];
  let lastSave = Date.now();
  let failsInARow = 0;
  try {
    while (canWork()) {
      const rows = getLifeRows();
      if (!rows) break;
      const missed = readMissed();
      const next = candidates(rows, missed)
        .filter((c) => c.kind === kind && !tried.has(c.item.id))
        .slice(0, atOnce);
      if (!next.length) break;
      next.forEach((c) => tried.add(c.item.id));
      let failed = false;
      await Promise.all(
        next.map(async (c) => {
          try {
            if (c.kind === 'movie') {
              const found = await moviePoster(c.item);
              if (found === 'retry') failed = true;
              else if (found) pending.push({ id: c.item.id, patch: { type: 'movie', posterUrl: found } });
              else missed[c.item.id] = Date.now();
            } else {
              const info = await bookInfo(c.item);
              if (info === 'retry') failed = true;
              else {
                const hasCover = c.item.coverUrl || c.item.coverImageId;
                if (!info.cover && !hasCover) missed[c.item.id] = Date.now();
                pending.push({ id: c.item.id, patch: { type: 'book', genres: info.genres, ...(info.cover && !hasCover ? { coverUrl: info.cover } : {}) } });
              }
            }
          } catch {
            failed = true;
          }
        }),
      );
      saveMissed(missed);
      // Save every few finds, so pictures appear as you watch rather than all at the end.
      if (pending.length >= SAVE_EVERY || Date.now() - lastSave > SAVE_AFTER_MS) {
        await save(pending);
        pending = [];
        lastSave = Date.now();
      }
      failsInARow = failed ? failsInARow + 1 : 0;
      await sleep(failsInARow ? Math.min(BACK_OFF_MS * failsInARow, 5 * 60_000) : gap);
    }
  } finally {
    await save(pending).catch(() => undefined);
    running[kind] = false;
  }
}

function fillSome() {
  void lane('movie');
  void lane('book');
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
