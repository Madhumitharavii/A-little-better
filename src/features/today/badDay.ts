import { useEffect, useState } from 'react';
import { readPref, watchPref, writePref } from '@/db/repositories/syncedPrefs';
import type { MovieItem } from '@/db/schema';

/**
 * Bad-day mode: "today is hard". Today goes quiet — just the basics, a
 * line you loved, and a comfort film. It's only for the day you turn it
 * on (it's back to normal tomorrow), and it follows you between devices.
 */
interface BadDayPref {
  /** The day it was turned on; anything else means off. */
  date: string | null;
}

export function useBadDay(today: string): [boolean, (on: boolean) => void] {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    void readPref<BadDayPref>('badDay').then((p) => setDate(p?.value?.date ?? null));
    return watchPref<BadDayPref>('badDay', (v) => setDate(v?.date ?? null));
  }, []);
  const set = (on: boolean) => {
    const next = on ? today : null;
    setDate(next);
    void writePref('badDay', { date: next });
  };
  return [date === today, set];
}

/** Films you loved: rated 4½★ or more, or hearted — the comfort-watch shelf. */
export const comfortFilms = (movies: readonly MovieItem[]) =>
  movies.filter((m) => !m.deletedAt && m.status === 'watched' && ((m.rating ?? 0) >= 4.5 || m.favorite));
