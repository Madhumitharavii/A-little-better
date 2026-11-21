import { formatFriendlyDate } from '@/db/dateUtils';
import type { StreakMetrics } from '@/shared/utils/streaks';


interface GreetingHeaderProps {
  date: string;
  streaks: StreakMetrics;
  onOpenBored: () => void;
  onOpenScrolling: () => void;
}

export default function GreetingHeader({ date, streaks, onOpenBored, onOpenScrolling }: GreetingHeaderProps) {
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  if (hour >= 17) greeting = 'Good evening';

  // A plain, friendly line — no numbers here (streaks live in Me → Patterns & Insights).
  const welcome = streaks.isReturningAfterGap
    ? "Welcome back. It's good to see you."
    : 'Take today at your own pace.';

  return (
    <section className="bg-gradient-to-br from-terracotta-100 via-sand-50 to-slate-100 p-5 sm:p-8 rounded-3xl border border-terracotta-400/15 card-transition">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-terracotta-600 mb-1">{formatFriendlyDate(date)}</p>
      <h2 className="serif text-2xl sm:text-4xl text-sand-900 font-normal">{greeting}.</h2>
      <p className="mt-2 text-sm text-sand-800/80 flex items-center gap-2">
        <span aria-hidden="true">🌱</span>
        <span>{welcome}</span>
      </p>

      <div className="mt-6 pt-5 border-t border-sand-200/60 flex flex-wrap items-center gap-2.5 sm:gap-3">
        <button
          onClick={onOpenBored}
          className="px-4 py-2.5 sm:py-2 bg-white hover:bg-sand-50 border border-sand-300 rounded-2xl text-xs font-semibold text-sand-900 shadow-sm transition-all flex items-center gap-2"
        >
          <span>✨</span> I'm bored
        </button>
        <button
          onClick={onOpenScrolling}
          className="px-4 py-2.5 sm:py-2 bg-white hover:bg-sand-50 border border-sand-300 rounded-2xl text-xs font-semibold text-sand-900 shadow-sm transition-all flex items-center gap-2"
        >
          <span>📱</span> I'm scrolling
        </button>
      </div>
    </section>
  );
}
