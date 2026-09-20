import { useEffect, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';

interface FocusTimerToolProps {
  onClose: () => void;
  onComplete: (minutes: number) => void;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function FocusTimerTool({ onClose, onComplete }: FocusTimerToolProps) {
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [timeLeft, setTimeLeft] = useState(600);
  const [isRunning, setIsRunning] = useState(false);

  const selectMinutes = (mins: number) => {
    setDurationMinutes(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
  };

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [isRunning, timeLeft]);

  useEffect(() => {
    if (isRunning && timeLeft === 0) {
      onComplete(durationMinutes);
    }
  }, [isRunning, timeLeft, durationMinutes, onComplete]);

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <ModalHeader icon="🎯" title="Low-Friction Focus" onClose={onClose} />

      <div className="flex justify-center gap-2">
        {[5, 10, 15, 25].map((m) => (
          <button
            key={m}
            onClick={() => selectMinutes(m)}
            className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-all ${
              durationMinutes === m ? 'bg-terracotta-400 text-white font-semibold shadow-sm' : 'bg-sand-100 text-sand-800'
            }`}
          >
            {m}m
          </button>
        ))}
      </div>

      <div className="text-5xl font-serif text-sand-900 my-4 tracking-tight text-center">{formatTime(timeLeft)}</div>

      <p className="text-xs text-sand-800/70 text-center">
        The goal is simply to start. Stopping whenever you like is completely allowed.
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => setIsRunning((r) => !r)}
          className="flex-1 py-2.5 bg-terracotta-400 text-white text-xs font-semibold rounded-2xl hover:bg-terracotta-600 transition-colors"
        >
          {isRunning ? 'Pause' : 'Start Focus'}
        </button>
        <button
          onClick={() => onComplete(Math.max(1, Math.round((durationMinutes * 60 - timeLeft) / 60)))}
          className="px-4 py-2.5 bg-sand-100 text-sand-800 hover:bg-sand-200 text-xs font-semibold rounded-2xl"
        >
          Log & Wrap Up
        </button>
      </div>
    </Modal>
  );
}
