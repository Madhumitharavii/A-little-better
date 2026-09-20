import { useLiveQuery } from 'dexie-react-hooks';
import { getPeriodEntries } from '@/db/repositories/periodRepository';
import { computeCycleStats } from '@/shared/utils/cycle';

export function usePeriodEntries() {
  const entries = useLiveQuery(() => getPeriodEntries(), []) ?? [];
  const stats = computeCycleStats(entries);
  return { entries, stats };
}
