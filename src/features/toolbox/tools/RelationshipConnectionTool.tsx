import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';

interface RelationshipConnectionToolProps {
  onClose: () => void;
  onComplete: () => void;
}

const PROMPTS = [
  "Hey! Thinking of you today. Hope your week is treating you gently 🌿",
  "Saw something today that reminded me of you! Hope you're doing well.",
  "No need to reply right away—just wanted to send a warm hello!",
];

export default function RelationshipConnectionTool({ onClose, onComplete }: RelationshipConnectionToolProps) {
  const [copied, setCopied] = useState<number | null>(null);

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

      <div className="space-y-2">
        <p className="text-xs font-semibold text-sand-900">Optional message ideas (tap to copy):</p>
        {PROMPTS.map((prompt, idx) => (
          <div
            key={idx}
            onClick={() => copyPrompt(prompt, idx)}
            className="p-3 bg-sand-50 hover:bg-sand-100 border border-sand-200 rounded-2xl text-xs text-sand-900 cursor-pointer transition-all relative group"
          >
            <p className="pr-16">"{prompt}"</p>
            <span className="absolute right-3 top-3 text-[10px] font-semibold text-terracotta-600 bg-terracotta-100 px-2 py-0.5 rounded-lg">
              {copied === idx ? 'Copied! ✓' : 'Copy'}
            </span>
          </div>
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
