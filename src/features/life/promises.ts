import type { BookItem, MovieItem } from '@/db/schema';

/**
 * "Pick for me" promises. Choosing "I'll watch this" / "I'll read this"
 * on a pick only marks the day (`pickedOn`) — nothing is logged. The
 * promise counts as kept once you've actually started: the film shows up
 * as watched (from Letterboxd or the app), or the book is being read.
 */
export type PromiseState = 'kept' | 'waiting';

export interface PromiseRow {
  id: string;
  kind: 'movie' | 'book';
  title: string;
  pickedOn: string;
  state: PromiseState;
  /** When it was kept, if known. */
  keptOn?: string;
}

function movieKeptOn(m: MovieItem): string | null | undefined {
  if (m.status === 'watchlist' || !m.pickedOn) return undefined;
  const dates = [m.dateWatched, ...(m.previousWatches ?? []).map((w) => w.dateWatched)].filter((d): d is string => !!d);
  const after = dates.filter((d) => d >= m.pickedOn!).sort()[0];
  if (after) return after;
  return dates.length ? undefined : null; // watched, no date known — still kept
}

function bookKeptOn(b: BookItem): string | null | undefined {
  if (!b.pickedOn || b.status === 'wantTo' || !b.status) return undefined;
  const d = [b.dateStarted, b.dateFinished].filter((x): x is string => !!x && x >= b.pickedOn!).sort()[0];
  if (d) return d;
  return b.dateStarted || b.dateFinished ? undefined : null;
}

export function promiseRows(movies: readonly MovieItem[], books: readonly BookItem[]): PromiseRow[] {
  const rows: PromiseRow[] = [];
  for (const m of movies) {
    if (!m.pickedOn || m.deletedAt) continue;
    const k = movieKeptOn(m);
    rows.push({
      id: m.id,
      kind: 'movie',
      title: m.title,
      pickedOn: m.pickedOn,
      state: k === undefined ? 'waiting' : 'kept',
      keptOn: k ?? undefined,
    });
  }
  for (const b of books) {
    if (!b.pickedOn || b.deletedAt) continue;
    const k = bookKeptOn(b);
    rows.push({
      id: b.id,
      kind: 'book',
      title: b.title,
      pickedOn: b.pickedOn,
      state: k === undefined ? 'waiting' : 'kept',
      keptOn: k ?? undefined,
    });
  }
  return rows.sort((a, b) => b.pickedOn.localeCompare(a.pickedOn));
}

/**
 * Picks made before this change were logged straight away (film →
 * watched, book → reading). Puts those back on the watchlist / to-read
 * shelf — unless you've since rated or reviewed the film, or finished
 * the book. Only for picks up to `before`, so nothing new is touched.
 */
export function undoAutoLog(item: MovieItem | BookItem, before: string): Partial<MovieItem> | Partial<BookItem> | null {
  if (!item.pickedOn || item.pickedOn > before || item.deletedAt) return null;
  if (item.type === 'movie') {
    const m = item;
    if (m.status === 'watched' && m.dateWatched === m.pickedOn && !m.previousWatches?.length && m.rating == null && !m.review) {
      return { status: 'watchlist', dateWatched: undefined };
    }
    return null;
  }
  const b = item;
  if (b.status === 'inProgress' && b.dateStarted === b.pickedOn && !b.dateFinished) return { status: 'wantTo', dateStarted: undefined };
  return null;
}
