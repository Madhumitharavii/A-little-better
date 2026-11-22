import { useDeferredValue, useMemo } from 'react';
import { selectLifeCounts, selectLifeItems, selectRecentlyAdded, selectSearch, type LifeCounts } from '@/db/repositories/lifeRepository';
import { useLifeRows } from '@/db/lifeStore';
import type { LifeItemType } from '@/db/schema';

/** All derived from the one shared copy of the table (see lifeStore.ts). */
const EMPTY_COUNTS: LifeCounts = { book: 0, movie: 0, series: 0, artwork: 0, experience: 0, wish: 0 };

// Filtered + sorted once per change to the table and shared by every component asking
// for the same kind (Week alone asks for five kinds; Today, Life and Reading ask again).
const byType = new WeakMap<object, Map<LifeItemType, ReturnType<typeof selectLifeItems>>>();
const EMPTY: ReturnType<typeof selectLifeItems> = [];

export function useLifeItemsOfType(type: LifeItemType) {
  const rows = useLifeRows();
  return useMemo(() => {
    if (!rows) return EMPTY;
    let cache = byType.get(rows);
    if (!cache) byType.set(rows, (cache = new Map()));
    let items = cache.get(type);
    if (!items) cache.set(type, (items = selectLifeItems(rows, type)));
    return items;
  }, [rows, type]);
}

export function useRecentlyAdded(limit = 6) {
  const rows = useLifeRows();
  return useMemo(() => (rows ? selectRecentlyAdded(rows, limit) : []), [rows, limit]);
}

export function useLifeCounts() {
  const rows = useLifeRows();
  return useMemo(() => (rows ? selectLifeCounts(rows) : EMPTY_COUNTS), [rows]);
}

/** Search results (at most 100), computed in the background so typing stays smooth. */
export function useLifeSearch(query: string) {
  const rows = useLifeRows();
  const deferred = useDeferredValue(query);
  return useMemo(() => (rows ? selectSearch(rows, deferred).slice(0, 100) : []), [rows, deferred]);
}
