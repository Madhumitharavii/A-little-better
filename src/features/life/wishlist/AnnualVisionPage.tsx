import { useState } from 'react';
import { useLifeItemsOfType } from '../useLifeItems';
import { createLifeItem, updateLifeItem, deleteLifeItem } from '@/db/repositories/lifeRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import type { BookItem, WishItem } from '@/db/schema';
import WishEditorModal from './WishEditorModal';
import VisionPasteModal from './VisionPasteModal';
import AchievedStoryModal from './AchievedStoryModal';
import { booksFinishedIn, readingGoalTarget } from './visionList';
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
  const [pasting, setPasting] = useState(false);
  const [storyFor, setStoryFor] = useState<{ wish: WishItem; mode: 'complete' | 'story' } | null>(null);
  const books = useLifeItemsOfType('book') as BookItem[];

  const currentYear = new Date().getFullYear();
  // Same year: in the order they were added (so a pasted list keeps its order).
  const pending = wishes.filter((w) => !w.done && !w.missed).sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.createdAt.localeCompare(b.createdAt));
  /** A goal like "Read 12 books" → progress from the Books section. */
  const readingProgress = (wish: WishItem) => {
    const target = readingGoalTarget(wish.title);
    if (!target) return null;
    const read = booksFinishedIn(books, wish.year ?? currentYear);
    return { read, target, pct: Math.min(100, Math.round((read / target) * 100)) };
  };
  const done = wishes.filter((w) => w.done);
  const missed = wishes.filter((w) => w.missed && !w.done);

  const markMissed = async (wish: WishItem) => {
    await updateLifeItem(wish.id, { type: 'wish', missed: true, dateMissed: getLocalDateKey() });
    showToast("Moved to Missed. That's okay, some things only fit a moment.");
  };
  const undoMissed = async (wish: WishItem) => {
    await updateLifeItem(wish.id, { type: 'wish', missed: false, dateMissed: undefined });
  };
  const tryNextYear = async (wish: WishItem) => {
    const next = (wish.year ?? currentYear) + 1;
    await updateLifeItem(wish.id, { type: 'wish', missed: false, dateMissed: undefined, year: next });
    showToast(`Moved to ${next} 🌱`);
  };

  const toggleDone = async (wish: WishItem) => {
    if (!wish.done) {
      // Ticking it off: ask when it happened and (optionally) for the story.
      setStoryFor({ wish, mode: 'complete' });
      return;
    }
    await updateLifeItem(wish.id, { type: 'wish', done: false, dateCompleted: undefined });
  };


  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sand-800/60 hover:text-sand-900 text-sm px-1">
          ← Life
        </button>
        <h2 className="serif text-xl font-semibold text-sand-900">Annual Vision</h2>
        <button
          onClick={() => setPasting(true)}
          className="ml-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl"
        >
          Add several
        </button>
        <button
          onClick={() => setEditing('new')}
          className="px-4 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl shadow-sm"
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
            <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start">
              {pending.map((wish) => (
                <div
                  key={wish.id}
                  className={`flex items-center gap-3 p-3 bg-white rounded-2xl border shadow-sm transition-all ${
                    justCompletedId === wish.id ? 'border-terracotta-400 scale-[1.02]' : 'border-sand-200'
                  }`}
                >
                  <button
                    onClick={() => toggleDone(wish)}
                    className="group w-7 h-7 shrink-0 rounded-full border-2 border-sand-300 hover:border-sage-500 hover:bg-sage-100 flex items-center justify-center text-xs transition-colors"
                    aria-label="Mark as achieved"
                  >
                    <span className="text-sage-700 opacity-0 group-hover:opacity-100 transition-opacity">✓</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sand-900 leading-snug break-words">{wish.title}</p>
                    <p className="text-[11px] text-sand-800/50">
                      {wish.year ?? currentYear}
                      {wish.category ? ` · ${wish.category}` : ''}
                    </p>
                    {(() => {
                      const p = readingProgress(wish);
                      return p ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-sand-100 rounded-full overflow-hidden">
                            <div className="h-full bg-sage-500 rounded-full" style={{ width: `${p.pct}%` }} />
                          </div>
                          <span className="text-[10px] text-sage-700 font-semibold shrink-0">
                            📚 {p.read} / {p.target} read
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  {wish.favorite && <span className="text-terracotta-400 text-sm shrink-0">♥</span>}
                  <button
                    onClick={() => markMissed(wish)}
                    className="text-sand-800/50 hover:text-sand-900 text-[11px] px-1 shrink-0"
                    title="Can't happen this time"
                  >
                    Missed
                  </button>
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
            <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60 pt-2 lg:col-span-2">Achieved 🤜🤛</h3>
              {done.map((wish) => (
                <div key={wish.id} className="flex items-center gap-3 p-3 bg-terracotta-100/50 rounded-2xl border border-terracotta-400/30">
                  <button
                    onClick={() => toggleDone(wish)}
                    className="w-7 h-7 shrink-0 rounded-full bg-terracotta-400 text-white flex items-center justify-center text-xs"
                    aria-label="Mark as not achieved"
                  >
                    ✓
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sand-900 line-through decoration-terracotta-400/50 leading-snug break-words">{wish.title}</p>
                    <p className="text-[11px] text-sand-800/50">
                      {wish.year ?? ''} {wish.dateCompleted ? `· achieved ${formatDisplayDate(wish.dateCompleted)}` : ''}
                      {wish.linkedJournalId ? ' · 📓 in journal' : ''}
                      {wish.linkedExperienceId ? ' · 🌿 in experiences' : ''}
                    </p>
                    {wish.story && <p className="text-[11px] text-sand-800/70 italic mt-1 line-clamp-2 whitespace-pre-line">“{wish.story}”</p>}
                  </div>
                  <button
                    onClick={() => setStoryFor({ wish, mode: 'story' })}
                    className="text-[10px] bg-white hover:bg-sand-50 border border-sand-200 text-sand-800 px-2 py-1.5 rounded-lg shrink-0"
                  >
                    {wish.story ? '✍️ Story' : '✍️ Add story'}
                  </button>
                  <button onClick={() => setConfirmDeleteId(wish.id)} className="text-sand-800/50 hover:text-terracotta-600 text-[11px] px-1 shrink-0">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {missed.length > 0 && (
            <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60 pt-2 lg:col-span-2">Missed this time 🌧️</h3>
              <p className="text-[11px] text-sand-800/50 -mt-1 lg:mt-0 lg:col-span-2">That's okay. Some things only fit a moment. Try again next year, or let them go.</p>
              {missed.map((wish) => (
                <div key={wish.id} className="flex items-center gap-3 p-3 bg-sand-100/60 rounded-2xl border border-sand-200">
                  <span className="w-7 h-7 shrink-0 rounded-full border-2 border-dashed border-sand-300" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-sand-800/70 leading-snug break-words">{wish.title}</p>
                    <p className="text-[11px] text-sand-800/50">
                      {wish.year ?? currentYear}
                      {wish.category ? ` · ${wish.category}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => tryNextYear(wish)}
                    className="text-[10px] bg-white hover:bg-sand-50 border border-sand-200 text-sand-800 px-2 py-1.5 rounded-lg shrink-0"
                  >
                    🌱 Try next year
                  </button>
                  <button onClick={() => undoMissed(wish)} className="text-sand-800/50 hover:text-sand-900 text-[11px] px-1 shrink-0">
                    Undo
                  </button>
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

      {storyFor && (
        <AchievedStoryModal
          wish={storyFor.wish}
          mode={storyFor.mode}
          onClose={() => setStoryFor(null)}
          onDone={(message) => {
            const id = storyFor.wish.id;
            const wasCompleting = storyFor.mode === 'complete';
            setStoryFor(null);
            showToast(message);
            if (wasCompleting) {
              setJustCompletedId(id);
              setTimeout(() => setJustCompletedId((current) => (current === id ? null : current)), 2000);
            }
          }}
        />
      )}

      {pasting && (
        <VisionPasteModal
          existing={wishes}
          onClose={() => setPasting(false)}
          onAdded={(count) => {
            setPasting(false);
            showToast(`Added ${count} goal${count === 1 ? '' : 's'} to your vision board 🎯`);
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
