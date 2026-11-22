import type { LifeItemPatch, MovieItem, MovieListEntry, MovieWatchEntry } from '@/db/schema';
import { generateId } from '@/db/id';
import { parseCsv } from '@/shared/utils/csv';
import { cleanReview } from '@/shared/utils/html';

/**
 * Letterboxd → A Little Better: a ONE-WAY import of the folder you get
 * from Letterboxd's "Export Your Data" (unzipped). There is no public
 * API for personal data, so this never talks to letterboxd.com — it
 * only reads files the person downloaded themselves.
 *
 * Files used (anything else — comments, profile, deleted/, orphaned/,
 * likes on other people's reviews and lists — is ignored):
 *
 *   diary.csv        one row per logged watch, with date / rating / rewatch / tags
 *   reviews.csv      review text, tied to a watch by its watched date
 *   watched.csv      every film marked watched — including ones never logged in the diary (no date)
 *   ratings.csv      current star rating per film
 *   likes/films.csv  liked films  → ♥ favorite
 *   watchlist.csv    want-to-watch → status 'watchlist'
 *   lists/*.csv      the person's own lists, with each film's position
 *
 * Films are matched across files (and against movies already in the
 * app) by title + year: diary/review rows carry a per-LOG link, not the
 * film's link, so the Letterboxd URI can't be used to group rewatches.
 * Re-running an import merges into what's there and never duplicates.
 */

export type ExportFileKind = 'diary' | 'reviews' | 'watched' | 'ratings' | 'likes' | 'watchlist' | 'list';

export interface ExportFile {
  /** Path inside the export folder (e.g. "likes/films.csv") — or just the file name. */
  path: string;
  text: string;
}

export interface LetterboxdWatch {
  date?: string;
  rating?: number;
  review?: string;
  rewatch: boolean;
}

export interface LetterboxdFilm {
  key: string;
  title: string;
  year?: number;
  /** The film's own Letterboxd link (from watched / ratings / likes / watchlist). */
  uri?: string;
  watches: LetterboxdWatch[];
  /** Current rating from ratings.csv. */
  rating?: number;
  liked: boolean;
  onWatchlist: boolean;
  /** Seen, per Letterboxd (watched.csv, a like, a rating, a list) — even with no diary entry. */
  seen: boolean;
  lists: MovieListEntry[];
  tags: string[];
}

export interface LetterboxdExport {
  films: LetterboxdFilm[];
  /** Which kinds of file were found and used. */
  kinds: ExportFileKind[];
  listNames: string[];
}

/** Which part of the export a file is, from its path — or null for files that aren't imported. */
export function classifyExportFile(path: string): ExportFileKind | null {
  const parts = path.toLowerCase().replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.some((p) => p === 'deleted' || p === 'orphaned')) return null;
  const name = parts[parts.length - 1] ?? '';
  const parent = parts[parts.length - 2];
  if (!name.endsWith('.csv')) return null;
  if (parent === 'likes') return name === 'films.csv' ? 'likes' : null;
  if (parent === 'lists') return 'list';
  const top: Record<string, ExportFileKind> = {
    'diary.csv': 'diary',
    'reviews.csv': 'reviews',
    'watched.csv': 'watched',
    'ratings.csv': 'ratings',
    'watchlist.csv': 'watchlist',
  };
  return top[name] ?? null;
}

const normTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
export const filmKey = (title: string, year?: number) => `${normTitle(title)}|${year ?? ''}`;

const num = (s?: string) => {
  const v = s?.trim();
  return v ? Number(v) : undefined;
};

/** Letterboxd reviews are exported as light HTML — see cleanReview. */
export { cleanReview };

/** Rows of a simple export CSV as objects keyed by lower-cased header. */
function records(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i]?.trim() ?? ''])));
}

/**
 * A list export: a "Letterboxd list export" line, the list's own
 * header + row (Date, Name, Tags, URL, Description), a blank line,
 * then Position, Name, Year, URL, Description for each film.
 */
function parseList(text: string, fallbackName: string): { name: string; films: { title: string; year?: number; position?: number }[] } {
  const rows = parseCsv(text);
  const metaHeader = rows.findIndex((r) => r[0]?.trim().toLowerCase() === 'date' && r.some((c) => c.trim().toLowerCase() === 'name'));
  let name = fallbackName;
  if (metaHeader !== -1 && rows[metaHeader + 1]) {
    const nameCol = rows[metaHeader].findIndex((c) => c.trim().toLowerCase() === 'name');
    name = rows[metaHeader + 1][nameCol]?.trim() || fallbackName;
  }
  const filmHeader = rows.findIndex((r) => r[0]?.trim().toLowerCase() === 'position');
  if (filmHeader === -1) return { name, films: [] };
  const h = rows[filmHeader].map((c) => c.trim().toLowerCase());
  const at = (r: string[], col: string) => r[h.indexOf(col)]?.trim();
  return {
    name,
    films: rows
      .slice(filmHeader + 1)
      .map((r) => ({ title: at(r, 'name') ?? '', year: num(at(r, 'year')), position: num(at(r, 'position')) }))
      .filter((f) => f.title),
  };
}

const listNameFromPath = (path: string) =>
  (path.split('/').pop() ?? path)
    .replace(/\.csv$/i, '')
    .replace(/-/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

export function parseLetterboxdExport(files: ExportFile[]): LetterboxdExport {
  const films = new Map<string, LetterboxdFilm>();
  const film = (title: string, year?: number): LetterboxdFilm => {
    const key = filmKey(title, year);
    let f = films.get(key);
    if (!f) {
      f = { key, title: title.trim(), year, watches: [], liked: false, onWatchlist: false, seen: false, lists: [], tags: [] };
      films.set(key, f);
    }
    return f;
  };

  const byKind = new Map<ExportFileKind, ExportFile[]>();
  for (const file of files) {
    const kind = classifyExportFile(file.path);
    if (kind) byKind.set(kind, [...(byKind.get(kind) ?? []), file]);
  }
  const each = (kind: ExportFileKind, fn: (r: Record<string, string>) => void) => {
    for (const file of byKind.get(kind) ?? []) records(file.text).forEach((r) => r.name && fn(r));
  };

  // Diary first — every logged watch.
  each('diary', (r) => {
    const f = film(r.name, num(r.year));
    f.watches.push({ date: r['watched date'] || r.date || undefined, rating: num(r.rating), rewatch: r.rewatch?.toLowerCase() === 'yes' });
    if (r.tags) for (const t of r.tags.split(',').map((x) => x.trim()).filter(Boolean)) if (!f.tags.includes(t)) f.tags.push(t);
  });
  // Reviews attach to the watch on the same date (or become a watch of their own).
  each('reviews', (r) => {
    const f = film(r.name, num(r.year));
    const date = r['watched date'] || undefined;
    const review = cleanReview(r.review ?? '');
    const watch = f.watches.find((w) => w.date === date && !w.review);
    if (watch) {
      if (review) watch.review = review;
      watch.rating ??= num(r.rating);
    } else {
      f.watches.push({ date, rating: num(r.rating), review: review || undefined, rewatch: r.rewatch?.toLowerCase() === 'yes' });
    }
  });
  each('watched', (r) => {
    const f = film(r.name, num(r.year));
    f.seen = true;
    f.uri = r['letterboxd uri'] || f.uri;
  });
  each('ratings', (r) => {
    const f = film(r.name, num(r.year));
    f.rating = num(r.rating);
    f.seen = true;
    f.uri ??= r['letterboxd uri'] || undefined;
  });
  each('likes', (r) => {
    const f = film(r.name, num(r.year));
    f.liked = true;
    f.seen = true;
    f.uri ??= r['letterboxd uri'] || undefined;
  });
  each('watchlist', (r) => {
    const f = film(r.name, num(r.year));
    f.onWatchlist = true;
    f.uri ??= r['letterboxd uri'] || undefined;
  });
  const listNames: string[] = [];
  for (const file of byKind.get('list') ?? []) {
    const list = parseList(file.text, listNameFromPath(file.path));
    if (!list.films.length) continue;
    listNames.push(list.name);
    for (const lf of list.films) {
      const f = film(lf.title, lf.year);
      if (!f.lists.some((l) => l.name === list.name)) f.lists.push({ name: list.name, position: lf.position });
    }
  }

  for (const f of films.values()) f.watches.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  return { films: [...films.values()], kinds: [...byKind.keys()], listNames };
}

/** Watched (has watches, or Letterboxd says it was seen, or it's on one of their lists) — otherwise a watchlist film. */
export const isWatched = (f: LetterboxdFilm) => f.watches.length > 0 || f.seen || f.lists.length > 0;

type NewMovieInput = Omit<MovieItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

const toEntry = (w: { date?: string; rating?: number; review?: string }): MovieWatchEntry => ({
  id: generateId(),
  dateWatched: w.date,
  rating: w.rating,
  review: w.review,
  source: 'letterboxd',
});

/** A brand-new movie: the latest watch becomes the top-level fields; earlier ones go into previousWatches. */
export function filmToNewMovie(f: LetterboxdFilm): NewMovieInput {
  const base = { type: 'movie' as const, title: f.title, year: f.year, letterboxdUri: f.uri, source: 'letterboxd' as const };
  if (!isWatched(f)) return { ...base, status: 'watchlist' };
  const latest = f.watches[f.watches.length - 1];
  const earlier = f.watches.slice(0, -1);
  return {
    ...base,
    status: 'watched',
    dateWatched: latest?.date,
    rating: f.rating ?? latest?.rating,
    review: latest?.review,
    rewatch: f.watches.length > 1 || f.watches.some((w) => w.rewatch) || undefined,
    tags: f.tags.length ? f.tags : undefined,
    favorite: f.liked || undefined,
    lists: f.lists.length ? f.lists : undefined,
    previousWatches: earlier.length ? earlier.map(toEntry) : undefined,
  };
}

/**
 * Merges a film into a movie already in the app. New watch dates are
 * added, a missing review/rating is filled in, a like adds ♥, lists are
 * combined, and a watchlist movie becomes watched once it has been
 * seen. Nothing the person already has is overwritten or removed.
 * Returns undefined when there's nothing new.
 */
export function mergeFilmIntoExisting(existing: MovieItem, f: LetterboxdFilm): LifeItemPatch | undefined {
  type W = { date?: string; rating?: number; review?: string };
  const current: W[] = [
    ...(existing.previousWatches ?? []).map((w) => ({ date: w.dateWatched, rating: w.rating, review: w.review })),
    ...(existing.dateWatched || existing.rating != null || existing.review ? [{ date: existing.dateWatched, rating: existing.rating, review: existing.review }] : []),
  ];
  const combined = current.map((w) => ({ ...w }));
  for (const w of f.watches) {
    const same = combined.find((c) => c.date === w.date);
    if (same) {
      same.review ||= w.review;
      same.rating ??= w.rating;
    } else if (w.date || combined.length === 0) {
      combined.push({ date: w.date, rating: w.rating, review: w.review });
    }
  }
  combined.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const lists = [...(existing.lists ?? [])];
  for (const l of f.lists) {
    const i = lists.findIndex((x) => x.name === l.name);
    if (i === -1) lists.push(l);
    else lists[i] = { ...lists[i], position: l.position ?? lists[i].position };
  }

  const watched = isWatched(f) || existing.status !== 'watchlist';
  const latest = combined[combined.length - 1];
  const next = {
    status: existing.status === 'watchlist' && watched ? ('watched' as const) : existing.status,
    dateWatched: latest?.date,
    rating: existing.rating ?? f.rating ?? latest?.rating,
    review: latest?.review,
    rewatch: combined.length > 1 || existing.rewatch || f.watches.some((w) => w.rewatch) || undefined,
    favorite: existing.favorite || f.liked || undefined,
    lists: lists.length ? lists : undefined,
    letterboxdUri: existing.letterboxdUri ?? f.uri, // keep the link a film already has (feed and export use different link styles)
    tags: existing.tags?.length ? existing.tags : f.tags.length ? f.tags : undefined,
  };
  const before = {
    status: existing.status,
    dateWatched: existing.dateWatched,
    rating: existing.rating,
    review: existing.review,
    rewatch: existing.rewatch || undefined,
    favorite: existing.favorite || undefined,
    lists: existing.lists?.length ? existing.lists : undefined,
    letterboxdUri: existing.letterboxdUri,
    tags: existing.tags?.length ? existing.tags : undefined,
  };
  const watchesChanged = JSON.stringify(combined) !== JSON.stringify(current);
  if (!watchesChanged && JSON.stringify(next) === JSON.stringify(before)) return undefined;

  return {
    type: 'movie',
    ...next,
    previousWatches: watchesChanged ? combined.slice(0, -1).map(toEntry) : existing.previousWatches,
  };
}

export interface ImportPlan {
  creates: NewMovieInput[];
  updates: { id: string; patch: LifeItemPatch }[];
  summary: {
    films: number;
    newFilms: number;
    updatedFilms: number;
    unchangedFilms: number;
    watched: number;
    dated: number;
    watches: number;
    reviews: number;
    favorites: number;
    watchlist: number;
    lists: string[];
  };
}

/** Works out exactly what an import will add and change — pure, so it can be shown before anything is written. */
export function planImport(exp: LetterboxdExport, existingMovies: MovieItem[]): ImportPlan {
  const existing = new Map<string, MovieItem>();
  for (const m of existingMovies) if (!m.deletedAt) existing.set(filmKey(m.title, m.year), m);
  // Films you added yourself without a year: matched on title alone, when that title is unique.
  const yearless = new Map<string, MovieItem | null>();
  for (const m of existingMovies) {
    if (m.deletedAt || m.year) continue;
    const k = filmKey(m.title);
    yearless.set(k, yearless.has(k) ? null : m);
  }
  const titleCount = new Map<string, number>();
  for (const f of exp.films) titleCount.set(filmKey(f.title), (titleCount.get(filmKey(f.title)) ?? 0) + 1);

  const creates: NewMovieInput[] = [];
  const updates: ImportPlan['updates'] = [];
  let unchanged = 0;
  for (const f of exp.films) {
    const match = existing.get(f.key) ?? (titleCount.get(filmKey(f.title)) === 1 ? yearless.get(filmKey(f.title)) ?? undefined : undefined);
    if (!match) creates.push(filmToNewMovie(f));
    else {
      const patch = mergeFilmIntoExisting(match, f);
      if (patch) updates.push({ id: match.id, patch });
      else unchanged++;
    }
  }
  const watchedFilms = exp.films.filter(isWatched);
  return {
    creates,
    updates,
    summary: {
      films: exp.films.length,
      newFilms: creates.length,
      updatedFilms: updates.length,
      unchangedFilms: unchanged,
      watched: watchedFilms.length,
      dated: watchedFilms.filter((f) => f.watches.some((w) => w.date)).length,
      watches: exp.films.reduce((s, f) => s + f.watches.filter((w) => w.date).length, 0),
      reviews: exp.films.reduce((s, f) => s + f.watches.filter((w) => w.review).length, 0),
      favorites: exp.films.filter((f) => f.liked).length,
      watchlist: exp.films.filter((f) => !isWatched(f)).length,
      lists: exp.listNames,
    },
  };
}
