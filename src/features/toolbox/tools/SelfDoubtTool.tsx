import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import ToolEnding from '../ToolEnding';
import type { ReflectionToolProps } from '../types';

export default function SelfDoubtTool({ date, onClose, showToast }: ReflectionToolProps) {
  const [tellingSelf, setTellingSelf] = useState('');
  const [supports, setSupports] = useState('');
  const [against, setAgainst] = useState('');
  const [sayToFriend, setSayToFriend] = useState('');
  const [finished, setFinished] = useState(false);

  const body = [
    `What I was telling myself: ${tellingSelf}`,
    `Evidence supporting it: ${supports}`,
    `Evidence against it: ${against}`,
    `What I'd say to a friend: ${sayToFriend}`,
  ].join('\n');

  if (finished) {
    return (
      <Modal onClose={onClose}>
        <ModalHeader icon="🧭" title="Self-Doubt Inquiry" onClose={onClose} />
        <ToolEnding
          date={date}
          sourceTool="selfDoubt"
          title="Self-doubt inquiry"
          body={body}
          closingLine="Progress over perfection."
          onClose={onClose}
          showToast={showToast}
        />
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="🧭" title="Self-Doubt Inquiry" onClose={onClose} />

      <div className="space-y-3 text-xs">
        <div>
          <label className="block font-semibold text-sand-900 mb-1">1. What am I telling myself?</label>
          <input
            type="text"
            value={tellingSelf}
            onChange={(e) => setTellingSelf(e.target.value)}
            placeholder="e.g., I'm not good enough for this..."
            className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-sand-900 mb-1">2. Evidence supporting it?</label>
            <textarea
              rows={2}
              value={supports}
              onChange={(e) => setSupports(e.target.value)}
              placeholder="Concrete facts..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-sand-900 mb-1">3. Evidence against it?</label>
            <textarea
              rows={2}
              value={against}
              onChange={(e) => setAgainst(e.target.value)}
              placeholder="Past wins, effort, skills..."
              className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-sand-900 mb-1">4. What would I say to a friend in this situation?</label>
          <input
            type="text"
            value={sayToFriend}
            onChange={(e) => setSayToFriend(e.target.value)}
            placeholder="Kind, balanced words..."
            className="w-full p-2.5 bg-sand-50 border border-sand-200 rounded-2xl text-sand-900 focus:outline-none focus:border-slate-500"
          />
        </div>
      </div>

      <button
        onClick={() => setFinished(true)}
        className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-2xl transition-colors"
      >
        Continue
      </button>
    </Modal>
  );
}
