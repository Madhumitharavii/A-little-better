import { useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { getPeriodEntries, importPeriodEntries } from '@/db/repositories/periodRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { parseCycleFile, planPeriodImport, type ParsedCycleFile, type PeriodImportPlan } from './floImport';

interface PeriodImportModalProps {
  onClose: () => void;
  onImported: (count: number) => void;
}

export default function PeriodImportModal({ onClose, onImported }: PeriodImportModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Flo');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedCycleFile | null>(null);
  const [plan, setPlan] = useState<PeriodImportPlan | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (/\.zip$/i.test(file.name)) {
      setError("That's the ZIP from Flo. Double-click it on your Mac, enter the password from Flo's second email, then choose the .json file inside.");
      return;
    }
    setBusy(true);
    try {
      const result = parseCycleFile(await file.text(), getLocalDateKey());
      if (result.periods.length === 0) {
        setError('No periods were found in this file.');
        return;
      }
      if (result.format === 'csv' && sourceLabel === 'Flo') setSourceLabel('');
      setParsed(result);
      setPlan(planPeriodImport(result.periods, await getPeriodEntries()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!plan) return;
    setBusy(true);
    const imported = await importPeriodEntries(plan.creates, sourceLabel.trim() || 'Imported');
    setBusy(false);
    onImported(imported);
  };

  const s = plan?.summary;
  const adjustments = parsed ? Object.entries(parsed.adjustments) : [];
  const events = parsed ? Object.entries(parsed.events).sort((a, b) => b[1] - a[1]) : [];

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-md">
      <ModalHeader icon="📥" title="Import Cycle History" onClose={onClose} />

      {!plan ? (
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5 text-sand-800/80 leading-relaxed">
            <p className="font-semibold text-sand-900">From Flo</p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>
                In Flo: <strong>Profile → Help → Contact us</strong>, and ask for your data as <strong>JSON</strong>.
              </li>
              <li>They email a ZIP, with its password in a separate email. Double-click the ZIP and enter the password.</li>
              <li>
                Choose the <strong>.json</strong> file from inside.
              </li>
            </ol>
            <p className="text-sand-800/60 pt-1">Or choose a CSV from another app or a spreadsheet (a "Start Date" column, optionally "End Date").</p>
          </div>
          <p className="text-sand-800/60">Nothing is sent anywhere. You'll see what was found before anything is saved.</p>

          <div>
            <label className="block font-semibold text-sand-900 mb-1" htmlFor="period-source">
              Where is this from?
            </label>
            <input
              id="period-source"
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="Flo, another app, a spreadsheet..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none"
            />
          </div>

          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
          >
            {busy ? 'Reading…' : 'Choose file (Flo .json, .txt or .csv)'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.txt,.csv,application/json,text/plain,text/csv,.zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />

          {error && <p className="text-terracotta-600 bg-terracotta-100 px-3 py-2 rounded-xl leading-relaxed">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-sand-800/80">
            Found <strong>{s!.found}</strong> period{s!.found === 1 ? '' : 's'}
            {s!.first && s!.last ? ` from ${formatDisplayDate(s!.first)} to ${formatDisplayDate(s!.last)}` : ''}.
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {[
              ['🩸', `${s!.new} new`, s!.alreadyLogged ? `${s!.alreadyLogged} already logged, skipped` : 'none already logged'],
              ['🔄', s!.typicalCycle ? `${s!.typicalCycle}-day cycles` : 'Cycle length', s!.typicalCycle ? 'typical (median)' : 'not enough to tell'],
              ['📅', s!.typicalPeriod ? `${s!.typicalPeriod}-day periods` : 'Period length', s!.typicalPeriod ? 'typical (median)' : 'no end dates'],
              ['💧', `${s!.withFlow} with flow level`, s!.withFlow ? 'from your logged flow' : "Flo's export usually has none"],
            ].map(([icon, title, sub]) => (
              <li key={title} className="bg-sand-100 rounded-2xl p-3">
                <p className="font-semibold text-sand-900">
                  {icon} {title}
                </p>
                <p className="text-[10px] text-sand-800/60 mt-0.5">{sub}</p>
              </li>
            ))}
          </ul>

          {adjustments.length > 0 && (
            <div className="text-[11px] text-sand-800/70 space-y-0.5">
              <p className="font-semibold text-sand-900">Small fixes while reading</p>
              {adjustments.map(([what, n]) => (
                <p key={what}>
                  • {what}: {n}
                </p>
              ))}
            </div>
          )}

          {events.length > 0 && (
            <details className="text-[11px] text-sand-800/70">
              <summary className="cursor-pointer font-semibold text-sand-900">
                Also in the file: {events.reduce((n, [, c]) => n + c, 0)} logged events (not imported yet)
              </summary>
              <div className="mt-1.5 max-h-40 overflow-y-auto space-y-0.5">
                {events.map(([what, n]) => (
                  <p key={what}>
                    • {what}: {n}
                  </p>
                ))}
              </div>
            </details>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={confirmImport}
              disabled={busy || s!.new === 0}
              className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
            >
              {busy ? 'Importing…' : s!.new === 0 ? 'Everything is already logged' : `Import ${s!.new} period${s!.new === 1 ? '' : 's'}`}
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
