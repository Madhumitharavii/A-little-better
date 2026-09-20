import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ConfirmInline from '@/shared/components/ConfirmInline';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import type { ArtworkItem } from '@/db/schema';

interface ArtworkDetailModalProps {
  artwork: ArtworkItem;
  onClose: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

export default function ArtworkDetailModal({ artwork, onClose, onEdit, onToggleFavorite, onDelete }: ArtworkDetailModalProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const imageUrl = useLifeImageUrl(artwork.imageId);

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🎨" title={artwork.title || 'Untitled'} onClose={onClose} />

      <div className="rounded-2xl overflow-hidden bg-sand-100 aspect-square flex items-center justify-center">
        {imageUrl ? <img src={imageUrl} alt={artwork.title || ''} className="w-full h-full object-cover" /> : <span className="text-4xl">🎨</span>}
      </div>

      <div className="space-y-2 text-xs">
        {(artwork.dateCreated || artwork.medium) && (
          <div className="flex gap-4">
            {artwork.dateCreated && (
              <p className="text-sand-800/70">
                <span className="font-semibold text-sand-900">Date:</span> {formatDisplayDate(artwork.dateCreated)}
              </p>
            )}
            {artwork.medium && (
              <p className="text-sand-800/70">
                <span className="font-semibold text-sand-900">Medium:</span> {artwork.medium}
              </p>
            )}
          </div>
        )}
        {artwork.notes && <p className="text-sand-800/80 whitespace-pre-wrap leading-relaxed">{artwork.notes}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onEdit} className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Edit
        </button>
        <button
          onClick={onToggleFavorite}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-2xl transition-colors ${
            artwork.favorite ? 'bg-terracotta-100 text-terracotta-600' : 'bg-sand-100 hover:bg-sand-200 text-sand-900'
          }`}
        >
          {artwork.favorite ? '♥ Favorited' : '♡ Favorite'}
        </button>
        <button onClick={() => setConfirmingDelete(true)} className="flex-1 py-2.5 bg-sand-100 hover:bg-terracotta-100 text-sand-900 hover:text-terracotta-600 text-xs font-semibold rounded-2xl">
          Delete
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmInline title="Delete this artwork?" onConfirm={onDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </Modal>
  );
}
