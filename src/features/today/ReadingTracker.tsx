import type { BookItem, CareEntry, WishItem } from '@/db/schema';
import { useLifeItemsOfType } from '@/features/life/useLifeItems';
import { booksFinishedIn, readingGoalTarget } from '@/features/life/wishlist/visionList';

interface ReadingTrackerProps {
  entry: CareEntry | undefined;
  onAddMinutes: (minutes: number) => void;
  onToggleDone: () => void;
  /** 'today', or 'yesterday' when ticking for the day before. */
  dayWord?: string;
}

/**
 * Daily reading minutes, and — if there's a "Read N books" vision goal —
 * how many books are finished this year. (It deliberately doesn't show
 * which book you're reading.)
 */
export default function ReadingTracker({ entry, onAddMinutes, onToggleDone, dayWord = 'today' }: ReadingTrackerProps) {
  const isDone = entry?.status === 'done';
  const minutes = entry?.valueMinutes ?? 0;
  const books = useLifeItemsOfType('book') as BookItem[];
  const wishes = useLifeItemsOfType('wish') as WishItem[];

  const year = new Date().getFullYear();
  const goal = wishes.find((w) => w.listType === 'annualVision' && !w.done && !w.missed && (w.year ?? year) === year && readingGoalTarget(w.title));
  const target = goal ? readingGoalTarget(goal.title) : null;

  return (
    <div className="p-3 bg-sand-50/50 border border-sand-200 rounded-2xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">📖</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sand-900">Reading</p>
            <p className="text-[11px] text-sand-800/60">
              {minutes} mins {dayWord}
              {target ? ` · ${booksFinishedIn(books, year)} of ${target} books this year` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleDone}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border shrink-0 ${
            isDone ? 'bg-sage-500 text-white border-sage-500' : 'bg-sand-50 border-sand-300 text-sand-800'
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
            className="flex-1 py-2 bg-sand-50 hover:bg-sand-100 border border-sand-200 rounded-xl text-[11px] font-medium text-sand-800 transition-colors"
          >
            +{mins}m
          </button>
        ))}
      </div>
    </div>
  );
}
