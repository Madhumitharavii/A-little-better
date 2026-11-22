import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllCareEntries } from '@/db/repositories/careRepository';
import { getJournalEntries } from '@/db/repositories/journalRepository';
import { useLifeItemsOfType } from '@/features/life/useLifeItems';
import { lifeItemActivityDates } from '@/db/lifeDates';
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
  return lifeItemActivityDates(item).some((d) => weekDates.has(d));
}

export function useWeekData(today: string = getLocalDateKey()): WeekData {
  const careEntries = useLiveQuery(() => getAllCareEntries(), []) ?? [];
  const journalEntries = useLiveQuery(() => getJournalEntries(), []) ?? [];
  const books = useLifeItemsOfType('book') as LifeItem[];
  const movies = useLifeItemsOfType('movie') as LifeItem[];
  const series = useLifeItemsOfType('series') as LifeItem[];
  const artwork = useLifeItemsOfType('artwork') as LifeItem[];
  const experiences = useLifeItemsOfType('experience') as LifeItem[];

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
  // Only re-worked when the library or the day changes (thousands of items), not on every redraw.
  const { booksThisWeek, moviesAndSeriesThisWeek, artworkThisWeek, experiencesThisWeek } = useMemo(() => {
    const dates = new Set(weekDateKeys);
    return {
      booksThisWeek: books.filter((b) => lifeItemDateInWeek(b, dates)),
      moviesAndSeriesThisWeek: [...movies, ...series].filter((m) => lifeItemDateInWeek(m, dates)),
      artworkThisWeek: artwork.filter((a) => lifeItemDateInWeek(a, dates)),
      experiencesThisWeek: experiences.filter((e) => lifeItemDateInWeek(e, dates)),
    };
  }, [books, movies, series, artwork, experiences, today]); // eslint-disable-line react-hooks/exhaustive-deps

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
