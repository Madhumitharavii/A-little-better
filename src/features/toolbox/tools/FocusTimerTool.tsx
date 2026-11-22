import { useEffect, useRef, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import type { SubjectItem } from '@/db/schema';
import { useSubjects } from '@/features/study/useStudy';

/** What a focus session was for — when a study subject is chosen, the time also goes to the study log. */
export interface FocusFor {
  subject: SubjectItem;
  topicId?: string;
}

interface FocusTimerToolProps {
  onClose: () => void;
  onComplete: (minutes: number, focusFor?: FocusFor) => void;
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
  const subjects = useSubjects() ?? [];
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string>('');
  const subject = subjects.find((s) => s.id === subjectId);
  const focusFor: FocusFor | undefined = subject ? { subject, topicId: topicId || undefined } : undefined;
  // Finishing happens exactly once (a re-render mid-save used to log the session twice).
  const finished = useRef(false);
  const finish = (minutes: number) => {
    if (finished.current) return;
    finished.current = true;
    setIsRunning(false);
    onComplete(minutes, focusFor);
  };
  const elapsedMinutes = Math.round((durationMinutes * 60 - timeLeft) / 60);

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
      finish(durationMinutes);
    }
  }, [isRunning, timeLeft, durationMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <ModalHeader icon="⏳" title="Low-Friction Focus" onClose={onClose} />

      {subjects.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-sand-900 text-center">What's this for?</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {[{ id: null as string | null, label: 'Just focus' }, ...subjects.map((s) => ({ id: s.id as string | null, label: `${s.icon ?? '📘'} ${s.title}` }))].map((o) => (
              <button
                key={o.id ?? 'none'}
                onClick={() => {
                  setSubjectId(o.id);
                  setTopicId('');
                }}
                disabled={isRunning}
                className={`px-2.5 py-1 text-[11px] rounded-full border transition-all ${
                  subjectId === o.id ? 'bg-sage-500 text-white border-sage-500' : 'bg-sand-50 text-sand-800 border-sand-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {subject && subject.topics.length > 0 && (
            <select
              aria-label="Topic"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={isRunning}
              className="w-full p-2 bg-sand-50 border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none"
            >
              <option value="">Any topic</option>
              {subject.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {subject && <p className="text-[10px] text-sand-800/60 text-center">This time will also go to your {subject.title} study log.</p>}
        </div>
      )}

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
          onClick={() => (elapsedMinutes > 0 ? finish(elapsedMinutes) : onClose())}
          className="px-4 py-2.5 bg-sand-100 text-sand-800 hover:bg-sand-200 text-xs font-semibold rounded-2xl"
        >
          Log & Wrap Up
        </button>
      </div>
    </Modal>
  );
}
