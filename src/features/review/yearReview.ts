import type {
  BookItem,
  CareEntry,
  DailyReflection,
  ExperienceItem,
  JournalEntry,
  LetterItem,
  MovieItem,
  SeriesItem,
  StudySessionItem,
} from '@/db/schema';
import type { SavedLine } from '@/features/ai/savedLines';
import { promiseRows } from '@/features/life/promises';
import { getLocalDateKey } from '@/db/dateUtils';

export interface ReviewInput {
  life: readonly { type: string; deletedAt?: string | null }[];
  journal: readonly JournalEntry[];
  reflections: readonly DailyReflection[];
  care: readonly CareEntry[];
  savedLines: readonly SavedLine[];
}

export interface Titled {
  id: string;
  title: string;
  sub?: string;
  rating?: number;
}

export interface YearReview {
  year: number;
  films: {
    watches: number;
    films: number;
    rewatches: number;
    top: Titled[];
    first?: Titled;
    last?: Titled;
    busiestMonth?: { month: number; count: number };
  };
  books: {
    finished: number;
    started: number;
    top: Titled[];
    first?: Titled;
    last?: Titled;
  };
  seriesFinished: number;
  experiences: Titled[];
  promises: { made: number; kept: number };
  journal: { entries: number; words: number };
  smallWins: { count: number; some: string[] };
  lines: SavedLine[];
  care: {
    bath: number;
    movement: number;
    fruit: number;
    breakfasts: number;
    readingMinutes: number;
    focusMinutes: number;
  };
  letters: { written: number; opened: number };
  studyMinutes: number;
  /** True when there's nothing at all for the year. */
  empty: boolean;
}

const inYear = (d: string | undefined | null, y: string) => !!d && d.startsWith(y);
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** A pick of `n` from the list that's the same every time for the same year (so the page doesn't shuffle on every look). */
function steadyPick<T>(list: readonly T[], n: number, seed: number): T[] {
  return [...list]
    .map((x, i) => ({ x, k: Math.sin(seed * 9301 + i * 49297) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map((p) => p.x);
}

export function yearReview(input: ReviewInput, year: number): YearReview {
  const y = String(year);
  const rows = input.life.filter((r) => !r.deletedAt);
  const of = <T>(type: string) => rows.filter((r) => r.type === type) as unknown as T[];
  const movies = of<MovieItem>('movie');
  const books = of<BookItem>('book');

  // Films: every watch dated this year (rewatches included).
  const watches: { m: MovieItem; date: string }[] = [];
  for (const m of movies) {
    if (m.status === 'watchlist') continue;
    for (const d of [m.dateWatched, ...(m.previousWatches ?? []).map((w) => w.dateWatched)]) if (inYear(d, y)) watches.push({ m, date: d! });
  }
  watches.sort((a, b) => a.date.localeCompare(b.date));
  const filmIds = new Set(watches.map((w) => w.m.id));
  const filmsSeen = movies.filter((m) => filmIds.has(m.id));
  const months = new Array(12).fill(0) as number[];
  for (const w of watches) months[Number(w.date.slice(5, 7)) - 1]++;
  const busiest = months.reduce((best, c, i) => (c > months[best] ? i : best), 0);
  const filmTitled = (m: MovieItem): Titled => ({
    id: m.id,
    title: m.title,
    sub: m.year ? String(m.year) : undefined,
    rating: m.rating,
  });
  const topFilms = filmsSeen
    .filter((m) => m.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.dateWatched ?? '').localeCompare(a.dateWatched ?? ''))
    .slice(0, 5)
    .map(filmTitled);

  // Books.
  const finished = books
    .filter((b) => b.status === 'finished' && inYear(b.dateFinished, y))
    .sort((a, b) => a.dateFinished!.localeCompare(b.dateFinished!));
  const started = books.filter((b) => inYear(b.dateStarted, y));
  const bookTitled = (b: BookItem): Titled => ({
    id: b.id,
    title: b.title,
    sub: b.author,
    rating: b.rating,
  });
  const topBooks = finished
    .filter((b) => b.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.dateFinished!.localeCompare(a.dateFinished!))
    .slice(0, 5)
    .map(bookTitled);

  const experiences = of<ExperienceItem>('experience')
    .filter((e) => inYear(e.date, y))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map((e) => ({
      id: e.id,
      title: e.title,
      sub: e.location,
      rating: e.rating,
    }));

  const promises = promiseRows(movies, books).filter((p) => inYear(p.pickedOn, y));

  const journal = input.journal.filter((j) => !j.deletedAt && inYear(j.date, y));
  const wins = input.reflections.filter((r) => inYear(r.date, y) && r.smallWin?.trim()).map((r) => r.smallWin!.trim());

  const care = input.care.filter((c) => inYear(c.date, y));
  const doneDays = (key: CareEntry['itemKey']) => new Set(care.filter((c) => c.itemKey === key && c.status === 'done').map((c) => c.date)).size;
  const minutes = (key: CareEntry['itemKey']) => care.filter((c) => c.itemKey === key).reduce((s, c) => s + (c.valueMinutes ?? 0), 0);

  const letters = of<LetterItem>('letter');
  const today = getLocalDateKey();
  const lettersOpened = letters.filter((l) => inYear(l.openOn, y) && l.openOn <= today).length;

  const study = of<StudySessionItem>('studySession').filter((s) => inYear(s.date, y));

  const review: YearReview = {
    year,
    films: {
      watches: watches.length,
      films: filmsSeen.length,
      rewatches: watches.length - filmsSeen.length,
      top: topFilms,
      first: watches[0] && filmTitled(watches[0].m),
      last: watches.length ? filmTitled(watches[watches.length - 1].m) : undefined,
      busiestMonth: watches.length ? { month: busiest, count: months[busiest] } : undefined,
    },
    books: {
      finished: finished.length,
      started: started.length,
      top: topBooks,
      first: finished[0] && bookTitled(finished[0]),
      last: finished.length ? bookTitled(finished[finished.length - 1]) : undefined,
    },
    seriesFinished: of<SeriesItem>('series').filter((s) => inYear(s.dateFinished, y)).length,
    experiences,
    promises: {
      made: promises.length,
      kept: promises.filter((p) => p.state === 'kept').length,
    },
    journal: {
      entries: journal.length,
      words: journal.reduce((s, j) => s + wordCount(j.body), 0),
    },
    smallWins: { count: wins.length, some: steadyPick(wins, 3, year) },
    lines: input.savedLines.filter((l) => inYear(l.date, y)),
    care: {
      bath: doneDays('bathed'),
      movement: doneDays('movement'),
      fruit: doneDays('ateFruit'),
      breakfasts: doneDays('breakfast'),
      readingMinutes: minutes('reading'),
      focusMinutes: minutes('focus'),
    },
    letters: {
      written: letters.filter((l) => inYear(l.writtenOn, y)).length,
      opened: lettersOpened,
    },
    studyMinutes: study.reduce((s, x) => s + x.minutes, 0),
    empty: false,
  };
  review.empty =
    !review.films.watches &&
    !review.books.finished &&
    !review.books.started &&
    !review.experiences.length &&
    !review.journal.entries &&
    !wins.length &&
    !care.length &&
    !review.lines.length;
  return review;
}

/** Years that have anything to look back on, newest first. */
export function reviewYears(input: ReviewInput, thisYear: number): number[] {
  const years = new Set<number>([thisYear]);
  const note = (d?: string | null) => {
    const n = Number(d?.slice(0, 4));
    if (n > 1900 && n <= thisYear) years.add(n);
  };
  for (const r of input.life) {
    if (r.deletedAt) continue;
    const x = r as {
      dateWatched?: string;
      dateFinished?: string;
      date?: string;
    };
    note(x.dateWatched);
    note(x.dateFinished);
    note(x.date);
  }
  for (const j of input.journal) note(j.date);
  return [...years].sort((a, b) => b - a);
}
