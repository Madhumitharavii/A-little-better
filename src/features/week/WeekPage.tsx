import { useWeekData } from './useWeekData';
import { deriveLittleThings } from './littleThings';
import { usePeriodEntries } from '@/features/me/period/usePeriodEntries';
import { getLocalDateKey } from '@/db/dateUtils';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { useState } from 'react';
import StudySection from '@/features/study/StudySection';
import SubjectPage from '@/features/study/SubjectPage';
import WeekSummaryCard from '@/features/ai/WeekSummaryCard';
import { useSubjects, useStudySessions, sessionsWithin, totalMinutes, formatMinutes } from '@/features/study/useStudy';


const LITTLE_THING_STYLES = [
  'bg-sage-100 border-sage-300 text-sage-700',
  'bg-terracotta-100 border-terracotta-400/30 text-terracotta-600',
  'bg-slate-100 border-slate-500/20 text-slate-800',
  'bg-amber-50 border-amber-300/50 text-amber-700',
];


/** The first letter of a date's weekday — the strip shows the LAST 7 days, so it doesn't always start on Monday. */
function weekdayLetter(dateKey: string): string {
  return formatWeekday(dateKey).charAt(0);
}

function formatWeekday(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'short' });
}

interface ActivityGroup {
  icon: string;
  label: string;
  items: { id: string; title: string }[];
  chipColor: string;
}

/**
 * Everything logged this week across Journal and Life, in ONE card.
 * Categories with something in them get their own row; the empty ones
 * share a single quiet line at the bottom, instead of a card each
 * saying "nothing this week".
 */
function WeekActivityCard({ groups }: { groups: ActivityGroup[] }) {
  const filled = groups.filter((g) => g.items.length > 0);
  const empty = groups.filter((g) => g.items.length === 0);
  // A completely empty week is already said gently by "Little things"
  // ("A quiet week…") — no need for a second card saying the same.
  if (filled.length === 0) return null;
  return (
    <section className="bg-sage-100/50 p-5 rounded-3xl border border-sage-300/70 shadow-sm space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-sand-800/60">What filled my week</p>
      {filled.length > 0 && (
        <div className="divide-y divide-sand-100">
          {filled.map((group) => (
            <div key={group.label} className="py-2.5 first:pt-0">
              <p className="text-xs font-semibold text-sand-900 flex items-center gap-2 mb-1">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${group.chipColor}`}>{group.icon}</span>
                {group.label}
              </p>
              <ul className="space-y-0.5 pl-8">
                {group.items.map((item) => (
                  <li key={item.id} className="text-xs text-sand-800/80 truncate">
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {empty.length > 0 && (
        <p className="text-xs text-sand-800/50">
          Nothing this week from {empty.map((g) => `${g.icon} ${g.label}`).join(' · ')} — and that's fine.
        </p>
      )}
    </section>
  );
}

export default function WeekPage({ showToast }: { showToast: (msg: string) => void }) {
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const subjects = useSubjects() ?? [];
  const weekSessions = sessionsWithin(useStudySessions(), 7);
  const studyThisWeek = subjects
    .map((sub) => ({ id: sub.id, minutes: totalMinutes(weekSessions.filter((x) => x.subjectId === sub.id)), title: `${sub.icon ? `${sub.icon} ` : ''}${sub.title}` }))
    .filter((x) => x.minutes > 0)
    .map((x) => ({ id: x.id, title: `${x.title} — ${formatMinutes(x.minutes)}` }));
  const today = getLocalDateKey();
  const week = useWeekData(today);
  const { stats: cycleStats } = usePeriodEntries();
  const littleThings = deriveLittleThings(week);

  if (openSubjectId) {
    return <SubjectPage subjectId={openSubjectId} onBack={() => setOpenSubjectId(null)} showToast={showToast} />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="text-center sm:text-left">
        <h2 className="serif text-2xl sm:text-3xl font-semibold text-sand-900">This Week</h2>
        <p className="text-sm text-sand-800/70 mt-1 italic font-serif">A gentle look back, not a scorecard.</p>
      </section>

      {/* 7-day visual strip */}
      <section className="bg-gradient-to-br from-sage-100 via-sand-50 to-slate-100 p-5 sm:p-6 rounded-3xl border border-sage-300/60">
        <div className="flex justify-between gap-1 sm:gap-2">
          {week.days.map((day) => {
            const isToday = day.date === today;
            return (
              <div key={day.date} className="flex flex-col items-center gap-1.5 flex-1">
                <span className="text-[10px] font-semibold text-sand-800/50">{weekdayLetter(day.date)}</span>
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

      {/* Two columns on a wide window: the week + learning | little things, activity, cycle. */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 items-start">
      <div className="space-y-6 sm:space-y-8 xl:col-span-7 min-w-0">
      {/* The week in its own words (on-device AI, when it's on) */}
      <WeekSummaryCard />

      {/* What I'm learning — study timer, subjects, and sessions */}
      <StudySection showToast={showToast} onOpenSubject={setOpenSubjectId} />
      </div>

      <div className="space-y-6 sm:space-y-8 xl:col-span-5 min-w-0">

      {/* Little things from this week — built from actual logged activity */}
      <section className="bg-terracotta-100/50 p-5 rounded-3xl border border-terracotta-400/20 shadow-sm space-y-3">
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

      <WeekActivityCard
        groups={[
          { icon: '📚', label: 'Study', items: studyThisWeek, chipColor: 'bg-slate-100 text-slate-700' },
          {
            icon: '📝',
            label: 'Journal',
            items: week.journalEntriesThisWeek.map((e) => ({ id: e.id, title: e.title || e.body.slice(0, 40) })),
            chipColor: 'bg-slate-100 text-slate-700',
          },
          { icon: '📖', label: 'Books', items: week.booksThisWeek.map((b) => ({ id: b.id, title: b.title })), chipColor: 'bg-sage-100 text-sage-700' },
          {
            icon: '🎬',
            label: 'Movies & Series',
            items: week.moviesAndSeriesThisWeek.map((m) => ({ id: m.id, title: m.title })),
            chipColor: 'bg-terracotta-100 text-terracotta-600',
          },
          {
            icon: '🎨',
            label: 'Artwork',
            items: week.artworkThisWeek.map((a) => ({ id: a.id, title: a.title || 'Untitled' })),
            chipColor: 'bg-amber-50 text-amber-700',
          },
          {
            icon: '🌿',
            label: 'Experiences',
            items: week.experiencesThisWeek.map((e) => ({ id: e.id, title: e.title })),
            chipColor: 'bg-sage-100 text-sage-700',
          },
        ]}
      />

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
      </div>
      </div>

    </div>
  );
}
