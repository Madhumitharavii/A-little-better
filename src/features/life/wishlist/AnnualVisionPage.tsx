import { useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, deleteLifeItem } from '@/db/repositories/lifeRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import type { WishItem } from '@/db/schema';
import WishEditorModal from './WishEditorModal';
import ConfirmInline from '@/shared/components/ConfirmInline';

interface AnnualVisionPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: WishItem;
}

export default function AnnualVisionPage({ showToast, onBack, initialOpenItem }: AnnualVisionPageProps) {
  const allWishes = useLifeItemsOfType('wish') as WishItem[];
  const wishes = allWishes.filter((w) => w.listType === 'annualVision');
  const [editing, setEditing] = useState<'closed' | 'new' | WishItem>(initialOpenItem ?? 'closed');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const pending = wishes.filter((w) => !w.done).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const done = wishes.filter((w) => w.done);

  const toggleDone = async (wish: WishItem) => {
    const nowDone = !wish.done;
    await updateLifeItem(wish.id, {
      type: 'wish',
      done: nowDone,
      dateCompleted: nowDone ? getLocalDateKey() : undefined,
    });
    if (nowDone) {
      showToast(`🤜🤛 ${wish.title} — vision achieved!`);
      setJustCompletedId(wish.id);
      setTimeout(() => setJustCompletedId((current) => (current === wish.id ? null : current)), 2000);
    }
  };

  const logAsExperience = async (wish: WishItem) => {
    const experience = await createLifeItem({
      type: 'experience',
      title: wish.title,
      description: wish.notes,
      date: wish.dateCompleted ?? getLocalDateKey(),
      favorite: wish.favorite,
    });
    await updateLifeItem(wish.id, { type: 'wish', linkedExperienceId: experience.id });
    showToast('Logged as an Experience 🌿');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sand-800/60 hover:text-sand-900 text-sm px-1">
          ← Life
        </button>
        <h2 className="serif text-xl font-semibold text-sand-900">Annual Vision</h2>
        <button
          onClick={() => setEditing('new')}
          className="ml-auto px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
        >
          + Add
        </button>
      </div>
      <p className="text-xs text-sand-800/60 -mt-3">This year's vision board — {currentYear} and beyond. Check things off as you live them.</p>

      {wishes.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">🎯</span>
          <p className="text-sm text-sand-800/70">Nothing here yet — what's your vision for this year?</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map((wish) => (
                <div
                  key={wish.id}
                  className={`flex items-center gap-3 p-3 bg-white rounded-2xl border shadow-sm transition-all ${
                    justCompletedId === wish.id ? 'border-terracotta-400 scale-[1.02]' : 'border-sand-200'
                  }`}
                >
                  <button
                    onClick={() => toggleDone(wish)}
                    className="w-8 h-8 shrink-0 rounded-full border-2 border-sand-300 hover:border-terracotta-400 flex items-center justify-center text-sm"
                    aria-label="Mark as achieved"
                  >
                    🎯
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sand-900 truncate">{wish.title}</p>
                    <p className="text-[11px] text-sand-800/50">
                      {wish.year ?? currentYear}
                      {wish.category ? ` · ${wish.category}` : ''}
                    </p>
                  </div>
                  {wish.favorite && <span className="text-terracotta-400 text-sm shrink-0">♥</span>}
                  <button onClick={() => setEditing(wish)} className="text-sand-800/50 hover:text-sand-900 text-[11px] px-1 shrink-0">
                    Edit
                  </button>
                  <button onClick={() => setConfirmDeleteId(wish.id)} className="text-sand-800/50 hover:text-terracotta-600 text-[11px] px-1 shrink-0">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60 pt-2">Achieved 🤜🤛</h3>
              {done.map((wish) => (
                <div key={wish.id} className="flex items-center gap-3 p-3 bg-terracotta-100/50 rounded-2xl border border-terracotta-400/30">
                  <button
                    onClick={() => toggleDone(wish)}
                    className="w-8 h-8 shrink-0 rounded-full bg-terracotta-400 text-white flex items-center justify-center text-sm"
                    aria-label="Mark as not achieved"
                  >
                    ✓
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sand-900 line-through decoration-terracotta-400/50 truncate">{wish.title}</p>
                    <p className="text-[11px] text-sand-800/50">
                      {wish.year ?? ''} {wish.dateCompleted ? `· achieved ${formatDisplayDate(wish.dateCompleted)}` : ''}
                    </p>
                  </div>
                  {!wish.linkedExperienceId && (
                    <button
                      onClick={() => logAsExperience(wish)}
                      className="text-[10px] bg-white hover:bg-sand-50 border border-sand-200 text-sand-800 px-2 py-1.5 rounded-lg shrink-0"
                    >
                      🌿 Log as Experience
                    </button>
                  )}
                  <button onClick={() => setConfirmDeleteId(wish.id)} className="text-sand-800/50 hover:text-terracotta-600 text-[11px] px-1 shrink-0">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing !== 'closed' && (
        <WishEditorModal
          existing={editing === 'new' ? undefined : editing}
          listType="annualVision"
          onClose={() => setEditing('closed')}
          onSave={async (input) => {
            if (editing === 'new') {
              await createLifeItem({ type: 'wish', ...input });
              showToast('Added to your vision board 🎯');
            } else {
              await updateLifeItem(editing.id, { type: 'wish', ...input });
              showToast('Updated');
            }
            setEditing('closed');
          }}
        />
      )}

      {confirmDeleteId && (
        <ConfirmInline
          title="Remove this from your vision board?"
          onConfirm={async () => {
            await deleteLifeItem(confirmDeleteId);
            setConfirmDeleteId(null);
            showToast('Removed');
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
