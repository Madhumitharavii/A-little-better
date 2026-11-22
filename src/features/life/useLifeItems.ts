import { useMemo } from 'react';
import { selectLifeCounts, selectLifeItems, selectRecentlyAdded, selectSearch, type LifeCounts } from '@/db/repositories/lifeRepository';
import { useLifeRows } from '@/db/lifeStore';
import type { LifeItemType } from '@/db/schema';

/** All derived from the one shared copy of the table (see lifeStore.ts). */
const EMPTY_COUNTS: LifeCounts = { book: 0, movie: 0, series: 0, artwork: 0, experience: 0, wish: 0 };

export function useLifeItemsOfType(type: LifeItemType) {
  const rows = useLifeRows();
  return useMemo(() => (rows ? selectLifeItems(rows, type) : []), [rows, type]);
}

export function useRecentlyAdded(limit = 6) {
  const rows = useLifeRows();
  return useMemo(() => (rows ? selectRecentlyAdded(rows, limit) : []), [rows, limit]);
}

export function useLifeCounts() {
  const rows = useLifeRows();
  return useMemo(() => (rows ? selectLifeCounts(rows) : EMPTY_COUNTS), [rows]);
}

export function useLifeSearch(query: string) {
  const rows = useLifeRows();
  return useMemo(() => (rows ? selectSearch(rows, query) : []), [rows, query]);
}
