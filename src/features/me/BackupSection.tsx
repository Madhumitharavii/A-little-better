import { useRef, useState } from 'react';
import { clearToolEvents } from '@/db/repositories/toolEventRepository';
import { useLifeRows } from '@/db/lifeStore';
import {
  exportAllData,
  downloadBackupFile,
  validateBackupFile,
  importAllData,
  type BackupValidationResult,
} from '@/db/repositories/backupRepository';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import type { BackupFile } from '@/db/schema';

interface BackupSectionProps {
  showToast: (msg: string) => void;
}

type PendingImport = { file: BackupFile; validation: BackupValidationResult };

export default function BackupSection({ showToast }: BackupSectionProps) {
  // "I'm bored" / "I'm scrolling" taps — kept only on this device, for Noticed for You.
  const tapCount = (useLifeRows() ?? []).filter((r) => r.type === 'toolEvent' && !r.deletedAt).length;
  const [confirmClearTaps, setConfirmClearTaps] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    const backup = await exportAllData();
    downloadBackupFile(backup);
    showToast('Backup downloaded safely 💾');
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const validation = validateBackupFile(parsed);
        if (!validation.valid) {
          setError(validation.errors.join(' '));
          return;
        }
        setPending({ file: parsed as BackupFile, validation });
      } catch {
        setError('This file could not be read as JSON.');
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!pending) return;
    setImporting(true);
    await importAllData(pending.file);
    setImporting(false);
    setPending(null);
    showToast('Data restored. Reloading…');
    setTimeout(() => window.location.reload(), 900);
  };

  return (
    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-300/50 space-y-3">
      <div>
        <p className="font-semibold text-sand-900 text-xs">Data Backup & Privacy</p>
        <p className="text-[11px] text-sand-800/60">Export or restore your private local data as a JSON file.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={handleExport} className="flex-1 px-3 py-2.5 bg-sand-900 text-white rounded-xl font-semibold text-xs">
          Export All Data
        </button>
        <label className="flex-1 text-center px-3 py-2.5 bg-sand-200 hover:bg-sand-300 text-sand-900 rounded-xl font-semibold text-xs cursor-pointer">
          Import from File
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChosen} className="hidden" />
        </label>
      </div>

      <div className="pt-2 border-t border-amber-300/40 space-y-2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-sand-900">"I'm bored" &amp; "I'm scrolling" taps</p>
            <p className="text-[11px] text-sand-800/60">
              {tapCount === 0 ? 'None saved.' : `${tapCount} saved, the same on all your devices. Noticed for You uses them to spot patterns.`}
            </p>
          </div>
          {tapCount > 0 && !confirmClearTaps && (
            <button
              onClick={() => setConfirmClearTaps(true)}
              className="shrink-0 px-3 py-2 bg-sand-200 hover:bg-sand-300 text-sand-900 rounded-xl font-semibold text-xs"
            >
              Clear taps
            </button>
          )}
        </div>
        {confirmClearTaps && (
          <div className="flex items-center gap-2 text-xs">
            <p className="flex-1 text-sand-800/80">Forget all {tapCount} taps, on every device? Your journal, care and everything else stay.</p>
            <button
              onClick={async () => {
                const n = await clearToolEvents();
                setConfirmClearTaps(false);
                showToast(`Forgot ${n} tap${n === 1 ? '' : 's'} 🧹`);
              }}
              className="px-3 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white rounded-xl font-semibold"
            >
              Clear
            </button>
            <button onClick={() => setConfirmClearTaps(false)} className="px-3 py-2 bg-sand-100 hover:bg-sand-200 text-sand-900 rounded-xl font-semibold">
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-terracotta-600 bg-terracotta-100 px-3 py-2 rounded-xl">{error}</p>}

      {pending && (
        <div className="p-3 bg-white border border-sand-300 rounded-2xl space-y-3 text-xs">
          <p className="font-semibold text-sand-900">This will replace all data currently on this device with:</p>
          <ul className="text-sand-800/80 space-y-0.5">
            <li>• {pending.validation.summary?.careEntries} care entries</li>
            <li>• {pending.validation.summary?.dailyReflections} daily reflections</li>
            <li>• {pending.validation.summary?.journalEntries} journal entries</li>
            <li>• {pending.validation.summary?.lifeItems} life items ({pending.validation.summary?.lifeImages} photos)</li>
            <li>• {pending.validation.summary?.people} people</li>
            <li>• {pending.validation.summary?.periodEntries} cycle entries</li>
          </ul>
          <p className="text-[11px] text-sand-800/60">Backup made: {formatDisplayDate(pending.validation.summary?.exportedAt)}</p>
          <p className="text-terracotta-600 font-semibold">Your current local data will be overwritten. This cannot be undone.</p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={confirmImport}
              disabled={importing}
              className="flex-1 py-2.5 bg-terracotta-600 hover:bg-terracotta-600/90 disabled:opacity-60 text-white font-semibold rounded-xl"
            >
              {importing ? 'Restoring…' : 'Yes, replace my data'}
            </button>
            <button
              onClick={() => setPending(null)}
              className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 font-semibold rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
