import { useState } from 'react';
import type { LetterItem } from '@/db/schema';
import { useToday } from '@/shared/hooks/useToday';
import { useLetters } from './useLetters';
import { longDate, unreadOpen } from './letters';
import ReadLetterModal from './ReadLetterModal';

/** On Today, when a letter from your past self has opened and you haven't read it yet. */
export default function LetterOpenBanner() {
  const today = useToday();
  const waiting = unreadOpen(useLetters(), today);
  const [reading, setReading] = useState<LetterItem | null>(null);
  const first = waiting[0];
  if (!first && !reading) return null;

  return (
    <>
      {first && (
        <button
          onClick={() => setReading(first)}
          className="w-full text-left p-4 sm:p-5 rounded-3xl border border-terracotta-400/40 bg-terracotta-100/50 shadow-sm flex items-center gap-4"
        >
          <span className="text-3xl">💌</span>
          <span className="min-w-0 flex-1">
            <span className="block serif text-lg font-semibold text-sand-900">A message from your past self is open</span>
            <span className="block text-xs text-sand-800/70">
              Written {longDate(first.writtenOn)}
              {waiting.length > 1 ? ` · and ${waiting.length - 1} more waiting` : ''}
            </span>
          </span>
          <span className="px-3.5 py-2 bg-terracotta-400 text-white text-xs font-semibold rounded-2xl shrink-0">Read it</span>
        </button>
      )}
      {reading && <ReadLetterModal letter={reading} onClose={() => setReading(null)} />}
    </>
  );
}
