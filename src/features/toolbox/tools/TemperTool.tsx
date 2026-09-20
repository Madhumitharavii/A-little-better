import { useEffect, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ToolEnding from '../ToolEnding';
import type { ReflectionToolProps } from '../types';

export default function TemperTool({ date, onClose, showToast }: ReflectionToolProps) {
  const [happened, setHappened] = useState('');
  const [feeling, setFeeling] = useState('');
  const [impulse, setImpulse] = useState('');
  const [futureSelf, setFutureSelf] = useState('');
  const [phase, setPhase] = useState<'form' | 'pause' | 'end'>('form');
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    if (phase !== 'pause') return;
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]);

  const body = [
    `What happened: ${happened}`,
    `What I felt: ${feeling}`,
    `What I wanted to do: ${impulse}`,
    `What my calm self would want: ${futureSelf}`,
  ].join('\n');

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🕊️" title="Temper & Anger Pause" onClose={onClose} />

      {phase === 'form' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">1. What happened?</label>
            <input
              type="text"
              value={happened}
              onChange={(e) => setHappened(e.target.value)}
              placeholder="The trigger or situation..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">2. What am I feeling right now?</label>
            <input
              type="text"
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
              placeholder="e.g., Hurt, frustrated, ignored..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">3. What do I want to do right now?</label>
            <input
              type="text"
              value={impulse}
              onChange={(e) => setImpulse(e.target.value)}
              placeholder="e.g., React immediately, send an angry message..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">
              4. What would my calm self wish I'd done, looking back tomorrow?
            </label>
            <input
              type="text"
              value={futureSelf}
              onChange={(e) => setFutureSelf(e.target.value)}
              placeholder="e.g., Waited an hour, spoke calmly..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            onClick={() => setPhase('pause')}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-2xl transition-colors shadow-sm"
          >
            Take a 30-second pause before responding
          </button>
        </div>
      )}

      {phase === 'pause' && (
        <div className="text-center py-8 space-y-6">
          <div className="text-4xl font-serif text-amber-600 font-bold">
            {secondsLeft > 0 ? `${secondsLeft}s` : 'Pause complete'}
          </div>
          <p className="text-xs text-sand-800 max-w-xs mx-auto">
            {secondsLeft > 0
              ? 'Breathe slowly. You do not need to react immediately.'
              : "You created space between impulse and action. Choose what serves you."}
          </p>
          <button
            onClick={() => setPhase('end')}
            disabled={secondsLeft > 0}
            className="py-2.5 px-6 bg-sand-900 disabled:opacity-40 text-white text-xs font-semibold rounded-2xl"
          >
            Continue
          </button>
        </div>
      )}

      {phase === 'end' && (
        <ToolEnding
          date={date}
          sourceTool="temper"
          title="Temper & anger pause"
          body={body}
          closingLine="You paused. That's the whole practice."
          onClose={() => {
            showToast('Peace preserved 🕊️');
            onClose();
          }}
          showToast={showToast}
        />
      )}
    </Modal>
  );
}
