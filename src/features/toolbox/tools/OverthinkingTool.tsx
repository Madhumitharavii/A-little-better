import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ToolEnding from '../ToolEnding';
import type { ReflectionToolProps } from '../types';

export default function OverthinkingTool({ date, onClose, showToast }: ReflectionToolProps) {
  const [mode, setMode] = useState<'inquiry' | 'grounding'>('inquiry');
  const [worried, setWorried] = useState('');
  const [facts, setFacts] = useState('');
  const [predictions, setPredictions] = useState('');
  const [canAct, setCanAct] = useState<boolean | null>(null);
  const [actionText, setActionText] = useState('');
  const [finished, setFinished] = useState(false);

  const body = [
    `What I was worried about: ${worried}`,
    `What I actually know: ${facts}`,
    `What I was predicting: ${predictions}`,
    canAct === true ? `One useful action: ${actionText}` : null,
    canAct === false ? `Decided this is outside my control right now.` : null,
  ]
    .filter(Boolean)
    .join('\n');

  if (finished) {
    return (
      <Modal onClose={onClose}>
        <ModalHeader icon="🌊" title="Overthinking Reset" onClose={onClose} />
        <ToolEnding
          date={date}
          sourceTool="overthinking"
          title="Overthinking reset"
          body={body}
          closingLine="You separated what's real from what your mind is guessing."
          onClose={onClose}
          showToast={showToast}
        />
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🌊" title="Overthinking Reset" onClose={onClose} />

      <div className="flex bg-sand-100 p-1 rounded-2xl text-xs font-medium">
        <button
          onClick={() => setMode('inquiry')}
          className={`flex-1 py-1.5 rounded-xl ${mode === 'inquiry' ? 'bg-white shadow-sm font-semibold text-sand-900' : 'text-sand-800/70'}`}
        >
          Fact vs. Prediction
        </button>
        <button
          onClick={() => setMode('grounding')}
          className={`flex-1 py-1.5 rounded-xl ${mode === 'grounding' ? 'bg-white shadow-sm font-semibold text-sand-900' : 'text-sand-800/70'}`}
        >
          Optional Grounding
        </button>
      </div>

      {mode === 'inquiry' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">1. What am I worried about?</label>
            <textarea
              rows={2}
              value={worried}
              onChange={(e) => setWorried(e.target.value)}
              placeholder="Describe the thoughts..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sage-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-sand-900 mb-1">2. What do I actually know?</label>
              <p className="text-[10px] text-sand-800/60 mb-1">Facts, proven right now</p>
              <textarea
                rows={2}
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="Concrete facts..."
                className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sage-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sand-900 mb-1">3. What am I predicting?</label>
              <p className="text-[10px] text-sand-800/60 mb-1">Assumptions & worst-cases</p>
              <textarea
                rows={2}
                value={predictions}
                onChange={(e) => setPredictions(e.target.value)}
                placeholder="What my brain is guessing..."
                className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sage-500 resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-sand-900 mb-1">4. Can I do anything about it right now?</label>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setCanAct(true)}
                className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  canAct === true ? 'bg-sage-500 text-white border-sage-500' : 'bg-sand-50 border-sand-200 text-sand-800'
                }`}
              >
                Yes, there's an action
              </button>
              <button
                onClick={() => setCanAct(false)}
                className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  canAct === false ? 'bg-slate-800 text-white border-slate-800' : 'bg-sand-50 border-sand-200 text-sand-800'
                }`}
              >
                No, outside my control
              </button>
            </div>
          </div>

          {canAct === true && (
            <div className="p-3 bg-sage-100/50 rounded-2xl border border-sage-300 space-y-2">
              <label className="block text-xs font-semibold text-sand-900">What's one useful action I can take?</label>
              <input
                type="text"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="One calm step..."
                className="w-full p-2.5 bg-white border border-sage-300 rounded-xl text-xs text-sand-900 focus:outline-none"
              />
            </div>
          )}

          {canAct === false && (
            <div className="p-4 bg-sand-100 rounded-2xl border border-sand-200 text-center space-y-1">
              <p className="text-sm font-semibold text-sand-900">🕊️ I don't have to solve this right now.</p>
              <p className="text-xs text-sand-800/70">It's safe to put this down for today.</p>
            </div>
          )}

          <button
            onClick={() => setFinished(true)}
            className="w-full py-2.5 bg-sand-900 text-white text-xs font-semibold rounded-2xl hover:bg-sand-800 transition-colors"
          >
            Close & Clear Mind
          </button>
        </div>
      ) : (
        <div className="text-center py-6 space-y-6">
          <div className="w-24 h-24 rounded-full bg-sage-100 border-2 border-sage-300 mx-auto flex items-center justify-center">
            <span className="text-xs text-sage-700 font-semibold">Breathe In...</span>
          </div>
          <div className="space-y-2 max-w-xs mx-auto text-xs text-sand-800">
            <p className="font-semibold text-sand-900">5-4-3-2-1 Grounding:</p>
            <p>• 5 things you can see</p>
            <p>• 4 things you can touch</p>
            <p>• 3 things you can hear</p>
            <p>• 2 things you can smell</p>
            <p>• 1 deep breath</p>
          </div>
          <button onClick={onClose} className="py-2 px-6 bg-sand-900 text-white text-xs font-semibold rounded-2xl">
            I Feel More Grounded
          </button>
        </div>
      )}
    </Modal>
  );
}
