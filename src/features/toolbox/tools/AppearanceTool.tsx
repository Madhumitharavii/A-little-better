import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ToolEnding from '../ToolEnding';
import type { ReflectionToolProps } from '../types';

export default function AppearanceTool({ date, onClose, showToast }: ReflectionToolProps) {
  const [tellingSelf, setTellingSelf] = useState('');
  const [isFact, setIsFact] = useState<'fact' | 'feeling'>('feeling');
  const [valuableQuality, setValuableQuality] = useState('');
  const [finished, setFinished] = useState(false);

  const body = [
    `What I was telling myself: ${tellingSelf}`,
    `Fact or feeling: ${isFact === 'fact' ? 'Fact' : 'A temporary feeling'}`,
    `Something I value about myself beyond appearance: ${valuableQuality}`,
  ].join('\n');

  if (finished) {
    return (
      <Modal onClose={onClose}>
        <ModalHeader icon="🪞" title="Insecurity Check" onClose={onClose} />
        <ToolEnding
          date={date}
          sourceTool="appearance"
          title="Insecurity check"
          body={body}
          closingLine="You're more than how you look today."
          onClose={onClose}
          showToast={showToast}
        />
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🪞" title="Insecurity Check" onClose={onClose} />

      <p className="text-xs text-sand-800/80">
        This isn't a superficial reassurance generator. Let's ground in what's true and meaningful.
      </p>

      <div className="space-y-3 text-xs">
        <div>
          <label className="block font-semibold text-sand-900 mb-1">What am I telling myself?</label>
          <input
            type="text"
            value={tellingSelf}
            onChange={(e) => setTellingSelf(e.target.value)}
            placeholder="e.g., I don't look good today..."
            className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">Is this a fact or a feeling?</label>
          <div className="flex gap-2">
            <button
              onClick={() => setIsFact('fact')}
              className={`flex-1 py-2 rounded-xl border font-semibold ${isFact === 'fact' ? 'bg-sand-900 text-white' : 'bg-sand-50 border-sand-200 text-sand-800'}`}
            >
              Fact
            </button>
            <button
              onClick={() => setIsFact('feeling')}
              className={`flex-1 py-2 rounded-xl border font-semibold ${isFact === 'feeling' ? 'bg-terracotta-400 text-white' : 'bg-sand-50 border-sand-200 text-sand-800'}`}
            >
              A Temporary Feeling
            </button>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">
            What do I value about myself that has nothing to do with appearance?
          </label>
          <input
            type="text"
            value={valuableQuality}
            onChange={(e) => setValuableQuality(e.target.value)}
            placeholder="e.g., Kindness, humor, creativity, care for family..."
            className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none"
          />
        </div>
      </div>

      <button
        onClick={() => setFinished(true)}
        className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl transition-colors"
      >
        Continue
      </button>
    </Modal>
  );
}
