import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ConfirmInline from '@/shared/components/ConfirmInline';
import { usePeriodEntries } from './usePeriodEntries';
import { createPeriodEntry, updatePeriodEntry, deletePeriodEntry } from '@/db/repositories/periodRepository';
import { formatDisplayDate, formatDisplayDateRange } from '@/shared/utils/formatDate';
import type { PeriodEntry } from '@/db/schema';
import PeriodEntryEditorModal from './PeriodEntryEditorModal';
import PeriodImportModal from './PeriodImportModal';

interface PeriodManagerModalProps {
  onClose: () => void;
  showToast: (msg: string) => void;
}

export default function PeriodManagerModal({ onClose, showToast }: PeriodManagerModalProps) {
  const { entries, stats } = usePeriodEntries();
  const [editing, setEditing] = useState<'closed' | 'new' | PeriodEntry>('closed');
  const [importing, setImporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🌙" title="Cycle Tracking" onClose={onClose} />

      <div className="p-4 bg-sand-50 border border-sand-200 rounded-2xl space-y-1.5 text-xs">
        {stats.cycleCount === 0 ? (
          <p className="text-sand-800/70">No cycles logged yet — add your first one below, or import your history.</p>
        ) : (
          <>
            {stats.predictedNextStart && (
              <p className="text-sand-900 font-semibold">
                Based on your own pattern, your next period might start around{' '}
                <span className="text-terracotta-600">{formatDisplayDate(stats.predictedNextStart)}</span>
                {typeof stats.daysUntilPredicted === 'number' && stats.daysUntilPredicted >= 0
                  ? ` (in about ${stats.daysUntilPredicted} day${stats.daysUntilPredicted === 1 ? '' : 's'})`
                  : ''}
                .
              </p>
            )}
            {stats.averageCycleLengthDays && (
              <p className="text-sand-800/70">Average cycle length: ~{stats.averageCycleLengthDays} days</p>
            )}
            {stats.averagePeriodLengthDays && (
              <p className="text-sand-800/70">Average period length: ~{stats.averagePeriodLengthDays} days</p>
            )}
            <p className="text-[10px] text-sand-800/50 pt-1">
              A pattern from your own history, not medical advice. {stats.cycleCount} cycle{stats.cycleCount === 1 ? '' : 's'} logged.
            </p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setEditing('new')}
          className="flex-1 py-2.5 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl"
        >
          + Log a Period
        </button>
        <button
          onClick={() => setImporting(true)}
          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl"
        >
          Import History
        </button>
      </div>

      {entries.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 p-3 bg-white border border-sand-200 rounded-2xl text-xs"
            >
              <div className="min-w-0">
                <p className="font-semibold text-sand-900">
                  {formatDisplayDateRange(entry.startDate, entry.endDate)}
                </p>
                <p className="text-[10px] text-sand-800/50">
                  {entry.flow ? `${entry.flow} flow · ` : ''}
                  {entry.source === 'import' ? `imported from ${entry.importSourceLabel ?? 'file'}` : 'logged manually'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setEditing(entry)} className="text-sand-800/60 hover:text-sand-900 px-2 py-1">
                  Edit
                </button>
                <button onClick={() => setConfirmDeleteId(entry.id)} className="text-sand-800/60 hover:text-terracotta-600 px-2 py-1">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== 'closed' && (
        <PeriodEntryEditorModal
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing('closed')}
          onSave={async (input) => {
            if (editing === 'new') {
              await createPeriodEntry({ ...input, source: 'manual' });
              showToast('Period logged 🌙');
            } else {
              await updatePeriodEntry(editing.id, input);
              showToast('Entry updated');
            }
            setEditing('closed');
          }}
        />
      )}

      {importing && (
        <PeriodImportModal
          onClose={() => setImporting(false)}
          onImported={(count) => {
            setImporting(false);
            showToast(count > 0 ? `Imported ${count} cycle entries` : 'Nothing new to import — already up to date');
          }}
        />
      )}

      {confirmDeleteId && (
        <ConfirmInline
          title="Delete this entry?"
          onConfirm={async () => {
            await deletePeriodEntry(confirmDeleteId);
            setConfirmDeleteId(null);
            showToast('Entry deleted');
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </Modal>
  );
}
