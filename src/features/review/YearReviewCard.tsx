import { useState } from 'react';
import YearReviewModal from './YearReviewModal';

/**
 * The way into Year in review. The year you're in stays sealed until it
 * ends; finished years are always there to look back on.
 *  - On Life (default): a small card near the bottom.
 *  - On Today (`justOpened`): only in the first two weeks of January, to
 *    say last year's review is ready.
 */
export default function YearReviewCard({ justOpened }: { justOpened?: boolean }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;
  if (justOpened && !(now.getMonth() === 0 && now.getDate() <= 15)) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full text-left rounded-3xl border border-sage-300/70 bg-gradient-to-br from-sage-100/70 to-terracotta-100/50 shadow-sm flex items-center gap-4 ${
          justOpened ? 'p-4 sm:p-5' : 'p-4'
        }`}
      >
        <span className={justOpened ? 'text-3xl' : 'text-2xl'}>✨</span>
        <span className="min-w-0 flex-1">
          <span className={`block serif font-semibold text-sand-900 ${justOpened ? 'text-lg' : 'text-base'}`}>
            {justOpened ? `Your ${lastYear} in review is here` : 'Year in review'}
          </span>
          <span className="block text-[11px] text-sand-800/70">
            {justOpened
              ? 'Films, books, your words, lines you loved, and how you looked after yourself.'
              : `Look back on past years. ${thisYear} opens on 1 January ${thisYear + 1}.`}
          </span>
        </span>
        <span className="px-3 py-1.5 bg-sage-500 text-white text-xs font-semibold rounded-xl shrink-0">Look back</span>
      </button>
      {open && <YearReviewModal onClose={() => setOpen(false)} initialYear={lastYear} />}
    </>
  );
}
