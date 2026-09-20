import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import StarRating from '@/shared/components/StarRating';
import ConfirmInline from '@/shared/components/ConfirmInline';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { formatDisplayDate, formatDisplayDateRange } from '@/shared/utils/formatDate';
import type { BookItem } from '@/db/schema';

const STATUS_LABEL: Record<NonNullable<BookItem['status']>, string> = {
  wantTo: 'Want to Read',
  inProgress: 'Currently Reading',
  finished: 'Finished',
  didNotFinish: 'Did Not Finish',
};

interface BookDetailModalProps {
  book: BookItem;
  onClose: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onLogReread: () => void;
}

export default function BookDetailModal({ book, onClose, onEdit, onToggleFavorite, onDelete, onLogReread }: BookDetailModalProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const coverUrl = useLifeImageUrl(book.coverImageId);
  const readingNumber = (book.previousReadings?.length ?? 0) + 1;

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="📖" title={book.title} onClose={onClose} />

      <div className="flex gap-4">
        <div className="w-24 h-36 shrink-0 rounded-2xl overflow-hidden bg-sand-100 flex items-center justify-center">
          {coverUrl || book.coverUrl ? (
            <img src={coverUrl ?? book.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">📖</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {book.author && <p className="text-sm text-sand-800/80">{book.author}</p>}
          {book.status && (
            <span className="inline-block text-[11px] bg-sand-100 text-sand-800/80 px-2.5 py-0.5 rounded-full font-medium">
              {STATUS_LABEL[book.status]}
            </span>
          )}
          {readingNumber > 1 && (
            <span className="inline-block text-[11px] bg-sage-100 text-sage-700 px-2.5 py-0.5 rounded-full font-medium ml-1">
              🔁 Reading #{readingNumber}
            </span>
          )}
          {!!book.rating && <StarRating value={book.rating} size="sm" />}
          {book.favorite && <p className="text-terracotta-600 text-xs">♥ Favorite</p>}
        </div>
      </div>

      <div className="space-y-3 text-xs">
        {(book.dateStarted || book.dateFinished) && (
          <div className="grid grid-cols-2 gap-3">
            {book.dateStarted && (
              <div>
                <p className="font-semibold text-sand-900">Started</p>
                <p className="text-sand-800/70">{formatDisplayDate(book.dateStarted)}</p>
              </div>
            )}
            {book.dateFinished && (
              <div>
                <p className="font-semibold text-sand-900">Finished</p>
                <p className="text-sand-800/70">{formatDisplayDate(book.dateFinished)}</p>
              </div>
            )}
          </div>
        )}

        {book.notes && (
          <div>
            <p className="font-semibold text-sand-900 mb-1">My thoughts</p>
            <p className="text-sand-800/80 whitespace-pre-wrap leading-relaxed">{book.notes}</p>
          </div>
        )}

        {book.quote && (
          <div className="p-3 bg-sand-50 border border-sand-200 rounded-2xl">
            <p className="font-semibold text-sand-900 mb-1">Favorite quote</p>
            <p className="text-sand-800/80 italic whitespace-pre-wrap">"{book.quote}"</p>
          </div>
        )}

        {book.previousReadings && book.previousReadings.length > 0 && (
          <div>
            <p className="font-semibold text-sand-900 mb-1.5">Earlier readings</p>
            <div className="space-y-1.5">
              {book.previousReadings.map((reading, i) => (
                <div key={reading.id} className="p-2.5 bg-sand-50 border border-sand-200 rounded-xl">
                  <p className="text-sand-900 font-medium">
                    Reading #{i + 1}
                    {reading.status ? ` · ${STATUS_LABEL[reading.status]}` : ''}
                  </p>
                  <p className="text-[10px] text-sand-800/60">
                    {formatDisplayDateRange(reading.dateStarted, reading.dateFinished)}
                    {reading.rating ? ` · ${reading.rating}★` : ''}
                  </p>
                  {reading.notes && <p className="text-sand-800/70 mt-1">{reading.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button onClick={onLogReread} className="w-full py-2.5 bg-sage-100 hover:bg-sage-300/40 text-sage-700 text-xs font-semibold rounded-2xl">
        🔁 Log a re-read
      </button>

      <div className="flex gap-3 pt-2">
        <button onClick={onEdit} className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Edit
        </button>
        <button
          onClick={onToggleFavorite}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-2xl transition-colors ${
            book.favorite ? 'bg-terracotta-100 text-terracotta-600' : 'bg-sand-100 hover:bg-sand-200 text-sand-900'
          }`}
        >
          {book.favorite ? '♥ Favorited' : '♡ Favorite'}
        </button>
        <button onClick={() => setConfirmingDelete(true)} className="flex-1 py-2.5 bg-sand-100 hover:bg-terracotta-100 text-sand-900 hover:text-terracotta-600 text-xs font-semibold rounded-2xl">
          Delete
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmInline title="Delete this book?" onConfirm={onDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </Modal>
  );
}
