import type { JournalEntry } from '@/db/schema';
import { formatDisplayDate } from '@/shared/utils/formatDate';

/** One entry in the list: just the date, the title if it has one, and its mood. Tap to read it. */
export default function JournalEntryRow({ entry, onOpen }: { entry: JournalEntry; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white px-4 py-3 rounded-2xl border border-sand-200 border-l-4 border-l-slate-500/50 shadow-sm hover:border-sand-300 transition-colors flex items-center justify-between gap-3"
    >
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wider font-semibold text-terracotta-600">{formatDisplayDate(entry.date)}</span>
        {entry.title && <span className="block serif text-base text-sand-900 font-semibold truncate">{entry.title}</span>}
      </span>
      {entry.mood && <span className="text-xl shrink-0">{entry.mood}</span>}
    </button>
  );
}
