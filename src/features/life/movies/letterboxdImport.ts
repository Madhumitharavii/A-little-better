import type { MovieItem, MovieWatchEntry, LifeItemPatch } from '@/db/schema';
import { generateId } from '@/db/id';
import { parseCsv } from '@/shared/utils/csv';

/**
 * Letterboxd → A Little Better is a ONE-WAY import of the diary.csv
 * file from a Letterboxd "Export Data" download. There is no
 * official public API for personal data, so this deliberately never
 * talks to letterboxd.com — it only parses a file the person
 * downloaded themselves.
 *
 * Expected header (Letterboxd's actual diary.csv format):
 *   Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
 *
 * A diary export naturally contains one row per WATCH, so the same
 * film can appear several times (each rewatch is its own row). Rows
 * are grouped by film below so a rewatched film becomes one movie
 * with a full watch history, instead of several duplicate entries.
 */

export interface ParsedLetterboxdRow {
  title: string;
  year?: number;
  watchedDate?: string;
  rating?: number;
  rewatch: boolean;
  tags: string[];
  letterboxdUri?: string;
}

export function parseLetterboxdDiaryCsv(csvText: string): ParsedLetterboxdRow[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const nameIdx = col('name');
  const yearIdx = col('year');
  const uriIdx = col('letterboxd uri');
  const ratingIdx = col('rating');
  const rewatchIdx = col('rewatch');
  const tagsIdx = col('tags');
  const watchedDateIdx = col('watched date');

  if (nameIdx === -1) {
    throw new Error("This doesn't look like a Letterboxd diary.csv file (no 'Name' column found).");
  }

  return rows.slice(1).map((cells) => {
    const title = cells[nameIdx]?.trim() ?? '';
    const yearRaw = yearIdx !== -1 ? cells[yearIdx]?.trim() : '';
    const ratingRaw = ratingIdx !== -1 ? cells[ratingIdx]?.trim() : '';
    const tagsRaw = tagsIdx !== -1 ? cells[tagsIdx]?.trim() : '';

    return {
      title,
      year: yearRaw ? Number(yearRaw) : undefined,
      watchedDate: watchedDateIdx !== -1 ? cells[watchedDateIdx]?.trim() || undefined : undefined,
      rating: ratingRaw ? Number(ratingRaw) : undefined,
      rewatch: rewatchIdx !== -1 ? cells[rewatchIdx]?.trim().toLowerCase() === 'yes' : false,
      tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
      letterboxdUri: uriIdx !== -1 ? cells[uriIdx]?.trim() || undefined : undefined,
    };
  }).filter((row) => row.title.length > 0);
}

export interface GroupedLetterboxdFilm {
  key: string;
  title: string;
  year?: number;
  letterboxdUri?: string;
  /** All watches of this film found in the CSV, oldest first. */
  rows: ParsedLetterboxdRow[];
}

/** Groups diary rows by film (via Letterboxd URI, or title+year as a fallback) so rewatches become one entry with history, not duplicates. */
export function groupRowsByFilm(rows: ParsedLetterboxdRow[]): GroupedLetterboxdFilm[] {
  const map = new Map<string, GroupedLetterboxdFilm>();
  for (const row of rows) {
    const key = row.letterboxdUri ?? `${row.title.trim().toLowerCase()}|${row.year ?? ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      map.set(key, { key, title: row.title, year: row.year, letterboxdUri: row.letterboxdUri, rows: [row] });
    }
  }
  for (const group of map.values()) {
    group.rows.sort((a, b) => (a.watchedDate ?? '').localeCompare(b.watchedDate ?? ''));
  }
  return Array.from(map.values());
}

/** A group counts as a likely duplicate if it matches an existing movie by Letterboxd URI, or by title+year. */
export function findExistingDuplicate(group: GroupedLetterboxdFilm, existing: MovieItem[]): MovieItem | undefined {
  if (group.letterboxdUri) {
    const byUri = existing.find((m) => m.letterboxdUri === group.letterboxdUri);
    if (byUri) return byUri;
  }
  return existing.find(
    (m) => m.title.trim().toLowerCase() === group.title.trim().toLowerCase() && m.year === group.year,
  );
}

function rowToWatchEntry(row: ParsedLetterboxdRow): MovieWatchEntry {
  return { id: generateId(), dateWatched: row.watchedDate, rating: row.rating, source: 'letterboxd' };
}

/** Builds a brand-new movie from a group — the most recent watch becomes the top-level fields, earlier ones go into previousWatches. */
export function groupToNewMovieInput(
  group: GroupedLetterboxdFilm,
): Omit<MovieItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type'> {
  const ordered = group.rows; // ascending
  const latest = ordered[ordered.length - 1];
  const earlier = ordered.slice(0, -1);

  return {
    title: group.title,
    year: group.year,
    dateWatched: latest.watchedDate,
    rating: latest.rating,
    rewatch: ordered.length > 1,
    tags: latest.tags.length ? latest.tags : undefined,
    letterboxdUri: group.letterboxdUri,
    previousWatches: earlier.length ? earlier.map(rowToWatchEntry) : undefined,
    source: 'letterboxd',
  };
}

/**
 * Merges a group's watches into an already-existing movie: any
 * watchedDate already on record (top-level or in previousWatches) is
 * skipped, so re-running an import never creates duplicate watches.
 * Returns a patch ready for updateLifeItem, or undefined if there's
 * genuinely nothing new to add.
 */
export function mergeGroupIntoExisting(existing: MovieItem, group: GroupedLetterboxdFilm): LifeItemPatch | undefined {
  const knownDates = new Set<string>();
  if (existing.dateWatched) knownDates.add(existing.dateWatched);
  for (const w of existing.previousWatches ?? []) if (w.dateWatched) knownDates.add(w.dateWatched);

  const newRows = group.rows.filter((r) => !r.watchedDate || !knownDates.has(r.watchedDate));
  if (newRows.length === 0) return undefined;

  const combined = [
    ...(existing.previousWatches ?? []).map((w) => ({ dateWatched: w.dateWatched, rating: w.rating })),
    { dateWatched: existing.dateWatched, rating: existing.rating },
    ...newRows.map((r) => ({ dateWatched: r.watchedDate, rating: r.rating })),
  ].sort((a, b) => (a.dateWatched ?? '').localeCompare(b.dateWatched ?? ''));

  const latest = combined[combined.length - 1];
  const earlier = combined.slice(0, -1);

  return {
    type: 'movie',
    dateWatched: latest.dateWatched,
    rating: latest.rating,
    rewatch: combined.length > 1,
    previousWatches: earlier.map((e) => ({ id: generateId(), dateWatched: e.dateWatched, rating: e.rating, source: 'letterboxd' })),
  };
}
