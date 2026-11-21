import type { LifeItem } from './schema';

/** Pure date helpers for life items (no database access, so the advisor can use them too). */

/** A movie on the watchlist hasn't been watched — it never counts as something seen. */
export const isWatchlistMovie = (item: LifeItem) => item.type === 'movie' && item.status === 'watchlist';

/**
 * The date a life item "happened" for this-week style summaries.
 * Imported movies with no watch date (e.g. Letterboxd films never
 * logged in the diary) return undefined rather than their import day.
 */
export function lifeItemActivityDates(item: LifeItem): string[] {
  const created = item.createdAt.slice(0, 10);
  switch (item.type) {
    case 'book':
      return [item.dateFinished, item.dateStarted, created].filter(Boolean) as string[];
    case 'movie':
      if (item.status === 'watchlist') return [];
      return item.dateWatched ? [item.dateWatched] : item.source === 'letterboxd' ? [] : [created];
    case 'series':
      return [item.dateFinished, item.dateStarted, created].filter(Boolean) as string[];
    case 'artwork':
      return [item.dateCreated, created].filter(Boolean) as string[];
    case 'experience':
      return [item.date, created].filter(Boolean) as string[];
    default:
      return [created];
  }
}
