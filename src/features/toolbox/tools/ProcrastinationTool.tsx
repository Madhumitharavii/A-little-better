import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ToolEnding from '../ToolEnding';
import type { ReflectionToolProps } from '../types';

export default function ProcrastinationTool({ date, onClose, showToast, openTool }: ReflectionToolProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 'end'>(1);
  const [avoiding, setAvoiding] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [microAction, setMicroAction] = useState('');
  const [chosenMinutes, setChosenMinutes] = useState<number | null>(null);

  const body = [
    `What I was avoiding: ${avoiding}`,
    `Why it felt hard: ${difficulty}`,
    `Smallest first action: ${microAction}`,
    chosenMinutes ? `Started with a ${chosenMinutes} minute focus block.` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🌱" title="Procrastination Reset" onClose={onClose} />

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs text-sand-800 leading-relaxed">
            Procrastination is usually about friction and confusion, not laziness. The goal is simply to start.
          </p>
          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">What am I avoiding right now?</label>
            <input
              type="text"
              value={avoiding}
              onChange={(e) => setAvoiding(e.target.value)}
              placeholder="e.g., Answering an email, filing a report..."
              className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-terracotta-400"
            />
          </div>
          <button
            disabled={!avoiding.trim()}
            onClick={() => setStep(2)}
            className="w-full py-2.5 bg-terracotta-400 disabled:opacity-50 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl transition-all"
          >
            Next: Understand the friction →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">Why does starting feel difficult?</label>
            <p className="text-[11px] text-sand-800/60 mb-2">Is it boring? Unclear? Too big?</p>
            <input
              type="text"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              placeholder="e.g., Unclear first step..."
              className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-terracotta-400"
            />
          </div>
          <button
            disabled={!difficulty.trim()}
            onClick={() => setStep(3)}
            className="w-full py-2.5 bg-terracotta-400 disabled:opacity-50 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl transition-all"
          >
            Next: Find a micro-action →
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">
              What's the smallest possible first action?
            </label>
            <p className="text-[11px] text-sand-800/60 mb-2">Something so tiny it feels easy (e.g., "Open the document").</p>
            <input
              type="text"
              value={microAction}
              onChange={(e) => setMicroAction(e.target.value)}
              placeholder="e.g., Write one sentence..."
              className="w-full p-3 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-terracotta-400"
            />
          </div>

          <div className="pt-2">
            <p className="text-xs font-semibold text-sand-900 mb-2">Pick a start duration:</p>
            <div className="grid grid-cols-4 gap-2">
              {[2, 5, 10, 25].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setChosenMinutes(m);
                    setStep('end');
                    if (openTool) {
                      // Hand off to the focus timer; the wizard's own
                      // reflection can still be saved afterward via Today.
                      setTimeout(() => openTool('focusTimer'), 50);
                    }
                  }}
                  disabled={!microAction.trim()}
                  className="py-2 text-xs font-semibold rounded-xl border transition-all bg-sand-50 hover:bg-sand-100 disabled:opacity-40 text-sand-900 border-sand-200"
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep('end')}
            className="w-full py-2 text-xs text-sand-800/60 hover:text-sand-900 font-medium text-center block"
          >
            Stopping here is allowed too.
          </button>
        </div>
      )}

      {step === 'end' && (
        <ToolEnding
          date={date}
          sourceTool="procrastination"
          title="Procrastination reset"
          body={body}
          closingLine="You named the friction. That's the hard part."
          onClose={() => {
            showToast('Beautiful job starting ✨');
            onClose();
          }}
          showToast={showToast}
        />
      )}
    </Modal>
  );
}
