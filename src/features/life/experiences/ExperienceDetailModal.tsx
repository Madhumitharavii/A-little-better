import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ConfirmInline from '@/shared/components/ConfirmInline';
import StarRating from '@/shared/components/StarRating';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import type { ExperienceItem } from '@/db/schema';

function PhotoThumb({ imageId }: { imageId: string }) {
  const url = useLifeImageUrl(imageId);
  if (!url) return null;
  return (
    <div className="w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-sand-100">
      <img src={url} alt="" className="w-full h-full object-cover" />
    </div>
  );
}

interface ExperienceDetailModalProps {
  experience: ExperienceItem;
  onClose: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

export default function ExperienceDetailModal({ experience, onClose, onEdit, onToggleFavorite, onDelete }: ExperienceDetailModalProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🌿" title={experience.title} onClose={onClose} />

      <div className="space-y-1 text-xs">
        {(experience.date || experience.location) && (
          <p className="text-sand-800/70">
            {formatDisplayDate(experience.date)}
            {experience.date && experience.location ? ' · ' : ''}
            {experience.location}
          </p>
        )}
        {experience.people && (
          <p className="text-sand-800/70">
            <span className="font-semibold text-sand-900">Who:</span> {experience.people}
          </p>
        )}
        {!!experience.rating && <StarRating value={experience.rating} size="sm" />}
        {experience.favorite && <p className="text-terracotta-600">♥ Favorite</p>}
      </div>

      {experience.imageIds && experience.imageIds.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {experience.imageIds.map((id) => (
            <PhotoThumb key={id} imageId={id} />
          ))}
        </div>
      )}

      {experience.description && (
        <div>
          <p className="font-semibold text-sand-900 text-xs mb-1">What happened</p>
          <p className="text-xs text-sand-800/80 whitespace-pre-wrap leading-relaxed">{experience.description}</p>
        </div>
      )}

      {experience.favoriteMemory && (
        <div className="p-3 bg-amber-50 border border-amber-300/50 rounded-2xl">
          <p className="font-semibold text-sand-900 text-xs mb-1">Favorite memory</p>
          <p className="text-xs text-sand-800/80 italic whitespace-pre-wrap">{experience.favoriteMemory}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onEdit} className="flex-1 py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl">
          Edit
        </button>
        <button
          onClick={onToggleFavorite}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-2xl transition-colors ${
            experience.favorite ? 'bg-terracotta-100 text-terracotta-600' : 'bg-sand-100 hover:bg-sand-200 text-sand-900'
          }`}
        >
          {experience.favorite ? '♥ Favorited' : '♡ Favorite'}
        </button>
        <button onClick={() => setConfirmingDelete(true)} className="flex-1 py-2.5 bg-sand-100 hover:bg-terracotta-100 text-sand-900 hover:text-terracotta-600 text-xs font-semibold rounded-2xl">
          Delete
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmInline title="Delete this experience?" onConfirm={onDelete} onCancel={() => setConfirmingDelete(false)} />
      )}
    </Modal>
  );
}
