import { useState } from 'react';
import { useJournal } from './useJournal';
import JournalEntryCard from './JournalEntryCard';
import JournalEditorModal from './JournalEditorModal';
import type { JournalEntry } from '@/db/schema';

interface JournalPageProps {
  showToast: (msg: string) => void;
}

export default function JournalPage({ showToast }: JournalPageProps) {
  const { entries, createEntry, updateEntry, removeEntry } = useJournal();
  const [editorState, setEditorState] = useState<'closed' | 'new' | JournalEntry>('closed');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-3">
        <div>
          <h2 className="serif text-2xl font-semibold text-sand-900">Journal</h2>
          <p className="text-xs text-sand-800/60">Write whenever it helps. There's no streak here to keep.</p>
        </div>
        <button
          onClick={() => setEditorState('new')}
          className="px-4 py-2.5 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm transition-colors shrink-0"
        >
          + New Entry
        </button>
      </section>

      {entries.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">📝</span>
          <p className="text-sm text-sand-800/70">Nothing here yet — and that's alright.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => setEditorState(entry)}
              onDelete={() => setConfirmDeleteId(entry.id)}
            />
          ))}
        </div>
      )}

      {editorState !== 'closed' && (
        <JournalEditorModal
          existing={editorState === 'new' ? undefined : editorState}
          onClose={() => setEditorState('closed')}
          onSave={async (input) => {
            if (editorState === 'new') {
              await createEntry(input);
              showToast('Journal entry saved 📝');
            } else {
              await updateEntry(editorState.id, input);
              showToast('Entry updated');
            }
            setEditorState('closed');
          }}
        />
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 bg-sand-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-sand-200 space-y-4">
            <h3 className="serif text-lg font-semibold text-sand-900">Delete this entry?</h3>
            <p className="text-xs text-sand-800/70">This can't be undone from within the app.</p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await removeEntry(confirmDeleteId);
                  setConfirmDeleteId(null);
                  showToast('Entry deleted');
                }}
                className="flex-1 py-2.5 bg-terracotta-600 hover:bg-terracotta-600/90 text-white text-xs font-semibold rounded-2xl"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl"
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
