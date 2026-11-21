import { useStudyTimer, formatClock } from './studyTimer';
import { useSubjects } from './useStudy';

/** Shown in the header on every tab while a study timer runs; tap to go to it (Week). */
export default function StudyTimerPill({ onOpen }: { onOpen: () => void }) {
  const { timer, seconds } = useStudyTimer();
  const subjects = useSubjects();
  if (!timer) return null;
  const subject = subjects?.find((s) => s.id === timer.subjectId);
  return (
    <button
      onClick={onOpen}
      className="text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 text-white font-semibold tabular-nums"
      aria-label={`Study timer running${subject ? ` for ${subject.title}` : ''}: ${formatClock(seconds)}. Open.`}
    >
      <span aria-hidden="true">⏱️</span> {subject ? subject.title : 'Studying'} {formatClock(seconds)}
    </button>
  );
}
