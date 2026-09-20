import Modal from '@/shared/components/Modal';

interface SkipReasonModalProps {
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const REASONS = ['Resting', 'Busy', 'Not feeling it', 'Already did enough', 'Other'];

export default function SkipReasonModal({ onClose, onConfirm }: SkipReasonModalProps) {
  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <div className="flex items-center justify-between border-b border-sand-100 pb-2 -mt-1">
        <h3 className="serif text-lg font-semibold text-sand-900">Intentional Skip</h3>
        <button onClick={onClose} aria-label="Close" className="text-sand-800/60 text-sm font-semibold">
          ✕
        </button>
      </div>
      <p className="text-xs text-sand-800/80">
        Skipping is an intentional choice, not a failure. Why are you choosing to skip today?
      </p>

      <div className="space-y-2">
        {REASONS.map((reason) => (
          <button
            key={reason}
            onClick={() => onConfirm(reason)}
            className="w-full p-2.5 text-left bg-sand-50 hover:bg-sand-100 border border-sand-200 rounded-xl text-xs font-medium text-sand-900 transition-colors"
          >
            {reason}
          </button>
        ))}
      </div>
    </Modal>
  );
}
