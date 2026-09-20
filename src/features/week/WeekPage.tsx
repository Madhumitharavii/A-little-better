import { useWeekData } from './useWeekData';
import { deriveLittleThings } from './littleThings';
import { usePeriodEntries } from '@/features/me/period/usePeriodEntries';
import { getLocalDateKey } from '@/db/dateUtils';
import { formatDisplayDate } from '@/shared/utils/formatDate';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const LITTLE_THING_STYLES = [
  'bg-sage-100 border-sage-300 text-sage-700',
  'bg-terracotta-100 border-terracotta-400/30 text-terracotta-600',
  'bg-slate-100 border-slate-500/20 text-slate-800',
  'bg-amber-50 border-amber-300/50 text-amber-700',
];

const GENTLE_CLOSERS = [
  'Whatever this week looked like, it was yours.',
  'Small things count. They all add up quietly.',
  'No week needs to be perfect to be worth remembering.',
  "Here's to whatever comes next.",
];

function formatWeekday(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'short' });
}

interface SectionRowProps {
  icon: string;
  label: string;
  items: { id: string; title: string }[];
  emptyHint: string;
  chipColor: string;
}

function SectionRow({ icon, label, items, emptyHint, chipColor }: SectionRowProps) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-sand-200 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-sand-800/60 flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${chipColor}`}>{icon}</span> {label}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-sand-800/50">{emptyHint}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="text-xs text-sand-800/80 truncate">
              {item.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WeekPage() {
  const today = getLocalDateKey();
  const week = useWeekData(today);
  const { stats: cycleStats } = usePeriodEntries();
  const littleThings = deriveLittleThings(week);
  const closer = GENTLE_CLOSERS[new Date().getDate() % GENTLE_CLOSERS.length];

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="text-center sm:text-left">
        <h2 className="serif text-2xl sm:text-3xl font-semibold text-sand-900">This Week</h2>
        <p className="text-sm text-sand-800/70 mt-1 italic font-serif">A gentle look back, not a scorecard.</p>
      </section>

      {/* 7-day visual strip */}
      <section className="bg-gradient-to-br from-sand-100 to-sand-200/50 p-5 sm:p-6 rounded-3xl border border-sand-200">
        <div className="flex justify-between gap-1 sm:gap-2">
          {week.days.map((day, i) => {
            const isToday = day.date === today;
            return (
              <div key={day.date} className="flex flex-col items-center gap-1.5 flex-1">
                <span className="text-[10px] font-semibold text-sand-800/50">{DAY_LETTERS[i]}</span>
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs transition-all ${
                    day.hasDone
                      ? 'bg-sage-500 text-white'
                      : day.hasSkipped
                        ? 'bg-sand-300 text-sand-800'
                        : 'bg-white border border-sand-200 text-sand-800/30'
                  } ${isToday ? 'ring-2 ring-terracotta-400 ring-offset-2 ring-offset-sand-100' : ''}`}
                >
                  {day.hasDone ? '🌱' : day.hasSkipped ? '~' : '·'}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-sand-800/70 text-center mt-4">
          You showed up on {week.daysShowedUp} of the last 7 days — {formatWeekday(week.days[0]?.date ?? today)} through {formatWeekday(today)}.
        </p>
      </section>

      {/* Cycle info — a small, non-clinical mention, full detail lives in Me */}
      {cycleStats.cycleCount > 0 && (
        <section className="bg-white p-4 rounded-2xl border border-sand-200 shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-sand-800/60 flex items-center gap-1.5">
              <span>🌙</span> Cycle
            </p>
            <p className="text-xs text-sand-800/70 mt-1">
              {cycleStats.predictedNextStart
                ? `Next period might start around ${formatDisplayDate(cycleStats.predictedNextStart)}`
                : `${cycleStats.cycleCount} cycle${cycleStats.cycleCount === 1 ? '' : 's'} logged`}
            </p>
          </div>
          <p className="text-[10px] text-sand-800/40 shrink-0">See Me → Cycle Tracking</p>
        </section>
      )}

      {/* Life activity this week */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SectionRow
          icon="📝"
          label="Journal"
          items={week.journalEntriesThisWeek.map((e) => ({ id: e.id, title: e.title || e.body.slice(0, 40) }))}
          emptyHint="No entries this week — that's fine."
          chipColor="bg-slate-100 text-slate-700"
        />
        <SectionRow
          icon="📖"
          label="Books"
          items={week.booksThisWeek.map((b) => ({ id: b.id, title: b.title }))}
          emptyHint="No book activity this week."
          chipColor="bg-sage-100 text-sage-700"
        />
        <SectionRow
          icon="🎬"
          label="Movies & Series"
          items={week.moviesAndSeriesThisWeek.map((m) => ({ id: m.id, title: m.title }))}
          emptyHint="Nothing watched this week."
          chipColor="bg-terracotta-100 text-terracotta-600"
        />
        <SectionRow
          icon="🎨"
          label="Artwork"
          items={week.artworkThisWeek.map((a) => ({ id: a.id, title: a.title || 'Untitled' }))}
          emptyHint="No artwork this week."
          chipColor="bg-amber-50 text-amber-700"
        />
      </section>

      <SectionRow
        icon="🌿"
        label="Experiences"
        items={week.experiencesThisWeek.map((e) => ({ id: e.id, title: e.title }))}
        emptyHint="Nothing logged this week — memories happen on their own schedule."
        chipColor="bg-sage-100 text-sage-700"
      />

      {/* Little things from this week — built from actual logged activity */}
      <section className="bg-white p-5 rounded-3xl border border-sand-200 shadow-sm space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-sand-800/60 flex items-center gap-1.5">
          <span>🎈</span> Little things from this week
        </p>
        <div className="flex flex-col gap-2">
          {littleThings.map((thing, i) => (
            <div
              key={thing.text}
              className={`px-3.5 py-2.5 rounded-2xl border text-xs font-medium flex items-center gap-2 ${LITTLE_THING_STYLES[i % LITTLE_THING_STYLES.length]}`}
            >
              <span className="text-base shrink-0">{thing.icon}</span>
              <span>{thing.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Thought of the Day */}
      <section className="bg-terracotta-100/50 p-5 rounded-3xl border border-terracotta-400/20 text-center">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-terracotta-600 mb-1.5">Thought of the Day</p>
        <p className="serif italic text-sand-900">"{closer}"</p>
      </section>
    </div>
  );
}
