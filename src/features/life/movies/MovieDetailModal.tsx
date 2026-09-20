import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import StarRating from '@/shared/components/StarRating';
import ConfirmInline from '@/shared/components/ConfirmInline';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import type { MovieItem } from '@/db/schema';

interface MovieDetailModalProps {
  movie: MovieItem;
  onClose: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onLogRewatch: () => void;
}

export default function MovieDetailModal({ movie, onClose, onEdit, onToggleFavorite, onDelete, onLogRewatch }: MovieDetailModalProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const posterUrl = useLifeImageUrl(movie.posterImageId);
  const watchNumber = (movie.previousWatches?.length ?? 0) + 1;

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🎬" title={`${movie.title}${movie.year ? ` (${movie.year})` : ''}`} onClose={onClose} />

      <div className="flex gap-4">
        <div className="w-24 h-36 shrink-0 rounded-2xl overflow-hidden bg-sand-100 flex items-center justify-center">
          {posterUrl || movie.posterUrl ? (
            <img src={posterUrl ?? movie.posterUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">🎬</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {!!movie.rating && <StarRating value={Math.round(movie.rating)} size="sm" />}
          {movie.dateWatched && (
            <p className="text-xs text-sand-800/70">
              <span className="font-semibold text-sand-900">Watched:</span> {formatDisplayDate(movie.dateWatched)}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {watchNumber > 1 && (
              <span className="text-[10px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full">🔁 Watch #{watchNumber}</span>
            )}
            {movie.status === 'didNotFinish' && (
              <span className="text-[10px] bg-sand-200 text-sand-800 px-2 py-0.5 rounded-full">Did Not Finish</span>
            )}
            {movie.favorite && <span className="text-[10px] bg-terracotta-100 text-terracotta-600 px-2 py-0.5 rounded-full">♥ Favorite</span>}
            {movie.source === 'letterboxd' && (
              <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full">From Letterboxd</span>
            )}
          </div>
        </div>
      </div>

      {movie.review && (
        <div>
          <p className="font-semibold text-sand-900 text-xs mb-1">My thoughts</p>
          <p className="text-xs text-sand-800/80 whitespace-pre-wrap leading-relaxed">{movie.review}</p>
        </div>
      )}

      {movie.previousWatches && movie.previousWatches.length > 0 && (
        <div>
          <p className="font-semibold text-sand-900 text-xs mb-1.5">Earlier watches</p>
          <div className="space-y-1.5 text-xs">
            {movie.previousWatches.map((watch, i) => (
              <div key={watch.id} className="p-2.5 bg-sand-50 border border-sand-200 rounded-xl">
                <p className="text-sand-900 font-medium">
                  Watch #{i + 1}
                  {watch.dateWatched ? ` · ${formatDisplayDate(watch.dateWatched)}` : ''}
                  {watch.rating ? ` · ${watch.rating}★` : ''}
                </p>
                {watch.review && <p className="text-sand-800/70 mt-1">{watch.review}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {movie.letterboxdUri && (
        <a
          href={movie.letterboxdUri}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-sage-700 underline break-all"
        >
          View on Letterboxd ↗
        </a>
      )}

      <button onClick={onLogRewatch} className="w-full py-2.5 bg-sage-100 hover:bg-sage-300/40 text-sage-700 text-xs font-semibold rounded-2xl">
        🔁 Log a rewatch
      </button>

      <div className="flex gap-3 pt-2">
        <button onClick={onEdit} className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Edit
        </button>
        <button
          onClick={onToggleFavorite}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-2xl transition-colors ${
            movie.favorite ? 'bg-terracotta-100 text-terracotta-600' : 'bg-sand-100 hover:bg-sand-200 text-sand-900'
          }`}
        >
          {movie.favorite ? '♥ Favorited' : '♡ Favorite'}
        </button>
        <button onClick={() => setConfirmingDelete(true)} className="flex-1 py-2.5 bg-sand-100 hover:bg-terracotta-100 text-sand-900 hover:text-terracotta-600 text-xs font-semibold rounded-2xl">
          Delete
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmInline title="Delete this movie?" onConfirm={onDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </Modal>
  );
}
