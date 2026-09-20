import type { JournalEntry } from '@/db/schema';
import { formatDisplayDate } from '@/shared/utils/formatDate';

const TOOL_LABELS: Record<string, string> = {
  procrastination: '🌱 Procrastination reset',
  overthinking: '🌊 Overthinking reset',
  temper: '🕊️ Temper & anger',
  selfDoubt: '🧭 Self-doubt inquiry',
  appearance: '🪞 Insecurity check',
};

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
}

export default function JournalEntryCard({ entry, onEdit, onDelete }: JournalEntryCardProps) {
  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-sand-200 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-terracotta-600">
            {formatDisplayDate(entry.date)}
          </p>
          {entry.title && <h4 className="serif text-lg text-sand-900 font-semibold truncate">{entry.title}</h4>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entry.mood && <span className="text-lg">{entry.mood}</span>}
          <button
            onClick={onEdit}
            aria-label="Edit entry"
            className="text-sand-800/50 hover:text-sand-900 text-xs px-2 py-1.5"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete entry"
            className="text-sand-800/50 hover:text-terracotta-600 text-xs px-2 py-1.5"
          >
            Delete
          </button>
        </div>
      </div>

      <p className="text-sm text-sand-800 whitespace-pre-wrap leading-relaxed">{entry.body}</p>

      <div className="flex items-center gap-2 flex-wrap pt-1">
        {entry.sourceTool && (
          <span className="text-[10px] bg-sand-100 text-sand-800/80 px-2 py-0.5 rounded-full font-medium">
            {TOOL_LABELS[entry.sourceTool] ?? entry.sourceTool}
          </span>
        )}
        {entry.tags?.map((tag) => (
          <span key={tag} className="text-[10px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full font-medium">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}
