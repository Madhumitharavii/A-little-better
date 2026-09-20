import { useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { parseCycleCsv, rowsToPeriodInputs } from './periodImport';
import { importPeriodEntries } from '@/db/repositories/periodRepository';

interface PeriodImportModalProps {
  onClose: () => void;
  onImported: (count: number) => void;
}

export default function PeriodImportModal({ onClose, onImported }: PeriodImportModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Flo');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingRows, setPendingRows] = useState<ReturnType<typeof rowsToPeriodInputs> | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCycleCsv(text);
        if (rows.length === 0) {
          setError('No dated entries were found in this file.');
          return;
        }
        const inputs = rowsToPeriodInputs(rows);
        setPendingRows(inputs);
        setPendingCount(inputs.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This file could not be read.');
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!pendingRows) return;
    setImporting(true);
    const imported = await importPeriodEntries(pendingRows, sourceLabel.trim() || 'Imported');
    setImporting(false);
    onImported(imported);
  };

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <ModalHeader icon="📥" title="Import Cycle History" onClose={onClose} />

      {pendingCount === null ? (
        <div className="space-y-4 text-xs">
          <p className="text-sand-800/80 leading-relaxed">
            This reads a CSV file with your period history — from Flo's data export, another app, or a spreadsheet
            you made yourself. Nothing is sent anywhere; the file stays on this device.
          </p>
          <p className="text-sand-800/60">
            The file needs a column for start date (e.g. "Start Date" or "Date"), and optionally one for end date.
          </p>

          <div>
            <label className="block font-semibold text-sand-900 mb-1">Where is this from?</label>
            <input
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="Flo, another app, a spreadsheet..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none"
            />
          </div>

          <button
            onClick={() => inputRef.current?.click()}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 text-white font-semibold rounded-2xl"
          >
            Choose CSV file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) handleFile(file);
            }}
          />

          {error && <p className="text-terracotta-600 bg-terracotta-100 px-3 py-2 rounded-xl">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-sand-800/80">
            Found {pendingCount} entries. Any dates you've already logged will be skipped automatically, so this is
            safe to run more than once.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={confirmImport}
              disabled={importing}
              className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
            >
              {importing ? 'Importing…' : `Import ${pendingCount} entries`}
            </button>
            <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 font-semibold rounded-2xl">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
