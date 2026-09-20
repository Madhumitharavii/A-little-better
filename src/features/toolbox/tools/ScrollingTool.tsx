import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { ReflectionToolProps } from '../types';

interface Option {
  id: string;
  label: string;
}

const OPTIONS: Option[] = [
  { id: 'read', label: 'Read a book' },
  { id: 'movie', label: 'Watch a movie' },
  { id: 'art', label: 'Draw or paint' },
  { id: 'bath', label: 'Take a bath' },
  { id: 'focus', label: 'Work or study' },
  { id: 'rest', label: 'Rest eyes / close phone' },
];

export default function ScrollingTool({ onClose, showToast, openTool }: ReflectionToolProps) {
  const [selected, setSelected] = useState<Option | null>(null);

  const act = (opt: Option) => {
    onClose();
    if (opt.id === 'focus' && openTool) {
      openTool('focusTimer');
      return;
    }
    const messages: Record<string, string> = {
      read: 'Opening a quiet page... 📖',
      movie: 'Enjoy movie time 🎬',
      art: 'Grab a pencil or brush 🎨',
      bath: 'Warm bath time 🧼',
      rest: 'Resting is taking care of yourself 🌿',
    };
    showToast(messages[opt.id] ?? 'Enjoy your chosen activity');
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="📱" title="I'm Scrolling" onClose={onClose} />

      <div>
        <p className="text-xs font-semibold text-sand-900 mb-1">What did you actually want to do?</p>
        <p className="text-[11px] text-sand-800/60 mb-3">No shame in scrolling. Just gently checking in.</p>

        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelected(opt)}
              className={`p-3 text-left border rounded-2xl text-xs font-medium transition-all ${
                selected?.id === opt.id
                  ? 'bg-terracotta-400 text-white border-terracotta-400 shadow-sm'
                  : 'bg-sand-50 border-sand-200 text-sand-900 hover:bg-sand-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 pt-2">
        {selected && (
          <button
            onClick={() => act(selected)}
            className="w-full py-3 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl transition-all shadow-sm"
          >
            Switch to: {selected.label} →
          </button>
        )}

        <button
          onClick={() => {
            onClose();
            showToast('Enjoy your screen time without guilt 🌿');
          }}
          className="w-full py-2.5 bg-sand-100 hover:bg-sand-200 text-sand-800 text-xs font-semibold rounded-2xl transition-all"
        >
          I'm intentionally scrolling
        </button>
      </div>
    </Modal>
  );
}
