import { useLiveQuery } from 'dexie-react-hooks';
import { getAllCareEntries } from '@/db/repositories/careRepository';
import { computeGentleStats } from '@/shared/utils/stats';
import { getLocalDateKey } from '@/db/dateUtils';

export function useStats() {
  const allEntries = useLiveQuery(() => getAllCareEntries(), []) ?? [];
  return computeGentleStats(allEntries, getLocalDateKey());
}
