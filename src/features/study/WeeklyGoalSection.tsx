import { useState } from 'react';
import type { StudySessionItem, SubjectItem } from '@/db/schema';
import { updateSubject } from '@/db/repositories/studyRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import { daysLeftInWeek, describeGoal, goalProgress, weekBounds } from './goals';
import { formatMinutes } from './useStudy';

/** A progress bar for one part of a goal. */
export function GoalBar({ value, goal, label }: { value: number; goal: number; label: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  const done = value >= goal;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-sand-800/70">{label}</span>
        <span className={done ? 'text-sage-700 font-semibold' : 'text-sand-800/60'}>{done ? 'Done ✓' : `${pct}%`}</span>
      </div>
      <div className="h-2 bg-sand-100 rounded-full overflow-hidden" aria-hidden="true">
        <div className={`h-full rounded-full ${done ? 'bg-sage-500' : 'bg-slate-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Weekly goal for one subject: set study time and/or days per week, and see this week's progress. */
export default function WeeklyGoalSection({ subject, sessions }: { subject: SubjectItem; sessions: StudySessionItem[] }) {
  const today = getLocalDateKey();
  const progress = goalProgress(subject, sessions, weekBounds(today).start);
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(String(Math.floor((subject.weeklyGoal?.minutes ?? 0) / 60) || ''));
  const [mins, setMins] = useState(String((subject.weeklyGoal?.minutes ?? 0) % 60 || ''));
  const [days, setDays] = useState<number | undefined>(subject.weeklyGoal?.days);

  const totalMinutes = (Number(hours) || 0) * 60 + (Number(mins) || 0);
  const field = 'w-16 p-2 bg-white border border-sand-200 rounded-xl text-sm text-sand-900 focus:outline-none text-center';
  const left = daysLeftInWeek(today);

  const save = async (goal: SubjectItem['weeklyGoal']) => {
    await updateSubject(subject.id, { weeklyGoal: goal });
    setEditing(false);
  };

  return (
    <section className="bg-sage-100/50 p-5 sm:p-6 rounded-3xl border border-sage-300/70 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-sand-800/60">Weekly goal</h3>
          <p className="text-[11px] text-sand-800/50">
            {progress.hasGoal ? `${describeGoal(subject.weeklyGoal)} · weeks run Monday to Sunday` : 'Optional — how much, or how often, you want to study each week.'}
          </p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="px-2.5 py-1.5 bg-sand-100 hover:bg-sand-200 text-sand-800 rounded-lg font-semibold text-[11px] shrink-0">
            {progress.hasGoal ? 'Edit' : 'Set a goal'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-sand-900">
              Study time each week <span className="font-normal text-sand-800/60">(optional)</span>
            </p>
            <div className="flex items-center gap-2 text-xs text-sand-800">
              <input aria-label="Hours per week" type="number" inputMode="numeric" min={0} value={hours} onChange={(e) => setHours(e.target.value)} className={field} placeholder="0" />
              <span>hours</span>
              <input aria-label="Minutes per week" type="number" inputMode="numeric" min={0} max={59} value={mins} onChange={(e) => setMins(e.target.value)} className={field} placeholder="0" />
              <span>minutes</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-sand-900">
              Days of study each week <span className="font-normal text-sand-800/60">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => setDays(days === n ? undefined : n)}
                  aria-pressed={days === n}
                  className={`w-9 h-9 rounded-xl border text-xs font-semibold ${days === n ? 'bg-slate-800 text-white border-slate-800' : 'bg-sand-50 border-sand-200 text-sand-800'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => save(totalMinutes || days ? { minutes: totalMinutes || undefined, days } : undefined)}
              className="flex-1 py-2 bg-terracotta-400 hover:bg-terracotta-600 text-white text-[11px] font-semibold rounded-lg"
            >
              Save goal
            </button>
            {progress.hasGoal && (
              <button onClick={() => save(undefined)} className="px-3 py-2 text-terracotta-600 hover:bg-terracotta-100 text-[11px] font-semibold rounded-lg">
                Remove goal
              </button>
            )}
            <button onClick={() => setEditing(false)} className="px-3 py-2 bg-sand-100 text-sand-900 text-[11px] font-semibold rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        progress.hasGoal && (
          <div className="space-y-2.5">
            {progress.minutesGoal && <GoalBar value={progress.minutes} goal={progress.minutesGoal} label={`Time: ${formatMinutes(progress.minutes)} of ${formatMinutes(progress.minutesGoal)}`} />}
            {progress.daysGoal && <GoalBar value={progress.days} goal={progress.daysGoal} label={`Days: ${progress.days} of ${progress.daysGoal}`} />}
            <p className="text-[11px] text-sand-800/60">
              {progress.met ? 'Goal reached this week — lovely work. 🌿' : left === 0 ? 'Last day of the week.' : `${left} day${left === 1 ? '' : 's'} left this week.`}
            </p>
          </div>
        )
      )}
    </section>
  );
}
