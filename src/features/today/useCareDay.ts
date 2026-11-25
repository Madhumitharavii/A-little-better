import { useLiveQuery } from 'dexie-react-hooks';
import { getDailyCare, saveCareEntry, addMinutesToCareEntry, clearCareEntry } from '@/db/repositories/careRepository';
import type { CareEntry, CareItemKey } from '@/db/schema';

/**
 * The care ticks for one day, read live from IndexedDB, and the ways to
 * change them. Today's page uses it for today — and for yesterday, so
 * something done just before midnight can still be ticked after it.
 */
export function useCareDay(date: string) {
  const careEntries = useLiveQuery(() => getDailyCare(date), [date]) ?? [];

  const findEntry = (itemKey: CareItemKey): CareEntry | undefined => careEntries.find((e) => e.itemKey === itemKey);

  const markDone = (itemKey: CareItemKey) => saveCareEntry({ date, itemKey, status: 'done' });

  const markSkipped = (itemKey: CareItemKey, reason: string) =>
    saveCareEntry({ date, itemKey, status: 'skipped', skipReason: reason });

  /** Returns false when it refused to untick (reading/focus with minutes logged — unticking would delete them). */
  const toggleDone = (itemKey: CareItemKey): boolean => {
    const existing = findEntry(itemKey);
    if (existing?.status === 'done') {
      if ((itemKey === 'reading' || itemKey === 'focus') && (existing.valueMinutes ?? 0) > 0) return false;
      void clearCareEntry(date, itemKey);
    } else {
      void markDone(itemKey);
    }
    return true;
  };

  const addMinutes = (itemKey: Extract<CareItemKey, 'reading' | 'focus'>, minutes: number) =>
    addMinutesToCareEntry(date, itemKey, minutes);

  const clear = (itemKey: CareItemKey) => clearCareEntry(date, itemKey);

  return { date, careEntries, findEntry, markDone, markSkipped, toggleDone, addMinutes, clear };
}
