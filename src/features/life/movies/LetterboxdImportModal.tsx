import { useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { MovieItem } from '@/db/schema';
import { bulkCreateLifeItems, updateLifeItem } from '@/db/repositories/lifeRepository';
import { classifyExportFile, parseLetterboxdExport, planImport, type ExportFile, type ImportPlan } from './letterboxdImport';

interface LetterboxdImportModalProps {
  existingMovies: MovieItem[];
  onClose: () => void;
  onImported: (count: number) => void;
}

/** The folder picker attribute isn't in React's types. */
const folderPickerProps = { webkitdirectory: '', directory: '' } as Record<string, string>;

export default function LetterboxdImportModal({ existingMovies, onClose, onImported }: LetterboxdImportModalProps) {
  const folderRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    setError(null);
    const picked = Array.from(fileList ?? []).filter((f) => {
      const path = f.webkitRelativePath || f.name;
      return classifyExportFile(path) !== null;
    });
    if (picked.length === 0) {
      setError("No Letterboxd files found. Choose the unzipped export folder (the one with diary.csv, watched.csv, watchlist.csv…).");
      return;
    }
    setBusy('Reading your export…');
    try {
      const files: ExportFile[] = await Promise.all(picked.map(async (f) => ({ path: f.webkitRelativePath || f.name, text: await f.text() })));
      const exp = parseLetterboxdExport(files);
      if (exp.films.length === 0) {
        setError('No films were found in these files.');
        return;
      }
      setPlan(planImport(exp, existingMovies));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'These files could not be read.');
    } finally {
      setBusy(null);
    }
  };

  const confirmImport = async () => {
    if (!plan) return;
    setBusy('Importing…');
    try {
      const created = plan.creates.length ? await bulkCreateLifeItems(plan.creates) : 0;
      for (const { id, patch } of plan.updates) await updateLifeItem(id, patch);
      onImported(created + plan.updates.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import could not be completed.');
      setBusy(null);
    }
  };

  const s = plan?.summary;
  const n = (x: number) => x.toLocaleString();

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🎞️" title="Import from Letterboxd" onClose={onClose} />

      {!plan ? (
        <div className="space-y-4 text-xs">
          <ol className="text-sand-800/80 leading-relaxed list-decimal pl-4 space-y-1">
            <li>
              On letterboxd.com: <strong>Settings → Data → Export Your Data</strong>.
            </li>
            <li>Unzip the downloaded file (double-click it).</li>
            <li>
              Choose the <strong>whole unzipped folder</strong> below.
            </li>
          </ol>
          <p className="text-sand-800/60 leading-relaxed">
            Brings in your diary, every film you've marked watched, reviews, ratings, liked films (as ♥ favorites), your
            watchlist and your lists. Nothing is sent anywhere and Letterboxd is never contacted. Safe to re-run — it merges,
            never duplicates.
          </p>

          <button
            onClick={() => folderRef.current?.click()}
            disabled={!!busy}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
          >
            {busy ?? 'Choose the export folder'}
          </button>
          <button
            onClick={() => filesRef.current?.click()}
            disabled={!!busy}
            className="w-full py-2 text-sand-800/70 hover:text-sand-900 underline underline-offset-2"
          >
            Or choose individual files (e.g. just diary.csv)
          </button>
          <input
            ref={folderRef}
            type="file"
            className="hidden"
            {...folderPickerProps}
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={filesRef}
            type="file"
            multiple
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {error && <p className="text-terracotta-600 bg-terracotta-100 px-3 py-2 rounded-xl">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          <p className="text-sand-800/80">Here's what was found:</p>
          <ul className="grid grid-cols-2 gap-2">
            {[
              ['🎬', `${n(s!.watched)} films watched`, `${n(s!.dated)} with dates · ${n(s!.watches)} logged watches`],
              ['✍️', `${n(s!.reviews)} reviews`, 'attached to the watch they belong to'],
              ['♥', `${n(s!.favorites)} liked films`, 'marked as favorites'],
              ['🍿', `${n(s!.watchlist)} on your watchlist`, 'kept separate from what you watched'],
              ['📋', `${s!.lists.length} list${s!.lists.length === 1 ? '' : 's'}`, s!.lists.join(' · ') || '—'],
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
            <strong>{n(s!.newFilms)}</strong> new {s!.newFilms === 1 ? 'film' : 'films'} will be added
            {s!.updatedFilms > 0 && (
              <>
                , <strong>{n(s!.updatedFilms)}</strong> already in your library will be updated
              </>
            )}
            {s!.unchangedFilms > 0 && <> ({n(s!.unchangedFilms)} already up to date)</>}.
          </p>

          {error && <p className="text-terracotta-600 bg-terracotta-100 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={confirmImport}
              disabled={!!busy || s!.newFilms + s!.updatedFilms === 0}
              className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
            >
              {busy ?? (s!.newFilms + s!.updatedFilms === 0 ? 'Everything is up to date' : 'Import')}
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
