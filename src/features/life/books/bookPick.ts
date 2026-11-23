import type { BookItem } from '@/db/schema';

/** What "Pick for me" chooses from: the want-to-read shelf. */
export const bookPool = (books: readonly BookItem[]) => books.filter((b) => b.status === 'wantTo' && !b.deletedAt);

export const todaysBookPick = (books: readonly BookItem[], today: string) => books.find((b) => b.pickedOn === today && !b.deletedAt);

/** A book's genres plus your own shelves — what you can choose from in "Pick for me". */
export const kindsOf = (b: BookItem) => [...new Set([...(b.genres ?? []), ...(b.shelves ?? [])])];

/** Genres/shelves across the pool, most books first. */
export function genreOptions(pool: readonly BookItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of pool) for (const k of kindsOf(b)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export const inGenre = (pool: readonly BookItem[], genre: string | null) => (genre ? pool.filter((b) => kindsOf(b).includes(genre)) : [...pool]);
