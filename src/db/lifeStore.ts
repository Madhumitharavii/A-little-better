import { liveQuery } from 'dexie';
import { useSyncExternalStore } from 'react';
import { db } from './db';

/**
 * One shared, live copy of the lifeItems table (books, films, goals,
 * study rows, taps, synced preferences…). The table is read ONCE per
 * change and every screen derives what it needs from that copy —
 * instead of each component re-reading thousands of rows on every edit.
 */
export type LifeRow = { id: string; type: string; deletedAt?: string | null; [key: string]: unknown };

let rows: LifeRow[] | undefined;
const listeners = new Set<() => void>();
let started = false;

function start() {
  if (started) return;
  started = true;
  liveQuery(() => db.lifeItems.toArray()).subscribe({
    next: (next) => {
      rows = next as unknown as LifeRow[];
      for (const listener of listeners) listener();
    },
    error: () => undefined,
  });
}

export function subscribeLifeRows(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLifeRows(): LifeRow[] | undefined {
  return rows;
}

/** Every row of the lifeItems table (undefined until the first read finishes). */
export function useLifeRows<T = LifeRow>(): T[] | undefined {
  return useSyncExternalStore(subscribeLifeRows, getLifeRows) as T[] | undefined;
}
