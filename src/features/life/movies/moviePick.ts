import type { MovieItem } from '@/db/schema';

/** What "Pick for me" chooses from: the watchlist. */
export const pickPool = (movies: readonly MovieItem[]) => movies.filter((m) => m.status === 'watchlist' && !m.deletedAt);

/** The film already picked today, if any — one pick a day, no re-rolls. */
export const todaysPick = (movies: readonly MovieItem[], today: string) => movies.find((m) => m.pickedOn === today && !m.deletedAt);

export function pickFrom<T>(pool: readonly T[], rand: () => number = Math.random): T | undefined {
  if (!pool.length) return undefined;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
