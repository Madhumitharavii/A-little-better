import { useLiveQuery } from 'dexie-react-hooks';
import { getPeople } from '@/db/repositories/peopleRepository';

/** Live list of My People (updates automatically on add/edit/sync). */
export function usePeople() {
  return useLiveQuery(() => getPeople(), []) ?? [];
}
