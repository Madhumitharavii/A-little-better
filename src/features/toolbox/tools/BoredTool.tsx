import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { ReflectionToolProps } from '../types';

const SUGGESTIONS = [
  { text: 'Read a chapter of a book', icon: '📖' },
  { text: 'Doodle or paint on paper', icon: '🎨' },
  { text: 'Watch a good movie', icon: '🎬' },
  { text: 'Take a long warm bath', icon: '🧼' },
  { text: 'Go for a light 10-minute walk', icon: '🌿' },
  { text: 'Message a friend you miss', icon: '💬' },
  { text: 'Call someone you love', icon: '📞' },
  { text: 'Reset one small desk or tray surface', icon: '🧹' },
  { text: 'Listen to an album start to finish', icon: '🎵' },
  { text: 'Eat a piece of fresh fruit slowly', icon: '🍎' },
];

/**
 * A pure redirect, not a reflection — there's no meaningful text to
 * save, so this tool has no journal-ending step, matching the
 * prototype's intent.
 */
export default function BoredTool({ onClose, showToast }: ReflectionToolProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * SUGGESTIONS.length));
  const current = SUGGESTIONS[index];

  const nextSuggestion = () => {
    let next: number;
    do {
      next = Math.floor(Math.random() * SUGGESTIONS.length);
    } while (next === index && SUGGESTIONS.length > 1);
    setIndex(next);
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="✨" title="I'm Bored" onClose={onClose} />

      <p className="text-xs text-sand-800 leading-relaxed">
        You already have things you love doing. Choose one of these instead of automatically opening a feed:
      </p>

      <div className="p-6 bg-sand-100/70 border border-sand-200 rounded-3xl text-center space-y-3">
        <span className="text-4xl block">{current.icon}</span>
        <p className="serif text-xl text-sand-900 font-semibold">{current.text}</p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => {
            onClose();
            showToast(`Enjoy: ${current.text} 🌿`);
          }}
          className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl transition-all shadow-sm"
        >
          Let's do it ✨
        </button>
        <button
          onClick={nextSuggestion}
          className="px-4 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl transition-all"
        >
          Something else 🎲
        </button>
      </div>
    </Modal>
  );
}
