import { getLifeRows, subscribeLifeRows } from '@/db/lifeStore';
import { bulkUpdateLifeItems } from '@/db/repositories/lifeRepository';
import type { BookItem, LifeItemPatch, MovieItem } from '@/db/schema';

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
const BATCH = 20;
const GAP_MS = 1200; // between lookups — gentle on Letterboxd and Open Library
const PAUSE_MS = 20_000; // between batches

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
    if (r.deletedAt || recent(missed[r.id])) continue;
    if (r.type === 'movie' && !r.posterUrl && !r.posterImageId && r.letterboxdUri) out.push({ kind: 'movie', item: r });
    if (r.type === 'book' && !r.coverUrl && !r.coverImageId && r.title.trim()) out.push({ kind: 'book', item: r });
  }
  const when = (c: Candidate) =>
    c.kind === 'movie' ? c.item.dateWatched ?? c.item.updatedAt : c.item.dateFinished ?? c.item.dateStarted ?? c.item.updatedAt;
  return out.sort((a, b) => when(b).localeCompare(when(a)));
}

async function moviePoster(m: MovieItem): Promise<string | null | 'retry'> {
  const res = await fetch(`/api/feed?source=letterboxd-poster&uri=${encodeURIComponent(m.letterboxdUri!)}`);
  if (res.status === 400) return null;
  if (!res.ok) return 'retry';
  const body = (await res.json()) as { poster?: string | null };
  return body.poster ?? null;
}

/** The first Open Library result whose title matches ours (so we never show some other book's cover). */
export function pickCover(docs: { title?: string; cover_i?: number }[], title: string): string | null {
  const want = plainTitle(title);
  const hit = docs.find((d) => d.cover_i && d.title && (plainTitle(d.title) === want || plainTitle(d.title).startsWith(want) || want.startsWith(plainTitle(d.title))));
  return hit ? `https://covers.openlibrary.org/b/id/${hit.cover_i}-M.jpg` : null;
}

async function bookCover(b: BookItem): Promise<string | null | 'retry'> {
  const base = 'https://openlibrary.org/search.json?limit=5&fields=title,cover_i';
  const tries = [
    b.isbn ? `${base}&isbn=${encodeURIComponent(b.isbn)}` : null,
    `${base}&title=${encodeURIComponent(plainTitle(b.title))}${b.author ? `&author=${encodeURIComponent(b.author)}` : ''}`,
  ].filter((u): u is string => !!u);
  for (const url of tries) {
    const res = await fetch(url);
    if (!res.ok) return 'retry';
    const docs = ((await res.json()) as { docs?: { title?: string; cover_i?: number }[] }).docs ?? [];
    // An ISBN match is the exact book, whatever its title says.
    const byIsbn = url.includes('&isbn=') ? docs.find((d) => d.cover_i) : undefined;
    const found = byIsbn ? `https://covers.openlibrary.org/b/id/${byIsbn.cover_i}-M.jpg` : pickCover(docs, b.title);
    if (found) return found;
  }
  return null;
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
      const todo = candidates(rows, missed).slice(0, BATCH);
      if (!todo.length) break;
      const updates: { id: string; patch: LifeItemPatch }[] = [];
      for (const c of todo) {
        if (document.visibilityState !== 'visible') break;
        let found: string | null | 'retry';
        try {
          found = c.kind === 'movie' ? await moviePoster(c.item) : await bookCover(c.item);
        } catch {
          found = 'retry';
        }
        if (found === 'retry') {
          failures++;
          if (failures >= 3) break;
        } else if (found) {
          updates.push({ id: c.item.id, patch: c.kind === 'movie' ? { type: 'movie', posterUrl: found } : { type: 'book', coverUrl: found } });
        } else {
          missed[c.item.id] = Date.now();
        }
        await sleep(GAP_MS);
      }
      saveMissed(missed);
      // One write per batch, and only when the item still has no picture (you may have added one meanwhile).
      const latest = new Map((getLifeRows() ?? []).map((r) => [r.id, r as unknown as MovieItem | BookItem]));
      const still = updates.filter((u) => {
        const r = latest.get(u.id);
        return r && (r.type === 'movie' ? !r.posterUrl && !r.posterImageId : r.type === 'book' ? !r.coverUrl && !r.coverImageId : false);
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
  window.setTimeout(kick, 25_000);
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
