import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { WishItem } from '@/db/schema';
import { createLifeItem, updateLifeItem } from '@/db/repositories/lifeRepository';
import { saveJournalEntry, updateJournalEntry } from '@/db/repositories/journalRepository';
import { getLocalDateKey } from '@/db/dateUtils';

interface AchievedStoryModalProps {
  wish: WishItem;
  /** 'complete' = just ticked off; 'story' = adding/editing the story of one already achieved. */
  mode: 'complete' | 'story';
  onClose: () => void;
  onDone: (message: string) => void;
}

/**
 * "You did it!" — when a vision goal is ticked off: when it happened,
 * the story of it, and whether to keep that story in the Journal and/or
 * as a Life experience. Skipping just ticks it off.
 */
export default function AchievedStoryModal({ wish, mode, onClose, onDone }: AchievedStoryModalProps) {
  const today = getLocalDateKey();
  const [date, setDate] = useState(wish.dateCompleted ?? today);
  const [story, setStory] = useState(wish.story ?? '');
  // Links still pointing at something that exists (a journal entry or experience you've since deleted doesn't count).
  const links = useLiveQuery(async () => {
    const [j, e] = await Promise.all([
      wish.linkedJournalId ? db.journalEntries.get(wish.linkedJournalId) : undefined,
      wish.linkedExperienceId ? db.lifeItems.get(wish.linkedExperienceId) : undefined,
    ]);
    return { journal: j && !j.deletedAt ? j.id : undefined, experience: e && !e.deletedAt ? e.id : undefined };
  }, [wish.linkedJournalId, wish.linkedExperienceId]);
  const journalId = links?.journal;
  const experienceId = links?.experience;
  const [toJournal, setToJournal] = useState(true); // only offered when there is no live journal link
  const [toExperience, setToExperience] = useState(false);
  const [busy, setBusy] = useState(false);

  const text = story.trim();

  const justTick = async () => {
    setBusy(true);
    await updateLifeItem(wish.id, { type: 'wish', done: true, dateCompleted: date });
    onDone(`🤜🤛 ${wish.title} — vision achieved!`);
  };

  const save = async () => {
    setBusy(true);
    const patch: Partial<WishItem> = {
      done: true,
      dateCompleted: date,
      story: text || undefined,
      // Forget links to things that were deleted, so they can be made again.
      linkedJournalId: journalId,
      linkedExperienceId: experienceId,
    };
    const saved: string[] = [];

    if (journalId) {
      await updateJournalEntry(journalId, text ? { body: text, date } : { date });
    } else if (text) {
      if (toJournal) {
        const entry = await saveJournalEntry({ date, title: wish.title, body: text, tags: ['vision'] });
        patch.linkedJournalId = entry.id;
        saved.push('your journal');
      }
    }
    if (experienceId) {
      await updateLifeItem(experienceId, text ? { type: 'experience', description: text, date } : { type: 'experience', date });
    } else if (toExperience) {
      const exp = await createLifeItem({ type: 'experience', title: wish.title, description: text || wish.notes, date, favorite: wish.favorite });
      patch.linkedExperienceId = exp.id;
      saved.push('Experiences');
    }

    await updateLifeItem(wish.id, { type: 'wish', ...patch });
    onDone(
      mode === 'complete'
        ? `🤜🤛 ${wish.title} — vision achieved!${saved.length ? ` Saved to ${saved.join(' and ')}.` : ''}`
        : `Story saved${saved.length ? ` to ${saved.join(' and ')}` : ''} 🌿`,
    );
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🤜🤛" title={mode === 'complete' ? 'You did it!' : 'The story'} onClose={onClose} />
      <div className="space-y-4 text-xs">
        <p className="text-sm font-semibold text-sand-900 leading-snug">{wish.title}</p>

        <div className="flex items-center gap-3">
          <label htmlFor="achieved-date" className="font-semibold text-sand-900">
            When?
          </label>
          <input
            id="achieved-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            className="p-2 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="achieved-story" className="block font-semibold text-sand-900 mb-1">
            The story <span className="font-normal text-sand-800/50">(optional)</span>
          </label>
          <textarea
            id="achieved-story"
            rows={5}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="How did it happen? Who was there? What do you want to remember about it?"
            className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        <div className="space-y-2">
          {journalId ? (
            <p className="text-sand-800/60">📓 Already in your journal{text ? ', it will be updated' : ''}.</p>
          ) : (
            <label className={`flex items-center gap-2 ${text ? 'cursor-pointer' : 'opacity-50'}`}>
              <input type="checkbox" checked={toJournal && !!text} disabled={!text} onChange={(e) => setToJournal(e.target.checked)} />
              <span>📓 Save the story in my Journal{!text ? ' (write a few words first)' : ''}</span>
            </label>
          )}
          {experienceId ? (
            <p className="text-sand-800/60">🌿 Already in Life → Experiences{text ? ', it will be updated' : ''}.</p>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={toExperience} onChange={(e) => setToExperience(e.target.checked)} />
              <span>🌿 Add it to Life → Experiences</span>
            </label>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white font-semibold rounded-2xl"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {mode === 'complete' ? (
            <button
              onClick={justTick}
              disabled={busy}
              className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 font-semibold rounded-2xl"
            >
              Just tick it
            </button>
          ) : (
            <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 font-semibold rounded-2xl">
              Cancel
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
