import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ImagePicker from '@/shared/components/ImagePicker';
import DateField from '@/shared/components/DateField';
import type { ArtworkItem } from '@/db/schema';

interface ArtworkEditorModalProps {
  existing?: ArtworkItem;
  onClose: () => void;
  onSave: (input: Omit<ArtworkItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type'>) => void;
}

export default function ArtworkEditorModal({ existing, onClose, onSave }: ArtworkEditorModalProps) {
  const [imageId, setImageId] = useState(existing?.imageId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [dateCreated, setDateCreated] = useState(existing?.dateCreated ?? '');
  const [medium, setMedium] = useState(existing?.medium ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);

  const handleSave = () => {
    onSave({
      title: title.trim() || 'Untitled',
      imageId,
      dateCreated: dateCreated || undefined,
      medium: medium.trim() || undefined,
      notes: notes.trim() || undefined,
      favorite,
    });
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🎨" title={existing ? 'Edit Artwork' : 'Add Artwork'} onClose={onClose} />

      <div className="space-y-4 text-xs">
        <ImagePicker imageId={imageId} onChange={setImageId} label="Photo" aspectClassName="aspect-square" />

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled doodle, quick sketch..."
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-sand-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DateField label="Date (optional)" value={dateCreated} onChange={setDateCreated} />
          <div>
            <label className="block font-semibold text-sand-900 mb-1">Medium (optional)</label>
            <input
              type="text"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              placeholder="Pencil, watercolor..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Notes (optional)</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What inspired it, how it felt to make..."
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
        <button onClick={handleSave} className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm">
          {existing ? 'Save Changes' : 'Save Artwork'}
        </button>
        <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Cancel
        </button>
      </div>
    </Modal>
  );
}
