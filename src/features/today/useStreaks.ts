import { useLiveQuery } from 'dexie-react-hooks';
import { getAllCareEntries } from '@/db/repositories/careRepository';
import { calculateStreaks } from '@/shared/utils/streaks';
import { getLocalDateKey } from '@/db/dateUtils';

export function useStreaks() {
  const allEntries = useLiveQuery(() => getAllCareEntries(), []) ?? [];
  return calculateStreaks(allEntries, getLocalDateKey());
}
