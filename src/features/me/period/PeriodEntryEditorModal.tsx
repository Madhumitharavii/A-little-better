import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import DateField from '@/shared/components/DateField';
import type { PeriodEntry } from '@/db/schema';
import { getLocalDateKey } from '@/db/dateUtils';

interface PeriodEntryEditorModalProps {
  existing?: PeriodEntry;
  onClose: () => void;
  onSave: (input: { startDate: string; endDate?: string; flow?: PeriodEntry['flow']; notes?: string }) => void;
}

const FLOW_OPTIONS: { value: NonNullable<PeriodEntry['flow']>; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];

export default function PeriodEntryEditorModal({ existing, onClose, onSave }: PeriodEntryEditorModalProps) {
  const [startDate, setStartDate] = useState(existing?.startDate ?? getLocalDateKey());
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [flow, setFlow] = useState<PeriodEntry['flow'] | undefined>(existing?.flow);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const handleSave = () => {
    if (!startDate) return;
    onSave({ startDate, endDate: endDate || undefined, flow, notes: notes.trim() || undefined });
  };

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <ModalHeader icon="🌙" title={existing ? 'Edit Entry' : 'Log a Period'} onClose={onClose} />

      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Started" value={startDate} onChange={setStartDate} />
          <DateField label="Ended (optional)" value={endDate} onChange={setEndDate} />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-2">Flow (optional)</label>
          <div className="flex gap-2">
            {FLOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFlow(flow === opt.value ? undefined : opt.value)}
                className={`flex-1 py-2 rounded-xl border font-medium transition-all ${
                  flow === opt.value ? 'bg-terracotta-400 text-white border-terracotta-400' : 'bg-sand-50 border-sand-200 text-sand-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!startDate}
          className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl shadow-sm"
        >
          {existing ? 'Save Changes' : 'Log Period'}
        </button>
        <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
