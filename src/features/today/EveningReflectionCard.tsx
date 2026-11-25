import { useEffect, useRef, useState } from 'react';

interface EveningReflectionCardProps {
  gratitude: string;
  smallWin: string;
  onChange: (field: 'gratitude' | 'smallWin', value: string) => void;
  /** Whether "Before I call it a day" (the evening wind-down) is done today. */
  eveningDone: boolean;
  onOpenEvening: () => void;
  /** Opens "A letter to future me". */
  onWriteLetter?: () => void;
}

/** From this hour on, the reflection opens by itself — it's an end-of-day thing. */
const EVENING_HOUR = 17;

/**
 * "This evening": the end-of-day part of Today, kept together — the
 * "Before I call it a day" wind-down and Today's Reflection. The
 * reflection's writing fields stay folded during the day (unless
 * something's already written); tap to open them any time.
 */
export default function EveningReflectionCard({
  gratitude,
  smallWin,
  onChange,
  eveningDone,
  onOpenEvening,
  onWriteLetter,
}: EveningReflectionCardProps) {
  const startsOpen = new Date().getHours() >= EVENING_HOUR || !!gratitude || !!smallWin;
  const [open, setOpen] = useState(startsOpen);
  // There's no save button — every keystroke is saved. Say so, so it doesn't feel like it went nowhere.
  const [status, setStatus] = useState<'idle' | 'typing' | 'saved'>('idle');
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const write = (field: 'gratitude' | 'smallWin', value: string) => {
    onChange(field, value);
    setStatus('typing');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('saved'), 700);
  };

  return (
    <section className="bg-gradient-to-br from-slate-100 to-terracotta-100/60 p-5 sm:p-8 rounded-3xl border border-slate-500/20 shadow-sm space-y-4">
      <div className="border-b border-sand-100 pb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="serif text-xl text-sand-900 font-semibold">🌙 This Evening</h3>
          <p className="text-xs text-sand-800/60">Wind down, and unpack the day with soft notes. No pressure.</p>
        </div>
      </div>

      <button
        onClick={onOpenEvening}
        className={`w-full px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
          eveningDone ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
        }`}
      >
        <span>🌙</span> {eveningDone ? 'Evening Done ✓' : 'Before I call it a day'}
      </button>

      {onWriteLetter && (
        <button
          onClick={onWriteLetter}
          className="w-full px-4 py-2.5 rounded-2xl text-xs font-semibold bg-terracotta-100/60 hover:bg-terracotta-100 text-sand-900 transition-all flex items-center justify-center gap-2"
        >
          <span>💌</span> Write a letter to future me
        </button>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="w-full px-4 py-3 bg-sand-50 border border-sand-200 rounded-2xl flex items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-sand-900">Today's Reflection</span>
            <span className="block text-[11px] text-sand-800/60">Opens this evening — or tap to write now.</span>
          </span>
          <span aria-hidden="true" className="text-sand-800/50">⌄</span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-sand-900">Today's Reflection</p>
            <p aria-live="polite" className="text-[11px] text-sage-700 font-semibold">
              {status === 'saved' ? '✓ Saved' : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-sand-800 mb-1.5">Something I am grateful for today</label>
              <textarea
                aria-label="Something I am grateful for today"
                rows={2}
                value={gratitude}
                onChange={(e) => write('gratitude', e.target.value)}
                placeholder="A warm coffee, soft sunlight, a quiet moment..."
                className="w-full p-3 bg-sand-50/50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-sand-800 mb-1.5">A small win or quiet progress</label>
              <textarea
                aria-label="A small win or quiet progress"
                rows={2}
                value={smallWin}
                onChange={(e) => write('smallWin', e.target.value)}
                placeholder="I started a tough task, drank fresh water, rested well..."
                className="w-full p-3 bg-sand-50/50 border border-sand-200 rounded-2xl text-xs text-sand-900 focus:outline-none focus:border-sand-300 resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
