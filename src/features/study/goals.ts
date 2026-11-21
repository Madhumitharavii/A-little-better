import { addDays, startOfWeek } from '@/db/dateUtils';
import type { StudySessionItem, SubjectItem } from '@/db/schema';

/**
 * Weekly study goals. A goal week runs Monday–Sunday (local dates).
 * Pure functions, shared by the Learning screens and the advisor.
 */

export interface WeekGoalProgress {
  hasGoal: boolean;
  minutes: number;
  days: number;
  minutesGoal?: number;
  daysGoal?: number;
  /** Each part met (true when that part has no goal). */
  minutesMet: boolean;
  daysMet: boolean;
  met: boolean;
}

/** Monday and Sunday of the week containing `dateKey`. */
export function weekBounds(dateKey: string): { start: string; end: string } {
  const start = startOfWeek(dateKey);
  return { start, end: addDays(start, 6) };
}

export function goalProgress(subject: SubjectItem, sessions: StudySessionItem[], weekStart: string): WeekGoalProgress {
  const end = addDays(weekStart, 6);
  const inWeek = sessions.filter((s) => s.subjectId === subject.id && s.date >= weekStart && s.date <= end);
  const minutes = inWeek.reduce((sum, s) => sum + s.minutes, 0);
  const days = new Set(inWeek.map((s) => s.date)).size;
  const minutesGoal = subject.weeklyGoal?.minutes || undefined;
  const daysGoal = subject.weeklyGoal?.days || undefined;
  const minutesMet = !minutesGoal || minutes >= minutesGoal;
  const daysMet = !daysGoal || days >= daysGoal;
  const hasGoal = !!(minutesGoal || daysGoal);
  return { hasGoal, minutes, days, minutesGoal, daysGoal, minutesMet, daysMet, met: hasGoal && minutesMet && daysMet };
}

/** Days left in the week after today (Sunday → 0). */
export function daysLeftInWeek(today: string): number {
  const { end } = weekBounds(today);
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

const fmt = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);

/** "1h 10m of 3h · 2 of 4 days" */
export function describeProgress(p: WeekGoalProgress): string {
  const parts: string[] = [];
  if (p.minutesGoal) parts.push(`${fmt(p.minutes)} of ${fmt(p.minutesGoal)}`);
  if (p.daysGoal) parts.push(`${p.days} of ${p.daysGoal} day${p.daysGoal === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** "3h a week · 4 days a week" */
export function describeGoal(goal: SubjectItem['weeklyGoal']): string {
  if (!goal) return '';
  const parts: string[] = [];
  if (goal.minutes) parts.push(`${fmt(goal.minutes)} a week`);
  if (goal.days) parts.push(`${goal.days} day${goal.days === 1 ? '' : 's'} a week`);
  return parts.join(' · ');
}
