import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { markContactedToday } from '@/db/repositories/peopleRepository';
import { usePeople } from '@/features/people/usePeople';
import { describeLastContact } from '@/features/people/lastContact';
import { getLocalDateKey } from '@/db/dateUtils';

interface RelationshipConnectionToolProps {
  onClose: () => void;
  onComplete: () => void;
  /** Called when a person is tapped — ticks today's connection without closing the tool. */
  onConnected: () => void;
}

const PROMPTS = [
  "Hey! Thinking of you today. Hope your week is treating you gently 🌿",
  "Saw something today that reminded me of you! Hope you're doing well.",
  "No need to reply right away—just wanted to send a warm hello!",
];

export default function RelationshipConnectionTool({ onClose, onComplete, onConnected }: RelationshipConnectionToolProps) {
  const [copied, setCopied] = useState<number | null>(null);
  const people = usePeople();
  const today = getLocalDateKey();

  const copyPrompt = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can fail on older browsers; fail silently, it's a nicety.
    }
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="💛" title="Relationship Connection" onClose={onClose} />

      <p className="text-xs text-sand-800/80 leading-relaxed">
        A reminder to intentionally connect with someone you care about.
      </p>

      {people.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-sand-900">Who did you reach out to?</p>
          <div className="grid grid-cols-2 gap-2">
            {people.map((person) => {
              const doneToday = person.lastContactedAt?.slice(0, 10) === today;
              return (
                <button
                  key={person.id}
                  onClick={() => {
                    if (doneToday) return;
                    void markContactedToday(person.id);
                    onConnected();
                  }}
                  aria-pressed={doneToday}
                  className={`p-2.5 rounded-2xl border text-left transition-all ${
                    doneToday
                      ? 'bg-sage-100 border-sage-500/40'
                      : 'bg-sand-50 hover:bg-sand-100 border-sand-200'
                  }`}
                >
                  <span className="block text-xs font-semibold text-sand-900 truncate">
                    {doneToday ? '✓ ' : ''}
                    {person.name}
                  </span>
                  <span className="block text-[10px] text-sand-800/60">
                    {doneToday ? 'Connected today' : `Last: ${describeLastContact(person.lastContactedAt)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-sand-800/60 bg-sand-50 border border-sand-200 rounded-2xl px-3 py-2">
          Tip: add the people you want to stay close to under Me → My People, and they'll show up here.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-sand-900">Optional message ideas (tap to copy):</p>
        {PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => copyPrompt(prompt, idx)}
            className="w-full p-3 bg-sand-50 hover:bg-sand-100 border border-sand-200 rounded-2xl text-xs text-sand-900 text-left transition-all relative group"
          >
            <span className="block pr-16">"{prompt}"</span>
            <span className="absolute right-3 top-3 text-[10px] font-semibold text-terracotta-600 bg-terracotta-100 px-2 py-0.5 rounded-lg">
              {copied === idx ? 'Copied! ✓' : 'Copy'}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl transition-colors"
      >
        Mark Relationship Connection Logged
      </button>
    </Modal>
  );
}
