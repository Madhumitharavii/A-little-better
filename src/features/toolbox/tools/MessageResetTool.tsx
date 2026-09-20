import { useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';

interface MessageResetToolProps {
  onClose: () => void;
  onComplete: () => void;
}

const APPS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram DMs' },
  { id: 'snapchat', label: 'Snapchat' },
  { id: 'texts', label: 'SMS / iMessage' },
];

export default function MessageResetTool({ onClose, onComplete }: MessageResetToolProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked((p) => ({ ...p, [id]: !p[id] }));

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <ModalHeader icon="💬" title="Nightly Message Reset" onClose={onClose} />

      <p className="text-xs text-sand-800/80 leading-relaxed">
        Manually check off channels you reviewed today. Leaving messages intentionally unanswered is completely okay.
      </p>

      <div className="space-y-2">
        {APPS.map((item) => (
          <div
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`p-3 rounded-2xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
              checked[item.id] ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold' : 'bg-sand-50 border-sand-200 text-sand-800'
            }`}
          >
            <span>{item.label}</span>
            <span>{checked[item.id] ? 'Reviewed ✓' : '◯'}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-2xl transition-colors"
      >
        Mark Nightly Message Check Complete
      </button>
    </Modal>
  );
}
