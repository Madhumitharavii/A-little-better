import { useEffect, useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, toggleFavorite, deleteLifeItem } from '@/db/repositories/lifeRepository';
import type { ExperienceItem } from '@/db/schema';
import ExperienceCard from './ExperienceCard';
import ExperienceEditorModal from './ExperienceEditorModal';
import ExperienceDetailModal from './ExperienceDetailModal';

interface ExperiencesPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: ExperienceItem;
}

export default function ExperiencesPage({ showToast, onBack, initialOpenItem }: ExperiencesPageProps) {
  const experiences = useLifeItemsOfType('experience') as ExperienceItem[];
  const [editing, setEditing] = useState<'closed' | 'new' | ExperienceItem>('closed');
  const [detail, setDetail] = useState<ExperienceItem | null>(initialOpenItem ?? null);

  useEffect(() => {
    if (initialOpenItem) setDetail(initialOpenItem);
  }, [initialOpenItem]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sand-800/60 hover:text-sand-900 text-sm px-1">
          ← Life
        </button>
        <h2 className="serif text-xl font-semibold text-sand-900">Experiences</h2>
        <button
          onClick={() => setEditing('new')}
          className="ml-auto px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
        >
          + Add Experience
        </button>
      </div>

      {experiences.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">🌿</span>
          <p className="text-sm text-sand-800/70">Nothing here yet. Little adventures welcome.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {experiences.map((exp) => (
            <ExperienceCard key={exp.id} experience={exp} onClick={() => setDetail(exp)} />
          ))}
        </div>
      )}

      {editing !== 'closed' && (
        <ExperienceEditorModal
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing('closed')}
          onSave={async (input) => {
            if (editing === 'new') {
              await createLifeItem({ type: 'experience', ...input });
              showToast('Experience saved 🌿');
            } else {
              await updateLifeItem(editing.id, { type: 'experience', ...input });
              showToast('Experience updated');
            }
            setEditing('closed');
          }}
        />
      )}

      {detail && (
        <ExperienceDetailModal
          experience={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
          onToggleFavorite={async () => {
            const updated = await toggleFavorite(detail.id);
            if (updated?.type === 'experience') setDetail(updated);
          }}
          onDelete={async () => {
            await deleteLifeItem(detail.id);
            showToast('Experience removed');
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}
