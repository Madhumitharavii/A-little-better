import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import MultiImagePicker from '@/shared/components/MultiImagePicker';
import StarRating from '@/shared/components/StarRating';
import DateField from '@/shared/components/DateField';
import type { ExperienceItem } from '@/db/schema';

interface ExperienceEditorModalProps {
  existing?: ExperienceItem;
  onClose: () => void;
  onSave: (input: Omit<ExperienceItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type'>) => void;
}

export default function ExperienceEditorModal({ existing, onClose, onSave }: ExperienceEditorModalProps) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [people, setPeople] = useState(existing?.people ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [favoriteMemory, setFavoriteMemory] = useState(existing?.favoriteMemory ?? '');
  const [imageIds, setImageIds] = useState<string[]>(existing?.imageIds ?? []);
  const [rating, setRating] = useState<number | undefined>(existing?.rating);
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      date: date || undefined,
      location: location.trim() || undefined,
      people: people.trim() || undefined,
      description: description.trim() || undefined,
      favoriteMemory: favoriteMemory.trim() || undefined,
      imageIds: imageIds.length ? imageIds : undefined,
      rating,
      favorite,
    });
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🌿" title={existing ? 'Edit Experience' : 'Add an Experience'} onClose={onClose} />

      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-sand-900 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A trip, an outing, a memorable day..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DateField label="Date (optional)" value={date} onChange={setDate} />
          <div>
            <label className="block font-semibold text-sand-900 mb-1">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Karnataka..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Who was there (optional)</label>
          <input
            type="text"
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            placeholder="Friends, family..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">What happened</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="As much or as little as you'd like..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Favorite memory (optional)</label>
          <textarea
            rows={2}
            value={favoriteMemory}
            onChange={(e) => setFavoriteMemory(e.target.value)}
            placeholder="The one moment you want to remember..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1.5">Rating — a personal record, not a grade</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <MultiImagePicker imageIds={imageIds} onChange={setImageIds} max={3} />

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
          {existing ? 'Save Changes' : 'Save Experience'}
        </button>
        <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
