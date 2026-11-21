import type { LifeItem } from './schema';

/** Pure date helpers for life items (no database access, so the advisor can use them too). */

/** A movie on the watchlist hasn't been watched — it never counts as something seen. */
export const isWatchlistMovie = (item: LifeItem) => item.type === 'movie' && item.status === 'watchlist';

/** Not done yet: a watchlist movie or a want-to-read book — left out of counts of what was watched/read. */
export const isWishlistItem = (item: LifeItem) => isWatchlistMovie(item) || (item.type === 'book' && item.status === 'wantTo');

/**
 * The dates a life item "happened" on, for this-week style summaries.
 * Its own dates (finished, started, watched, made…) come first; the day
 * it was added is used only when it has none — and never for imported
 * items (Goodreads / Letterboxd), so an import doesn't look like a week
 * of reading and watching. Want-to-read and watchlist items have none.
 */
export function lifeItemActivityDates(item: LifeItem): string[] {
  const created = item.createdAt.slice(0, 10);
  switch (item.type) {
    case 'book': {
      if (item.status === 'wantTo') return [];
      const own = [item.dateFinished, item.dateStarted].filter(Boolean) as string[];
      return own.length ? own : item.source === 'goodreads' ? [] : [created];
    }
    case 'movie':
      if (item.status === 'watchlist') return [];
      return item.dateWatched ? [item.dateWatched] : item.source === 'letterboxd' ? [] : [created];
    case 'series': {
      const own = [item.dateFinished, item.dateStarted].filter(Boolean) as string[];
      return own.length ? own : [created];
    }
    case 'artwork':
      return [item.dateCreated ?? created];
    case 'experience':
      return [item.date ?? created];
    default:
      return [created];
  }
}
