import { useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, deleteLifeItem } from '@/db/repositories/lifeRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import type { WishItem } from '@/db/schema';
import WishEditorModal from './WishEditorModal';
import ConfirmInline from '@/shared/components/ConfirmInline';

interface SomedayMaybePageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
  initialOpenItem?: WishItem;
}

const PLAYFUL_ICONS = ['✨', '🪁', '🎈', '🌈', '🍃', '🌻'];

export default function SomedayMaybePage({ showToast, onBack, initialOpenItem }: SomedayMaybePageProps) {
  const allWishes = useLifeItemsOfType('wish') as WishItem[];
  const wishes = allWishes.filter((w) => (w.listType ?? 'somedayMaybe') === 'somedayMaybe');
  const [editing, setEditing] = useState<'closed' | 'new' | WishItem>(initialOpenItem ?? 'closed');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const pending = wishes.filter((w) => !w.done);
  const done = wishes.filter((w) => w.done);

  const toggleDone = async (wish: WishItem) => {
    const nowDone = !wish.done;
    await updateLifeItem(wish.id, {
      type: 'wish',
      done: nowDone,
      dateCompleted: nowDone ? getLocalDateKey() : undefined,
    });
    if (nowDone) showToast(`✨ ${wish.title} — you did it!`);
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
        <h2 className="serif text-xl font-semibold text-sand-900">Someday, Maybe</h2>
        <button
          onClick={() => setEditing('new')}
          className="ml-auto px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
        >
          + Add
        </button>
      </div>
      <p className="text-xs text-sand-800/60 -mt-3">
        Skydiving, pottery, that place you keep meaning to visit. No pressure, no deadline — just a list.
      </p>

      {wishes.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-sand-200 text-center space-y-2">
          <span className="text-3xl block">🪁</span>
          <p className="text-sm text-sand-800/70">Nothing here yet — what's calling to you?</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="space-y-2">
              {pending.map((wish, i) => (
                <div key={wish.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-sand-200 shadow-sm">
                  <button
                    onClick={() => toggleDone(wish)}
                    className="w-8 h-8 shrink-0 rounded-full border-2 border-sand-300 hover:border-sage-500 flex items-center justify-center text-sm"
                    aria-label="Mark as done"
                  >
                    {PLAYFUL_ICONS[i % PLAYFUL_ICONS.length]}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sand-900 truncate">{wish.title}</p>
                    {wish.category && <p className="text-[11px] text-sand-800/50">{wish.category}</p>}
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60 pt-2">Done ✨</h3>
              {done.map((wish) => (
                <div key={wish.id} className="flex items-center gap-3 p-3 bg-sage-100/40 rounded-2xl border border-sage-300">
                  <button
                    onClick={() => toggleDone(wish)}
                    className="w-8 h-8 shrink-0 rounded-full bg-sage-500 text-white flex items-center justify-center text-sm"
                    aria-label="Mark as not done"
                  >
                    ✓
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sand-900 line-through decoration-sage-500/50 truncate">{wish.title}</p>
                    {wish.dateCompleted && <p className="text-[11px] text-sand-800/50">{formatDisplayDate(wish.dateCompleted)}</p>}
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
          listType="somedayMaybe"
          onClose={() => setEditing('closed')}
          onSave={async (input) => {
            if (editing === 'new') {
              await createLifeItem({ type: 'wish', ...input });
              showToast('Added to your list ✨');
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
          title="Remove this from your list?"
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
