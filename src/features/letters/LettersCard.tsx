import { useState } from 'react';
import type { LetterItem } from '@/db/schema';
import { discardLetter } from '@/db/repositories/letterRepository';
import { useToday } from '@/shared/hooks/useToday';
import { useLetters } from './useLetters';
import { isOpen, longDate, untilText } from './letters';
import WriteLetterModal from './WriteLetterModal';
import ReadLetterModal from './ReadLetterModal';

/** Letters to your future self — sealed until the day you pick. */
export default function LettersCard({ showToast }: { showToast: (msg: string) => void }) {
  const today = useToday();
  const letters = useLetters();
  const [writing, setWriting] = useState(false);
  const [reading, setReading] = useState<LetterItem | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);

  const sealed = letters.filter((l) => !isOpen(l, today));
  const opened = letters.filter((l) => isOpen(l, today)).reverse();

  return (
    <section className="bg-white p-5 sm:p-6 rounded-3xl border border-sand-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="serif text-lg font-semibold text-sand-900">💌 Letters to future me</h3>
          <p className="text-xs text-sand-800/60">Write now, sealed until the day you choose. Then it opens by itself.</p>
        </div>
        <button
          onClick={() => setWriting(true)}
          className="px-3.5 py-2 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl shrink-0"
        >
          ✉️ Write one
        </button>
      </div>

      {letters.length > 0 && (
        <ul className="space-y-2">
          {opened.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => setReading(l)}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                  l.readAt ? 'bg-sand-50/60 border-sand-200 hover:border-sand-300' : 'bg-terracotta-100/50 border-terracotta-400/40'
                }`}
              >
                <span className="text-xl">{l.readAt ? '📖' : '💌'}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-sand-900">{l.readAt ? 'Opened letter' : 'New — it’s open!'}</span>
                  <span className="block text-[11px] text-sand-800/60">
                    Written {longDate(l.writtenOn)} · opened {longDate(l.openOn)}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {sealed.map((l) => (
            <li key={l.id} className="p-3 rounded-2xl border border-dashed border-sand-300 bg-sand-50/40 flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-sand-900">
                  Opens {longDate(l.openOn)} <span className="font-normal text-sand-800/60">· {untilText(today, l.openOn)}</span>
                </span>
                <span className="block text-[11px] text-sand-800/60">Written {longDate(l.writtenOn)} · sealed</span>
              </span>
              {discarding === l.id ? (
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={async () => {
                      await discardLetter(l.id);
                      setDiscarding(null);
                      showToast('Letter thrown away, unread.');
                    }}
                    className="text-[11px] font-semibold text-terracotta-600 px-2 py-1"
                  >
                    Throw away
                  </button>
                  <button onClick={() => setDiscarding(null)} className="text-[11px] text-sand-800/60 px-2 py-1">
                    Keep
                  </button>
                </span>
              ) : (
                <button onClick={() => setDiscarding(l.id)} aria-label="Throw this letter away" className="text-[11px] text-sand-800/40 hover:text-sand-800 px-2 py-1 shrink-0">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {writing && (
        <WriteLetterModal
          onClose={() => setWriting(false)}
          onSealed={(openOn) => {
            setWriting(false);
            showToast(`Sealed 🔒 It opens ${longDate(openOn)}.`);
          }}
        />
      )}
      {reading && <ReadLetterModal letter={reading} onClose={() => setReading(null)} />}
    </section>
  );
}
