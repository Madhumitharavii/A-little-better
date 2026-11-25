import { useState } from 'react';
import YearReviewModal from './YearReviewModal';

/**
 * The way into Year in review. On Today it only shows from December to
 * mid-January (`seasonal`); on Me it's always there.
 */
export default function YearReviewCard({ seasonal }: { seasonal?: boolean }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const december = now.getMonth() === 11;
  const earlyJanuary = now.getMonth() === 0 && now.getDate() <= 15;
  if (seasonal && !december && !earlyJanuary) return null;
  const year = earlyJanuary ? now.getFullYear() - 1 : now.getFullYear();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left p-4 sm:p-5 rounded-3xl border border-sage-300/70 bg-gradient-to-br from-sage-100/70 to-terracotta-100/50 shadow-sm flex items-center gap-4"
      >
        <span className="text-3xl">✨</span>
        <span className="min-w-0 flex-1">
          <span className="block serif text-lg font-semibold text-sand-900">Your {year} in review</span>
          <span className="block text-xs text-sand-800/70">Films, books, your words, lines you loved, and how you looked after yourself.</span>
        </span>
        <span className="px-3.5 py-2 bg-sage-500 text-white text-xs font-semibold rounded-2xl shrink-0">Look back</span>
      </button>
      {open && <YearReviewModal onClose={() => setOpen(false)} initialYear={year} />}
    </>
  );
}
