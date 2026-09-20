import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import StarRating from '@/shared/components/StarRating';
import ImagePicker from '@/shared/components/ImagePicker';
import DateField from '@/shared/components/DateField';
import type { MovieItem, MovieStatus } from '@/db/schema';

interface MovieEditorModalProps {
  existing?: MovieItem;
  onClose: () => void;
  onSave: (input: Omit<MovieItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type'>) => void;
}

export default function MovieEditorModal({ existing, onClose, onSave }: MovieEditorModalProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [year, setYear] = useState(existing?.year ? String(existing.year) : '');
  const [posterImageId, setPosterImageId] = useState(existing?.posterImageId);
  const [dateWatched, setDateWatched] = useState(existing?.dateWatched ?? '');
  const [status, setStatus] = useState<MovieStatus | undefined>(existing?.status);
  const [rating, setRating] = useState<number | undefined>(existing?.rating ? Math.round(existing.rating) : undefined);
  const [review, setReview] = useState(existing?.review ?? '');
  const [rewatch, setRewatch] = useState(existing?.rewatch ?? false);
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      year: year ? Number(year) : undefined,
      posterImageId,
      dateWatched: dateWatched || undefined,
      status,
      rating,
      review: review.trim() || undefined,
      rewatch,
      favorite,
      tags: existing?.tags,
      letterboxdUri: existing?.letterboxdUri,
      imdbId: existing?.imdbId,
      tmdbId: existing?.tmdbId,
      source: existing?.source ?? 'manual',
    });
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🎬" title={existing ? 'Edit Movie' : 'Add a Movie'} onClose={onClose} />

      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-[1fr,100px] gap-3">
          <div>
            <label className="block font-semibold text-sand-900 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Movie title"
              className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300"
            />
          </div>
          <div>
            <label className="block font-semibold text-sand-900 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2026"
              className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none"
            />
          </div>
        </div>

        <ImagePicker imageId={posterImageId} onChange={setPosterImageId} label="Poster (optional)" aspectClassName="aspect-[2/3] max-w-[140px]" />

        <DateField label="Watched on" value={dateWatched} onChange={setDateWatched} />

        <div>
          <label className="block font-semibold text-sand-900 mb-1.5">Rating — a personal record, not a grade</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <button
          type="button"
          onClick={() => setStatus(status === 'didNotFinish' ? undefined : 'didNotFinish')}
          className={`w-full py-2.5 rounded-2xl border font-semibold transition-all ${
            status === 'didNotFinish' ? 'bg-sand-900 text-white border-sand-900' : 'bg-sand-50 border-sand-200 text-sand-800'
          }`}
        >
          {status === 'didNotFinish' ? '✓ Marked as Did Not Finish' : 'Mark as Did Not Finish'}
        </button>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">My thoughts</label>
          <textarea
            rows={3}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="What stuck with you..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRewatch((r) => !r)}
            className={`flex-1 py-2.5 rounded-2xl border font-semibold transition-all ${
              rewatch ? 'bg-sand-900 text-white border-sand-900' : 'bg-sand-50 border-sand-200 text-sand-800'
            }`}
          >
            {rewatch ? '🔁 Rewatch' : 'First watch'}
          </button>
          <button
            type="button"
            onClick={() => setFavorite((f) => !f)}
            className={`flex-1 py-2.5 rounded-2xl border font-semibold transition-all flex items-center justify-center gap-2 ${
              favorite ? 'bg-terracotta-100 border-terracotta-400/40 text-terracotta-600' : 'bg-sand-50 border-sand-200 text-sand-800'
            }`}
          >
            <span>{favorite ? '♥' : '♡'}</span> Favorite
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl transition-all shadow-sm"
        >
          {existing ? 'Save Changes' : 'Add Movie'}
        </button>
        <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
