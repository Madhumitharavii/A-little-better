import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { getLocalDateKey } from '@/db/dateUtils';
import DateField from '@/shared/components/DateField';
import type { JournalEntry } from '@/db/schema';

const MOODS = ['😊', '🙂', '😐', '😕', '😔'];

interface JournalEditorModalProps {
  existing?: JournalEntry;
  onClose: () => void;
  onSave: (input: { date: string; title?: string; body: string; mood?: string; tags?: string[] }) => void;
}

export default function JournalEditorModal({ existing, onClose, onSave }: JournalEditorModalProps) {
  const [date, setDate] = useState(existing?.date ?? getLocalDateKey());
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [mood, setMood] = useState(existing?.mood ?? '');
  const [tagsInput, setTagsInput] = useState(existing?.tags?.join(', ') ?? '');

  const handleSave = () => {
    if (!body.trim()) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({ date, title: title.trim() || undefined, body: body.trim(), mood: mood || undefined, tags: tags.length ? tags : undefined });
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="📝" title={existing ? 'Edit Entry' : 'New Journal Entry'} onClose={onClose} />

      <div className="space-y-4 text-xs">
        <DateField label="Date" value={date} onChange={setDate} />

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A few words..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">What's on your mind</label>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write freely, no structure required..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300 resize-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-2">Mood (optional)</label>
          <div className="flex gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(mood === m ? '' : m)}
                className={`w-11 h-11 text-xl rounded-2xl border transition-all ${
                  mood === m ? 'bg-slate-800 text-white border-slate-800 scale-105' : 'bg-sand-50 border-sand-200 hover:bg-sand-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Tags (optional, comma separated)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="books, grateful, work..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!body.trim()}
          className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl transition-all shadow-sm"
        >
          {existing ? 'Save Changes' : 'Save Entry'}
        </button>
        <button
          onClick={onClose}
          className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
