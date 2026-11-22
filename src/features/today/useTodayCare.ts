import { useToday } from '@/shared/hooks/useToday';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDailyReflection, saveDailyReflection } from '@/db/repositories/reflectionRepository';
import { useCareDay } from './useCareDay';

/**
 * Everything Today needs for the current local date, read live from
 * IndexedDB. There is no parallel React state to keep in sync — a
 * write goes straight to Dexie and the live query re-renders
 * automatically, so a refresh or app restart can never lose it.
 */
export function useTodayCare() {
  const date = useToday();
  const care = useCareDay(date);
  const reflection = useLiveQuery(() => getDailyReflection(date), [date]);

  const saveReflectionField = (field: 'gratitude' | 'smallWin', value: string) =>
    saveDailyReflection(date, { [field]: value });

  const saveEveningNotes = (notes: { goodThing: string; leaveTomorrow: string; mood: string }) =>
    saveDailyReflection(date, {
      eveningGoodThing: notes.goodThing,
      eveningLeaveForTomorrow: notes.leaveTomorrow,
      eveningMood: notes.mood,
      eveningDone: true,
    });

  return { ...care, date, reflection, saveReflectionField, saveEveningNotes };
}
