import type { JournalEntry } from '@/db/schema';
import Modal from '@/shared/components/Modal';
import { formatDisplayDate } from '@/shared/utils/formatDate';

const TOOL_LABELS: Record<string, string> = {
  procrastination: '🌱 Procrastination reset',
  overthinking: '🌊 Overthinking reset',
  temper: '🕊️ Temper & anger',
  selfDoubt: '🧭 Self-doubt inquiry',
  appearance: '🪞 Insecurity check',
};

interface Props {
  entry: JournalEntry;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** A whole journal entry, opened from the list. */
export default function JournalEntryModal({ entry, onClose, onEdit, onDelete }: Props) {
  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-sand-100 pb-3 -mt-1">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-terracotta-600">{formatDisplayDate(entry.date)}</p>
          {entry.title && <h3 className="serif text-xl text-sand-900 font-semibold">{entry.title}</h3>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {entry.mood && <span className="text-xl mr-1">{entry.mood}</span>}
          <button onClick={onClose} aria-label="Close" className="text-sand-800/60 hover:text-sand-900 text-sm font-semibold p-1">
            ✕
          </button>
        </div>
      </div>

      <p className="text-sm text-sand-800 whitespace-pre-wrap leading-relaxed">{entry.body}</p>

      {(entry.sourceTool || entry.tags?.length) && (
        <div className="flex items-center gap-2 flex-wrap">
          {entry.sourceTool && (
            <span className="text-[10px] bg-sand-100 text-sand-800/80 px-2 py-0.5 rounded-full font-medium">{TOOL_LABELS[entry.sourceTool] ?? entry.sourceTool}</span>
          )}
          {entry.tags?.map((tag) => (
            <span key={tag} className="text-[10px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onDelete} className="px-4 py-2 text-xs font-semibold text-sand-800/60 hover:text-terracotta-600">
          Delete
        </button>
        <button onClick={onEdit} className="px-4 py-2 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Edit
        </button>
      </div>
    </Modal>
  );
}
