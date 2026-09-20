import { useEffect, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';

interface RoomResetTimerToolProps {
  onClose: () => void;
  onComplete: () => void;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function RoomResetTimerTool({ onClose, onComplete }: RoomResetTimerToolProps) {
  const [timeLeft, setTimeLeft] = useState(300);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    if (timeLeft <= 0) {
      onComplete();
      return;
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [isRunning, timeLeft, onComplete]);

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <ModalHeader icon="🧹" title="5-Minute Room Reset" onClose={onClose} />

      <div className="text-5xl font-serif text-sand-900 my-4 tracking-tight text-center">{formatTime(timeLeft)}</div>

      <p className="text-xs text-sand-800/70 text-center">
        Clear one primary surface, put away three wandering items, open a window.
      </p>

      <div className="flex gap-3">
        <button onClick={() => setIsRunning((r) => !r)} className="flex-1 py-2.5 bg-sand-900 text-white text-xs font-semibold rounded-2xl">
          {isRunning ? 'Pause' : 'Start Reset'}
        </button>
        <button
          onClick={onComplete}
          className="px-4 py-2.5 bg-sage-100 text-sage-700 hover:bg-sage-300/40 text-xs font-semibold rounded-2xl"
        >
          Done Early ✓
        </button>
      </div>
    </Modal>
  );
}
