import { useState } from 'react';
import { formatFriendlyDate } from '@/db/dateUtils';
import type { StreakMetrics } from '@/shared/utils/streaks';

const GENTLE_QUOTES = [
  "Don't optimize your life. Take care of it.",
  'Resting is taking care of yourself, not failing at productivity.',
  'A tidy space is a quiet gift to your future self.',
  "You don't need to finish everything today.",
  'Showing up for 2 minutes is infinitely better than 0 minutes.',
  'Be soft with your thoughts today.',
];

interface GreetingHeaderProps {
  date: string;
  streaks: StreakMetrics;
  eveningDone: boolean;
  onOpenBored: () => void;
  onOpenScrolling: () => void;
  onOpenEvening: () => void;
}

export default function GreetingHeader({
  date,
  streaks,
  eveningDone,
  onOpenBored,
  onOpenScrolling,
  onOpenEvening,
}: GreetingHeaderProps) {
  const [quote] = useState(() => GENTLE_QUOTES[Math.floor(Math.random() * GENTLE_QUOTES.length)]);

  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  if (hour >= 17) greeting = 'Good evening';

  return (
    <section className="bg-gradient-to-br from-sand-100 to-sand-200/50 p-5 sm:p-8 rounded-3xl border border-sand-200 card-transition">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-terracotta-600 mb-1">
            {formatFriendlyDate(date)}
          </p>
          <h2 className="serif text-2xl sm:text-4xl text-sand-900 font-normal">{greeting}.</h2>
          <p className="mt-2 text-sm text-sand-800/80 italic font-serif">"{quote}"</p>
        </div>

        <div className="flex flex-col gap-2 self-start sm:self-center">
          {streaks.isReturningAfterGap ? (
            <div className="bg-white/90 backdrop-blur px-3.5 py-2 rounded-2xl border border-sand-200 flex items-center gap-2 text-xs text-sand-800 shadow-sm">
              <span>🌱</span>
              <span>Welcome back 🌱 Ready when you are today.</span>
            </div>
          ) : streaks.showingUpStreak > 0 ? (
            <div className="bg-white/90 backdrop-blur px-3.5 py-2 rounded-2xl border border-sand-200 flex items-center gap-2 text-xs font-semibold text-sand-900 shadow-sm">
              <span>🌱</span>
              <span>{streaks.showingUpStreak} days of showing up</span>
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur px-3.5 py-2 rounded-2xl border border-sand-200 flex items-center gap-2 text-xs text-sand-800 shadow-sm">
              <span>🌱</span>
              <span>Ready when you are today.</span>
            </div>
          )}

          {streaks.readingStreak > 0 && (
            <div className="bg-white/90 backdrop-blur px-3.5 py-2 rounded-2xl border border-sand-200 flex items-center gap-2 text-xs font-semibold text-sand-900 shadow-sm">
              <span>🔥</span>
              <span>{streaks.readingStreak} day reading streak</span>
            </div>
          )}
        </div>
      </div>

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
        <button
          onClick={onOpenEvening}
          className={`w-full sm:w-auto sm:ml-auto px-4 py-2.5 sm:py-2 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            eveningDone ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
          }`}
        >
          <span>🌙</span> {eveningDone ? 'Evening Done ✓' : 'Before I call it a day'}
        </button>
      </div>
    </section>
  );
}
