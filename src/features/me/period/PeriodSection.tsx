import { useState } from 'react';
import { usePeriodEntries } from './usePeriodEntries';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import PeriodManagerModal from './PeriodManagerModal';

interface PeriodSectionProps {
  showToast: (msg: string) => void;
}

export default function PeriodSection({ showToast }: PeriodSectionProps) {
  const [open, setOpen] = useState(false);
  const { stats } = usePeriodEntries();

  return (
    <div className="p-3 bg-sand-50 rounded-2xl border border-sand-200 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-sand-900 text-xs">🌙 Cycle Tracking</p>
        <p className="text-[11px] text-sand-800/60 truncate">
          {stats.cycleCount === 0
            ? 'No cycles logged yet'
            : stats.predictedNextStart
              ? `Next period around ${formatDisplayDate(stats.predictedNextStart)}`
              : `${stats.cycleCount} cycle${stats.cycleCount === 1 ? '' : 's'} logged`}
        </p>
      </div>
      <button onClick={() => setOpen(true)} className="px-3 py-2 bg-sand-200 hover:bg-sand-300 text-sand-900 rounded-xl font-semibold text-xs shrink-0">
        Manage
      </button>

      {open && <PeriodManagerModal onClose={() => setOpen(false)} showToast={showToast} />}
    </div>
  );
}
