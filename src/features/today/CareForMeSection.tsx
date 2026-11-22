import { useState } from 'react';
import type { CareEntry } from '@/db/schema';
import CareItemRow from './CareItemRow';
import ReadingTracker from './ReadingTracker';
import FocusTimerCard from './FocusTimerCard';

const BASIC_ITEMS = [
  { id: 'bathed' as const, label: 'Bath / Shower', icon: '🧼', desc: 'Warm refresh to mark the day' },
  { id: 'ateFruit' as const, label: 'Fresh Fruit', icon: '🍎', desc: 'Something whole & nourishing' },
  { id: 'movement' as const, label: 'Gentle Movement', icon: '🧘', desc: 'Stretch, walk, or light movement' },
];

/** Folded or not is a per-device choice (a phone may want it folded, a Mac open). */
const COLLAPSED_KEY = 'alb.careForMe.collapsed';
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

interface CareForMeSectionProps {
  findEntry: (itemKey: (typeof BASIC_ITEMS)[number]['id'] | 'reading' | 'focus') => CareEntry | undefined;
  onToggleDone: (itemKey: string) => void;
  onRequestSkip: (itemKey: string) => void;
  onAddReadingMinutes: (minutes: number) => void;
  onOpenFocusTimer: () => void;
  showToast: (msg: string) => void;
}

export default function CareForMeSection({
  findEntry,
  onToggleDone,
  onRequestSkip,
  onAddReadingMinutes,
  onOpenFocusTimer,
  showToast,
}: CareForMeSectionProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1');
      } catch {
        /* storage unavailable — fine, it just won't be remembered */
      }
      return !c;
    });
  };

  // Today at a glance: the three basics, reading and focus.
  const readingMins = findEntry('reading')?.valueMinutes ?? 0;
  const focusMins = findEntry('focus')?.valueMinutes ?? 0;
  const done =
    BASIC_ITEMS.filter((i) => findEntry(i.id)?.status === 'done').length +
    (findEntry('reading')?.status === 'done' || readingMins > 0 ? 1 : 0) +
    (focusMins > 0 ? 1 : 0);
  const total = BASIC_ITEMS.length + 2;
  const summary = [`${done} of ${total}`, readingMins ? `${readingMins}m reading` : '', focusMins ? `${focusMins}m focus` : ''].filter(Boolean).join(' · ');

  return (
    <section id="care-for-me" className="bg-sage-100/50 p-4 sm:p-6 rounded-3xl border border-sage-300/70 shadow-sm space-y-4 scroll-mt-4">
      <button
        onClick={toggle}
        aria-expanded={!collapsed}
        className={`w-full flex items-center justify-between gap-2 text-left ${collapsed ? '' : 'border-b border-sand-100 pb-3'}`}
      >
        <h3 className="serif text-xl text-sand-900 font-semibold flex items-center gap-2">
          <span>🛁</span> Care for Me
        </h3>
        <span className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${done === total ? 'bg-sage-500 text-white' : 'bg-sand-100 text-sand-800'}`}>
            {collapsed ? summary : `${done} of ${total} today`}
          </span>
          <span className={`text-sand-800/50 text-xs transition-transform ${collapsed ? '' : 'rotate-180'}`} aria-hidden>
            ▾
          </span>
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-2.5">
          {BASIC_ITEMS.map((item) => (
            <CareItemRow
              key={item.id}
              icon={item.icon}
              label={item.label}
              description={item.desc}
              entry={findEntry(item.id)}
              onToggleDone={() => onToggleDone(item.id)}
              onRequestSkip={() => onRequestSkip(item.id)}
            />
          ))}

          <ReadingTracker
            entry={findEntry('reading')}
            onAddMinutes={onAddReadingMinutes}
            onToggleDone={() => onToggleDone('reading')}
            showToast={showToast}
          />

          <FocusTimerCard entry={findEntry('focus')} onOpen={onOpenFocusTimer} />
        </div>
      )}
    </section>
  );
}
