import { useLiveQuery } from 'dexie-react-hooks';
import { getAllCareEntries } from '@/db/repositories/careRepository';
import { getJournalEntries } from '@/db/repositories/journalRepository';
import { getLifeItems } from '@/db/repositories/lifeRepository';
import { getLocalDateKey, addDays } from '@/db/dateUtils';
import type { CareEntry, JournalEntry, LifeItem } from '@/db/schema';

export interface DayCareSummary {
  date: string;
  hasDone: boolean;
  hasSkipped: boolean;
}

export interface WeekData {
  days: DayCareSummary[];
  journalEntriesThisWeek: JournalEntry[];
  booksThisWeek: LifeItem[];
  moviesAndSeriesThisWeek: LifeItem[];
  artworkThisWeek: LifeItem[];
  experiencesThisWeek: LifeItem[];
  daysShowedUp: number;
}

function lifeItemDateInWeek(item: LifeItem, weekDates: Set<string>): boolean {
  const candidates: (string | undefined)[] = [item.createdAt.slice(0, 10)];
  if (item.type === 'book') candidates.push(item.dateFinished, item.dateStarted);
  if (item.type === 'movie') candidates.push(item.dateWatched);
  if (item.type === 'series') candidates.push(item.dateFinished, item.dateStarted);
  if (item.type === 'artwork') candidates.push(item.dateCreated);
  if (item.type === 'experience') candidates.push(item.date);
  return candidates.some((d) => d && weekDates.has(d));
}

export function useWeekData(today: string = getLocalDateKey()): WeekData {
  const careEntries = useLiveQuery(() => getAllCareEntries(), []) ?? [];
  const journalEntries = useLiveQuery(() => getJournalEntries(), []) ?? [];
  const books = (useLiveQuery(() => getLifeItems('book'), []) ?? []) as LifeItem[];
  const movies = (useLiveQuery(() => getLifeItems('movie'), []) ?? []) as LifeItem[];
  const series = (useLiveQuery(() => getLifeItems('series'), []) ?? []) as LifeItem[];
  const artwork = (useLiveQuery(() => getLifeItems('artwork'), []) ?? []) as LifeItem[];
  const experiences = (useLiveQuery(() => getLifeItems('experience'), []) ?? []) as LifeItem[];

  const weekDateKeys: string[] = [];
  for (let i = 6; i >= 0; i--) weekDateKeys.push(addDays(today, -i));
  const weekDates = new Set(weekDateKeys);

  const careByDate = new Map<string, CareEntry[]>();
  for (const entry of careEntries) {
    if (!weekDates.has(entry.date)) continue;
    const bucket = careByDate.get(entry.date) ?? [];
    bucket.push(entry);
    careByDate.set(entry.date, bucket);
  }

  const days: DayCareSummary[] = weekDateKeys.map((date) => {
    const entries = careByDate.get(date) ?? [];
    return {
      date,
      hasDone: entries.some((e) => e.status === 'done'),
      hasSkipped: entries.some((e) => e.status === 'skipped'),
    };
  });

  const journalEntriesThisWeek = journalEntries.filter((e) => weekDates.has(e.date));
  const booksThisWeek = books.filter((b) => lifeItemDateInWeek(b, weekDates));
  const moviesAndSeriesThisWeek = [...movies, ...series].filter((m) => lifeItemDateInWeek(m, weekDates));
  const artworkThisWeek = artwork.filter((a) => lifeItemDateInWeek(a, weekDates));
  const experiencesThisWeek = experiences.filter((e) => lifeItemDateInWeek(e, weekDates));

  return {
    days,
    journalEntriesThisWeek,
    booksThisWeek,
    moviesAndSeriesThisWeek,
    artworkThisWeek,
    experiencesThisWeek,
    daysShowedUp: days.filter((d) => d.hasDone).length,
  };
}
