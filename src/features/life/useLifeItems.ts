import { useLiveQuery } from 'dexie-react-hooks';
import { getLifeItems, getRecentlyAdded, getLifeCounts, searchLifeItems } from '@/db/repositories/lifeRepository';
import type { LifeItemType } from '@/db/schema';

export function useLifeItemsOfType(type: LifeItemType) {
  return useLiveQuery(() => getLifeItems(type), [type]) ?? [];
}

export function useRecentlyAdded(limit = 6) {
  return useLiveQuery(() => getRecentlyAdded(limit), [limit]) ?? [];
}

export function useLifeCounts() {
  return (
    useLiveQuery(() => getLifeCounts(), []) ?? { book: 0, movie: 0, series: 0, artwork: 0, experience: 0, wish: 0 }
  );
}

export function useLifeSearch(query: string) {
  return useLiveQuery(() => searchLifeItems(query), [query]) ?? [];
}
