import type { CareEntry } from '@/db/schema';

interface ReadingTrackerProps {
  entry: CareEntry | undefined;
  onAddMinutes: (minutes: number) => void;
  onToggleDone: () => void;
}

export default function ReadingTracker({ entry, onAddMinutes, onToggleDone }: ReadingTrackerProps) {
  const isDone = entry?.status === 'done';
  const minutes = entry?.valueMinutes ?? 0;

  return (
    <div className="p-3 bg-sand-50/50 border border-sand-200 rounded-2xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">📖</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sand-900">Reading</p>
            <p className="text-[11px] text-sand-800/60">{minutes} mins logged today</p>
          </div>
        </div>
        <button
          onClick={onToggleDone}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border shrink-0 ${
            isDone ? 'bg-sage-500 text-white border-sage-500' : 'bg-white border-sand-300 text-sand-800'
          }`}
        >
          {isDone ? 'Done ✓' : 'Mark Done'}
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        {[5, 10, 15].map((mins) => (
          <button
            key={mins}
            onClick={() => onAddMinutes(mins)}
            className="flex-1 py-2 bg-white hover:bg-sand-100 border border-sand-200 rounded-xl text-[11px] font-medium text-sand-800 transition-colors"
          >
            +{mins}m
          </button>
        ))}
      </div>
    </div>
  );
}
