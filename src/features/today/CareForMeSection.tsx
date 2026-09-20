import type { CareEntry } from '@/db/schema';
import CareItemRow from './CareItemRow';
import ReadingTracker from './ReadingTracker';
import FocusTimerCard from './FocusTimerCard';

const BASIC_ITEMS = [
  { id: 'bathed' as const, label: 'Bath / Shower', icon: '🧼', desc: 'Warm refresh to mark the day' },
  { id: 'ateFruit' as const, label: 'Fresh Fruit', icon: '🍎', desc: 'Something whole & nourishing' },
  { id: 'movement' as const, label: 'Gentle Movement', icon: '🧘', desc: 'Stretch, walk, or light movement' },
];

interface CareForMeSectionProps {
  findEntry: (itemKey: (typeof BASIC_ITEMS)[number]['id'] | 'reading' | 'focus') => CareEntry | undefined;
  onToggleDone: (itemKey: string) => void;
  onRequestSkip: (itemKey: string) => void;
  onAddReadingMinutes: (minutes: number) => void;
  onOpenFocusTimer: () => void;
}

export default function CareForMeSection({
  findEntry,
  onToggleDone,
  onRequestSkip,
  onAddReadingMinutes,
  onOpenFocusTimer,
}: CareForMeSectionProps) {
  return (
    <section className="bg-white p-5 sm:p-6 rounded-3xl border border-sand-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-sand-100 pb-3">
        <h3 className="serif text-xl text-sand-900 font-semibold flex items-center gap-2">
          <span>🛁</span> Care for Me
        </h3>
        <span className="text-[11px] bg-sand-100 text-sand-800 px-2.5 py-0.5 rounded-full font-medium">Daily basics</span>
      </div>

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
        />

        <FocusTimerCard entry={findEntry('focus')} onOpen={onOpenFocusTimer} />
      </div>
    </section>
  );
}
