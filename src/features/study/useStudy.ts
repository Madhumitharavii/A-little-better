import { useLiveQuery } from 'dexie-react-hooks';
import { getStudySessions, getSubjects } from '@/db/repositories/studyRepository';
import { getLocalDateKey } from '@/db/dateUtils';
import type { StudySessionItem } from '@/db/schema';

export function useSubjects() {
  return useLiveQuery(() => getSubjects(), []);
}

export function useStudySessions() {
  return useLiveQuery(() => getStudySessions(), []) ?? [];
}

const dayNum = (key: string) => Date.parse(`${key}T00:00:00Z`) / 86_400_000;

/** Sessions within the last `days` days (today included). */
export function sessionsWithin(sessions: StudySessionItem[], days: number, today = getLocalDateKey()) {
  return sessions.filter((s) => {
    const diff = dayNum(today) - dayNum(s.date);
    return diff >= 0 && diff < days;
  });
}

export const totalMinutes = (sessions: StudySessionItem[]) => sessions.reduce((sum, s) => sum + s.minutes, 0);

/** "1h 20m", "45m", "2h". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "today", "yesterday", "5 days ago". */
export function daysAgoLabel(dateKey: string, today = getLocalDateKey()): string {
  const diff = Math.round(dayNum(today) - dayNum(dateKey));
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `${diff} days ago`;
}
