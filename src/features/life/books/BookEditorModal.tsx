import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import StarRating from '@/shared/components/StarRating';
import ImagePicker from '@/shared/components/ImagePicker';
import DateField from '@/shared/components/DateField';
import type { BookItem, BookStatus } from '@/db/schema';

interface BookEditorModalProps {
  existing?: BookItem;
  onClose: () => void;
  onSave: (input: Omit<BookItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type'>) => void;
}

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'wantTo', label: 'Want to Read' },
  { value: 'inProgress', label: 'Currently Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'didNotFinish', label: 'Did Not Finish' },
];

export default function BookEditorModal({ existing, onClose, onSave }: BookEditorModalProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [author, setAuthor] = useState(existing?.author ?? '');
  const [status, setStatus] = useState<BookStatus | undefined>(existing?.status);
  const [coverImageId, setCoverImageId] = useState(existing?.coverImageId);
  const [dateStarted, setDateStarted] = useState(existing?.dateStarted ?? '');
  const [dateFinished, setDateFinished] = useState(existing?.dateFinished ?? '');
  const [rating, setRating] = useState<number | undefined>(existing?.rating);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [quote, setQuote] = useState(existing?.quote ?? '');
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      author: author.trim() || undefined,
      status,
      coverImageId,
      dateAdded: existing?.dateAdded ?? new Date().toISOString().slice(0, 10),
      dateStarted: dateStarted || undefined,
      dateFinished: dateFinished || undefined,
      rating,
      notes: notes.trim() || undefined,
      quote: quote.trim() || undefined,
      favorite,
      source: existing?.source ?? 'manual',
    });
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="📖" title={existing ? 'Edit Book' : 'Add a Book'} onClose={onClose} />

      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-sand-900 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Book title"
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Author</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author name"
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300"
          />
        </div>

        <ImagePicker imageId={coverImageId} onChange={setCoverImageId} label="Cover photo (optional)" aspectClassName="aspect-[3/4] max-w-[140px]" />

        <div>
          <label className="block font-semibold text-sand-900 mb-2">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(status === opt.value ? undefined : opt.value)}
                className={`px-3 py-2 rounded-xl border font-medium transition-all ${
                  status === opt.value ? 'bg-sage-500 text-white border-sage-500' : 'bg-sand-50 border-sand-200 text-sand-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DateField label="Started" value={dateStarted} onChange={setDateStarted} />
          <DateField label="Finished" value={dateFinished} onChange={setDateFinished} />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1.5">Rating — a personal record, not a grade</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">My thoughts</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Whatever you'd like to remember about it..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Favorite quote (optional)</label>
          <textarea
            rows={2}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="A line worth keeping..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setFavorite((f) => !f)}
          className={`w-full py-2.5 rounded-2xl border font-semibold transition-all flex items-center justify-center gap-2 ${
            favorite ? 'bg-terracotta-100 border-terracotta-400/40 text-terracotta-600' : 'bg-sand-50 border-sand-200 text-sand-800'
          }`}
        >
          <span>{favorite ? '♥' : '♡'}</span> {favorite ? 'Favorite' : 'Mark as favorite'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl transition-all shadow-sm"
        >
          {existing ? 'Save Changes' : 'Add Book'}
        </button>
        <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
