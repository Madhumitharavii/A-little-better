import { useEffect, useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, toggleFavorite, deleteLifeItem } from '@/db/repositories/lifeRepository';
import type { ArtworkItem } from '@/db/schema';
import ArtworkTile from './ArtworkTile';
import ArtworkEditorModal from './ArtworkEditorModal';
import ArtworkDetailModal from './ArtworkDetailModal';

interface ArtworkPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: ArtworkItem;
}

export default function ArtworkPage({ showToast, onBack, initialOpenItem }: ArtworkPageProps) {
  const artworks = useLifeItemsOfType('artwork') as ArtworkItem[];
  const [editing, setEditing] = useState<'closed' | 'new' | ArtworkItem>('closed');
  const [detail, setDetail] = useState<ArtworkItem | null>(initialOpenItem ?? null);

  useEffect(() => {
    if (initialOpenItem) setDetail(initialOpenItem);
  }, [initialOpenItem]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sand-800/60 hover:text-sand-900 text-sm px-1">
          ← Life
        </button>
        <h2 className="serif text-xl font-semibold text-sand-900">Artwork</h2>
        <button
          onClick={() => setEditing('new')}
          className="ml-auto px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
        >
          + Add Artwork
        </button>
      </div>

      {artworks.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">🎨</span>
          <p className="text-sm text-sand-800/70">Nothing here yet. Doodles welcome.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {artworks.map((art) => (
            <ArtworkTile key={art.id} artwork={art} onClick={() => setDetail(art)} />
          ))}
        </div>
      )}

      {editing !== 'closed' && (
        <ArtworkEditorModal
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing('closed')}
          onSave={async (input) => {
            if (editing === 'new') {
              await createLifeItem({ type: 'artwork', ...input });
              showToast('Artwork saved 🎨');
            } else {
              await updateLifeItem(editing.id, { type: 'artwork', ...input });
              showToast('Artwork updated');
            }
            setEditing('closed');
          }}
        />
      )}

      {detail && (
        <ArtworkDetailModal
          artwork={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
          onToggleFavorite={async () => {
            const updated = await toggleFavorite(detail.id);
            if (updated?.type === 'artwork') setDetail(updated);
          }}
          onDelete={async () => {
            await deleteLifeItem(detail.id);
            showToast('Artwork removed');
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}
