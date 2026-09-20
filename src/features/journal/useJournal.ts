import { useLiveQuery } from 'dexie-react-hooks';
import {
  getJournalEntries,
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from '@/db/repositories/journalRepository';

export function useJournal() {
  const entries = useLiveQuery(() => getJournalEntries(), []) ?? [];

  return {
    entries,
    createEntry: saveJournalEntry,
    updateEntry: updateJournalEntry,
    removeEntry: deleteJournalEntry,
  };
}
