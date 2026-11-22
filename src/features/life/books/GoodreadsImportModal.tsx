import { useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { BookItem } from '@/db/schema';
import { bulkCreateLifeItems, bulkUpdateLifeItems } from '@/db/repositories/lifeRepository';
import { parseGoodreadsCsv, planGoodreadsImport, type GoodreadsPlan } from './goodreadsImport';

interface GoodreadsImportModalProps {
  existingBooks: BookItem[];
  onClose: () => void;
  onImported: (count: number) => void;
}

export default function GoodreadsImportModal({ existingBooks, onClose, onImported }: GoodreadsImportModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [plan, setPlan] = useState<GoodreadsPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setBusy('Reading your library…');
    try {
      const rows = parseGoodreadsCsv(await file.text());
      if (rows.length === 0) setError('No books were found in this file.');
      else setPlan(planGoodreadsImport(rows, existingBooks));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This file could not be read.');
    } finally {
      setBusy(null);
    }
  };

  const confirmImport = async () => {
    if (!plan) return;
    setBusy('Importing…');
    try {
      const created = plan.creates.length ? await bulkCreateLifeItems(plan.creates) : 0;
      await bulkUpdateLifeItems(plan.updates);
      onImported(created + plan.updates.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import could not be completed.');
      setBusy(null);
    }
  };

  const s = plan?.summary;
  const n = (x: number) => x.toLocaleString();
  const nothingToDo = !!s && s.newBooks + s.updatedBooks === 0;

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="📚" title="Import from Goodreads" onClose={onClose} />

      {!plan ? (
        <div className="space-y-4 text-xs">
          <ol className="text-sand-800/80 leading-relaxed list-decimal pl-4 space-y-1">
            <li>
              On goodreads.com: <strong>My Books → Import and export → Export Library</strong>.
            </li>
            <li>When the link appears, download <strong>goodreads_library_export.csv</strong>.</li>
            <li>Choose that file below.</li>
          </ol>
          <p className="text-sand-800/60 leading-relaxed">
            Brings in books you've read, are reading and want to read, with ratings, dates, reviews, rereads, your
            favorites shelf (as ♥) and custom shelves. Nothing is sent anywhere and Goodreads is never contacted. Safe to
            re-run — it fills in what's new and never duplicates.
          </p>

          <button
            onClick={() => inputRef.current?.click()}
            disabled={!!busy}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
          >
            {busy ?? 'Choose the Goodreads CSV'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleFile(file);
            }}
          />

          {error && <p className="text-terracotta-600 bg-terracotta-100 px-3 py-2 rounded-xl">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-sand-800/80">Here's what was found:</p>
          <ul className="grid grid-cols-2 gap-2">
            {[
              ['📗', `${n(s!.finished)} read`, s!.rereads ? `${n(s!.rereads)} read more than once` : 'with your dates and ratings'],
              ['📖', `${n(s!.reading)} reading now`, 'in the Reading tab'],
              ['🔖', `${n(s!.wantTo)} want to read`, 'kept separate from what you read'],
              ['✍️', `${n(s!.reviews)} reviews & notes`, 'kept as your notes'],
              ['♥', `${n(s!.favorites)} favorites`, 'from your favorites shelf'],
              ['🗂️', `${s!.shelves.length} custom shelves`, s!.shelves.slice(0, 4).join(' · ') + (s!.shelves.length > 4 ? ' …' : '') || '—'],
              ...(s!.didNotFinish ? [['⏸️', `${n(s!.didNotFinish)} did not finish`, 'from a dnf / abandoned shelf']] : []),
            ].map(([icon, title, sub]) => (
              <li key={title} className="bg-sand-100 rounded-2xl p-3">
                <p className="font-semibold text-sand-900">
                  {icon} {title}
                </p>
                <p className="text-[10px] text-sand-800/60 mt-0.5">{sub}</p>
              </li>
            ))}
          </ul>
          <p className="text-sand-800/70">
            <strong>{n(s!.newBooks)}</strong> new {s!.newBooks === 1 ? 'book' : 'books'} will be added
            {s!.updatedBooks > 0 && (
              <>
                , <strong>{n(s!.updatedBooks)}</strong> already in your library will be filled in
              </>
            )}
            {s!.unchangedBooks > 0 && <> ({n(s!.unchangedBooks)} already up to date)</>}.
          </p>

          {error && <p className="text-terracotta-600 bg-terracotta-100 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={confirmImport}
              disabled={!!busy || nothingToDo}
              className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
            >
              {busy ?? (nothingToDo ? 'Everything is up to date' : 'Import')}
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
