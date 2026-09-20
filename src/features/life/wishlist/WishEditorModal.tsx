import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { WishItem, WishListType } from '@/db/schema';

interface WishEditorModalProps {
  existing?: WishItem;
  listType: WishListType;
  onClose: () => void;
  onSave: (input: Omit<WishItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type'>) => void;
}

export default function WishEditorModal({ existing, listType, onClose, onSave }: WishEditorModalProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [year, setYear] = useState(existing?.year ? String(existing.year) : String(new Date().getFullYear()));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      listType,
      category: category.trim() || undefined,
      year: listType === 'annualVision' && year ? Number(year) : undefined,
      notes: notes.trim() || undefined,
      done: existing?.done ?? false,
      dateCompleted: existing?.dateCompleted,
      linkedExperienceId: existing?.linkedExperienceId,
      favorite,
    });
  };

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <ModalHeader
        icon={listType === 'annualVision' ? '🎯' : '⭐'}
        title={existing ? 'Edit' : listType === 'annualVision' ? 'Add to Vision Board' : 'Add to the List'}
        onClose={onClose}
      />

      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-sand-900 mb-1">
            {listType === 'annualVision' ? 'What do you want to achieve or experience?' : 'What do you want to try?'}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={listType === 'annualVision' ? 'Run a 10k, visit Japan, learn to sail...' : 'Skydiving, pottery class, that ramen place...'}
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300"
          />
        </div>

        {listType === 'annualVision' && (
          <div>
            <label className="block font-semibold text-sand-900 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder={String(new Date().getFullYear())}
              className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Category (optional)</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Adventure, food, places, skills..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why it's on your list..."
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
          className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl shadow-sm"
        >
          {existing ? 'Save Changes' : 'Add to List'}
        </button>
        <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
