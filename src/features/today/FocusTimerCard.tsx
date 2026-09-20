import type { CareEntry } from '@/db/schema';

interface FocusTimerCardProps {
  entry: CareEntry | undefined;
  onOpen: () => void;
}

export default function FocusTimerCard({ entry, onOpen }: FocusTimerCardProps) {
  const minutes = entry?.valueMinutes ?? 0;

  return (
    <div className="p-3 bg-sand-50/50 border border-sand-200 rounded-2xl flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg shrink-0">🎯</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sand-900">Focused Work</p>
          <p className="text-[11px] text-sand-800/60">
            {minutes > 0 ? `${minutes} mins logged` : 'Default 10 min low-friction start'}
          </p>
        </div>
      </div>
      <button
        onClick={onOpen}
        className="px-3 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white font-medium text-xs rounded-xl shadow-sm transition-colors shrink-0"
      >
        Start Focus
      </button>
    </div>
  );
}
