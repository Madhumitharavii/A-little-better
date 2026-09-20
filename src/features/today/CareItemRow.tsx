import type { CareEntry } from '@/db/schema';

interface CareItemRowProps {
  icon: string;
  label: string;
  description: string;
  entry: CareEntry | undefined;
  onToggleDone: () => void;
  onRequestSkip: () => void;
}

export default function CareItemRow({ icon, label, description, entry, onToggleDone, onRequestSkip }: CareItemRowProps) {
  const isDone = entry?.status === 'done';
  const isSkipped = entry?.status === 'skipped';

  return (
    <div
      className={`p-3 rounded-2xl border transition-all ${
        isDone
          ? 'bg-sage-100/40 border-sage-300 text-sand-900'
          : isSkipped
            ? 'bg-sand-100/50 border-sand-200 text-sand-800/60'
            : 'bg-sand-50/50 border-sand-200 hover:border-sand-300 text-sand-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <button onClick={onToggleDone} className="flex items-center gap-3 flex-1 text-left min-w-0 py-1">
          <span className="text-lg shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${isDone ? 'line-through text-sand-800/50' : ''}`}>{label}</p>
            <p className="text-[11px] text-sand-800/60 truncate">
              {isSkipped ? `Not today (${entry?.skipReason ?? 'resting'})` : description}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {!isDone && !isSkipped && (
            <button onClick={onRequestSkip} className="text-[10px] text-sand-800/50 hover:text-sand-800 underline px-1 py-2">
              Not today
            </button>
          )}

          <button
            onClick={onToggleDone}
            aria-label={isDone ? `Mark ${label} not done` : `Mark ${label} done`}
            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
              isDone
                ? 'bg-sage-500 border-sage-500 text-white'
                : isSkipped
                  ? 'bg-sand-300 border-sand-300 text-sand-900'
                  : 'border-sand-300 bg-white'
            }`}
          >
            {isDone && <span className="text-[10px]">✓</span>}
            {isSkipped && <span className="text-[10px]">~</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
