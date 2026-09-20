import { useState } from 'react';
import { saveJournalEntry } from '@/db/repositories/journalRepository';
import type { SourceTool } from '@/db/schema';

interface ToolEndingProps {
  date: string;
  sourceTool: Exclude<SourceTool, null>;
  /** The compiled reflection text — only ever written to storage if the person taps Save. */
  body: string;
  title?: string;
  closingLine?: string;
  onClose: () => void;
  showToast: (msg: string) => void;
}

/**
 * The ending every reflection tool shares. Nothing here is saved
 * automatically — closing a tool without tapping "Save" leaves no
 * trace, by design (ephemeral by default, per product spec).
 */
export default function ToolEnding({
  date,
  sourceTool,
  body,
  title,
  closingLine = "That's enough for now.",
  onClose,
  showToast,
}: ToolEndingProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await saveJournalEntry({ date, title, body, sourceTool });
    showToast('Saved to your Journal 📝');
    onClose();
  };

  return (
    <div className="text-center py-4 space-y-6">
      <p className="text-sm font-semibold text-sand-900">{closingLine}</p>
      <p className="text-xs text-sand-800/70 max-w-sm mx-auto">
        You can leave this here, or keep a note of it in your Journal. Nothing is saved unless you choose to.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 sm:flex-none px-5 py-2.5 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-60 text-white text-xs font-semibold rounded-2xl shadow-sm transition-colors"
        >
          {saving ? 'Saving…' : 'Save this reflection to Journal'}
        </button>
        <button
          onClick={onClose}
          className="flex-1 sm:flex-none px-5 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
