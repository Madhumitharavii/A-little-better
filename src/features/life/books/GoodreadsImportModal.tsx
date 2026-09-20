import { useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { BookItem } from '@/db/schema';
import { createLifeItem } from '@/db/repositories/lifeRepository';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { parseGoodreadsCsv, findExistingDuplicate, rowToBookInput, type ParsedGoodreadsRow } from './goodreadsImport';

interface GoodreadsImportModalProps {
  existingBooks: BookItem[];
  onClose: () => void;
  onImported: (count: number) => void;
}

interface ReviewRow {
  row: ParsedGoodreadsRow;
  duplicate: BookItem | undefined;
  selected: boolean;
}

const STATUS_LABEL: Record<ParsedGoodreadsRow['status'], string> = {
  finished: 'Finished',
  didNotFinish: 'Did Not Finish',
};

export default function GoodreadsImportModal({ existingBooks, onClose, onImported }: GoodreadsImportModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseGoodreadsCsv(text);
        if (rows.length === 0) {
          setError('No finished or did-not-finish books were found in this file.');
          return;
        }
        setReviewRows(
          rows.map((row) => {
            const duplicate = findExistingDuplicate(row, existingBooks);
            return { row, duplicate, selected: !duplicate };
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This file could not be read.');
      }
    };
    reader.readAsText(file);
  };

  const toggleRow = (index: number) => {
    setReviewRows((prev) => prev?.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)) ?? null);
  };

  const confirmImport = async () => {
    if (!reviewRows) return;
    setImporting(true);
    let count = 0;
    for (const { row, selected } of reviewRows) {
      if (!selected) continue;
      await createLifeItem({ type: 'book', ...rowToBookInput(row) });
      count++;
    }
    setImporting(false);
    onImported(count);
  };

  const selectedCount = reviewRows?.filter((r) => r.selected).length ?? 0;

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="📚" title="Import from Goodreads" onClose={onClose} />

      {!reviewRows ? (
        <div className="space-y-4 text-xs">
          <p className="text-sand-800/80 leading-relaxed">
            On goodreads.com, go to <strong>My Books → Import/Export → Export Library</strong> to download a CSV
            file of your books.
          </p>
          <p className="text-sand-800/60">
            This is a one-way import — nothing is sent anywhere, and your Goodreads account is never contacted.
            Only <strong>Read</strong> and <strong>Did Not Finish</strong> books are imported; "Want to Read" is
            skipped.
          </p>

          <button
            onClick={() => inputRef.current?.click()}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 text-white font-semibold rounded-2xl"
          >
            Choose Goodreads CSV
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
            Found {reviewRows.length} books. Likely duplicates are unchecked by default — review and adjust before
            importing.
          </p>

          <div className="max-h-72 overflow-y-auto space-y-1.5 border border-sand-200 rounded-2xl p-2">
            {reviewRows.map((r, i) => (
              <label
                key={`${r.row.title}-${r.row.author}-${i}`}
                className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-sand-50 cursor-pointer"
              >
                <input type="checkbox" checked={r.selected} onChange={() => toggleRow(i)} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sand-900 truncate">
                    {r.row.title} {r.row.author ? `— ${r.row.author}` : ''}
                  </p>
                  <p className="text-[10px] text-sand-800/60">
                    {STATUS_LABEL[r.row.status]}
                    {r.row.dateRead ? ` · ${formatDisplayDate(r.row.dateRead)}` : ''}
                    {r.duplicate ? ' · already in your library' : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={confirmImport}
              disabled={importing || selectedCount === 0}
              className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
            >
              {importing ? 'Importing…' : `Import ${selectedCount} book${selectedCount === 1 ? '' : 's'}`}
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
