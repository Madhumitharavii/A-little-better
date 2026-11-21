import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { createSubject } from '@/db/repositories/studyRepository';

/** Add a subject: a name, an optional emoji and goal, and (optionally) its first topics. */
export default function AddSubjectModal({ onClose, onSaved }: { onClose: () => void; onSaved: (title: string) => void }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [goal, setGoal] = useState('');
  const [topics, setTopics] = useState('');

  const field = 'w-full p-2.5 bg-white border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none';

  const save = async () => {
    const name = title.trim();
    if (!name) return;
    await createSubject({
      title: name,
      icon: icon.trim() || undefined,
      goal: goal.trim() || undefined,
      topicNames: topics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    onSaved(name);
  };

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-md">
      <ModalHeader icon="📚" title="Add a subject" onClose={onClose} />
      <div className="space-y-3">
        <div className="flex gap-2">
          <input aria-label="Emoji (optional)" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🎸" className={`${field} w-16 text-center`} />
          <input aria-label="Subject name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject — e.g. Guitar, Statistics" className={field} />
        </div>
        <input aria-label="Goal (optional)" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal (optional) — e.g. JLPT N4, pass the exam" className={field} />
        <textarea
          aria-label="Topics (optional, comma separated)"
          rows={2}
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="Topics (optional, comma separated) — e.g. Chords, Strumming, Songs"
          className={`${field} resize-none`}
        />
      </div>
      <button
        onClick={save}
        disabled={!title.trim()}
        className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl"
      >
        Add subject
      </button>
    </Modal>
  );
}
