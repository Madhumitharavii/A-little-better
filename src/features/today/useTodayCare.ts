import { useLiveQuery } from 'dexie-react-hooks';
import { getLocalDateKey } from '@/db/dateUtils';
import {
  getDailyCare,
  saveCareEntry,
  addMinutesToCareEntry,
  clearCareEntry,
} from '@/db/repositories/careRepository';
import { getDailyReflection, saveDailyReflection } from '@/db/repositories/reflectionRepository';
import type { CareEntry, CareItemKey } from '@/db/schema';

/**
 * Everything Today needs for the current local date, read live from
 * IndexedDB. There is no parallel React state to keep in sync — a
 * write goes straight to Dexie and the live query re-renders
 * automatically, so a refresh or app restart can never lose it.
 */
export function useTodayCare() {
  const date = getLocalDateKey();

  const careEntries = useLiveQuery(() => getDailyCare(date), [date]) ?? [];
  const reflection = useLiveQuery(() => getDailyReflection(date), [date]);

  const findEntry = (itemKey: CareItemKey): CareEntry | undefined =>
    careEntries.find((e) => e.itemKey === itemKey);

  const markDone = (itemKey: CareItemKey) => saveCareEntry({ date, itemKey, status: 'done' });

  const markSkipped = (itemKey: CareItemKey, reason: string) =>
    saveCareEntry({ date, itemKey, status: 'skipped', skipReason: reason });

  const clearItem = (itemKey: CareItemKey) => clearCareEntry(date, itemKey);

  const toggleDone = (itemKey: CareItemKey) => {
    const existing = findEntry(itemKey);
    if (existing?.status === 'done') {
      clearItem(itemKey);
    } else {
      markDone(itemKey);
    }
  };

  const addMinutes = (itemKey: Extract<CareItemKey, 'reading' | 'focus'>, minutes: number) =>
    addMinutesToCareEntry(date, itemKey, minutes);

  const saveReflectionField = (field: 'gratitude' | 'smallWin', value: string) =>
    saveDailyReflection(date, { [field]: value });

  const saveEveningNotes = (notes: { goodThing: string; leaveTomorrow: string; mood: string }) =>
    saveDailyReflection(date, {
      eveningGoodThing: notes.goodThing,
      eveningLeaveForTomorrow: notes.leaveTomorrow,
      eveningMood: notes.mood,
      eveningDone: true,
    });

  return {
    date,
    careEntries,
    reflection,
    findEntry,
    markDone,
    markSkipped,
    toggleDone,
    addMinutes,
    saveReflectionField,
    saveEveningNotes,
  };
}
