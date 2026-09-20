import { useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { MovieItem } from '@/db/schema';
import { createLifeItem, updateLifeItem } from '@/db/repositories/lifeRepository';
import {
  parseLetterboxdDiaryCsv,
  groupRowsByFilm,
  findExistingDuplicate,
  groupToNewMovieInput,
  mergeGroupIntoExisting,
  type GroupedLetterboxdFilm,
} from './letterboxdImport';

interface LetterboxdImportModalProps {
  existingMovies: MovieItem[];
  onClose: () => void;
  onImported: (count: number) => void;
}

interface ReviewRow {
  group: GroupedLetterboxdFilm;
  duplicate: MovieItem | undefined;
  selected: boolean;
}

export default function LetterboxdImportModal({ existingMovies, onClose, onImported }: LetterboxdImportModalProps) {
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
        const rows = parseLetterboxdDiaryCsv(text);
        if (rows.length === 0) {
          setError('No diary entries were found in this file.');
          return;
        }
        const groups = groupRowsByFilm(rows);
        setReviewRows(
          groups.map((group) => {
            const duplicate = findExistingDuplicate(group, existingMovies);
            return { group, duplicate, selected: true };
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
    for (const { group, duplicate, selected } of reviewRows) {
      if (!selected) continue;
      if (duplicate) {
        const patch = mergeGroupIntoExisting(duplicate, group);
        if (patch) {
          await updateLifeItem(duplicate.id, patch);
          count++;
        }
      } else {
        await createLifeItem({ type: 'movie', ...groupToNewMovieInput(group) });
        count++;
      }
    }
    setImporting(false);
    onImported(count);
  };

  const selectedCount = reviewRows?.filter((r) => r.selected).length ?? 0;

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🎞️" title="Import from Letterboxd" onClose={onClose} />

      {!reviewRows ? (
        <div className="space-y-4 text-xs">
          <p className="text-sand-800/80 leading-relaxed">
            On letterboxd.com, go to <strong>Settings → Data → Export Your Data</strong> to download a ZIP file.
            Unzip it and choose the <strong>diary.csv</strong> file from inside.
          </p>
          <p className="text-sand-800/60">
            This is a one-way import — nothing is sent anywhere, and your Letterboxd account is never contacted.
            You can re-run this any time; rewatches and repeat imports are merged, not duplicated.
          </p>

          <button
            onClick={() => inputRef.current?.click()}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 text-white font-semibold rounded-2xl"
          >
            Choose diary.csv
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
            Found {reviewRows.length} films ({reviewRows.reduce((s, r) => s + r.group.rows.length, 0)} watches
            total). Films already in your library will have new watches merged in rather than duplicated.
          </p>

          <div className="max-h-72 overflow-y-auto space-y-1.5 border border-sand-200 rounded-2xl p-2">
            {reviewRows.map((r, i) => (
              <label
                key={r.group.key}
                className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-sand-50 cursor-pointer"
              >
                <input type="checkbox" checked={r.selected} onChange={() => toggleRow(i)} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sand-900 truncate">
                    {r.group.title} {r.group.year ? `(${r.group.year})` : ''}
                  </p>
                  <p className="text-[10px] text-sand-800/60">
                    {r.group.rows.length} watch{r.group.rows.length === 1 ? '' : 'es'}
                    {r.duplicate ? ' · already in your library — will merge' : ''}
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
              {importing ? 'Importing…' : `Import ${selectedCount} film${selectedCount === 1 ? '' : 's'}`}
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
