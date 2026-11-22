import type { BookItem, BookReadingEntry, BookStatus, LifeItemPatch } from '@/db/schema';
import { generateId } from '@/db/id';
import { parseCsv } from '@/shared/utils/csv';
import { cleanReview } from '@/shared/utils/html';

/**
 * Goodreads → A Little Better: a ONE-WAY import of the CSV from
 * Goodreads' "Export Library" (My Books → Import and export). It never
 * talks to goodreads.com — it only reads a file the person downloaded.
 *
 * One row per book. Mapping:
 *   Exclusive Shelf  read → finished · currently-reading → inProgress ·
 *                    to-read → wantTo · a dnf/abandoned shelf → didNotFinish
 *   My Rating        1–5 (0 = not rated)
 *   Date Read / Date Added   dateFinished / dateAdded
 *   My Review (+ Private Notes)   notes (HTML cleaned)
 *   Read Count > 1   earlier readings, so rereads show as "Reading #n"
 *   Bookshelves      a "favorites" shelf → ♥; other custom shelves kept as shelves
 *
 * Books are matched to ones already in the app by title + author, so
 * re-running an import fills in what's new and never duplicates.
 */

export interface ParsedGoodreadsRow {
  title: string;
  author?: string;
  rating?: number;
  dateRead?: string;
  dateAdded?: string;
  notes?: string;
  status: BookStatus;
  readCount: number;
  favorite: boolean;
  shelves: string[];
}

export function normalizeDate(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) return trimmed.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_]+/g, '-');
const isDnfShelf = (shelf: string) => /did-not-finish|\bdnf\b|abandon/.test(norm(shelf));
const isFavoritesShelf = (shelf: string) => /^(favou?rites?|favs?|all-time-favou?rites?)$/.test(norm(shelf));
const STANDARD_SHELVES = new Set(['read', 'to-read', 'currently-reading']);

export function parseGoodreadsCsv(csvText: string): ParsedGoodreadsRow[] {
  const rows = parseCsv(csvText.replace(/^﻿/, ''));
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const titleIdx = col('title');
  if (titleIdx === -1) {
    throw new Error("This doesn't look like a Goodreads export (no 'Title' column found).");
  }
  const get = (cells: string[], name: string) => {
    const i = col(name);
    return i === -1 ? '' : cells[i]?.trim() ?? '';
  };

  const parsed: ParsedGoodreadsRow[] = [];
  for (const cells of rows.slice(1)) {
    const title = cells[titleIdx]?.trim();
    if (!title) continue;

    const exclusive = get(cells, 'exclusive shelf').toLowerCase();
    const shelvesRaw = [exclusive, ...get(cells, 'bookshelves').split(',')].map((s) => s.trim()).filter(Boolean);
    const dateRead = normalizeDate(get(cells, 'date read'));

    let status: BookStatus;
    if (shelvesRaw.some(isDnfShelf)) status = 'didNotFinish';
    else if (exclusive === 'read') status = 'finished';
    else if (exclusive === 'currently-reading') status = 'inProgress';
    else if (exclusive === 'to-read') status = 'wantTo';
    else status = dateRead ? 'finished' : 'wantTo'; // a custom exclusive shelf

    const ratingRaw = Number(get(cells, 'my rating'));
    const review = cleanReview(get(cells, 'my review'));
    const privateNotes = cleanReview(get(cells, 'private notes'));
    const notes = [review, privateNotes && `Private notes: ${privateNotes}`].filter(Boolean).join('\n\n') || undefined;
    const readCount = Number(get(cells, 'read count')) || 0;

    const shelves = [...new Set(shelvesRaw.filter((s) => !STANDARD_SHELVES.has(s.toLowerCase()) && !isDnfShelf(s) && !isFavoritesShelf(s)))];

    parsed.push({
      title,
      author: get(cells, 'author') || undefined,
      rating: ratingRaw > 0 ? ratingRaw : undefined,
      dateRead,
      dateAdded: normalizeDate(get(cells, 'date added')),
      notes,
      status,
      readCount,
      favorite: shelvesRaw.some(isFavoritesShelf),
      shelves,
    });
  }
  return parsed;
}

export const bookKey = (title: string, author?: string) =>
  `${title.trim().toLowerCase().replace(/\s+/g, ' ')}|${(author ?? '').trim().toLowerCase().replace(/\s+/g, ' ')}`;

type NewBookInput = Omit<BookItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** Earlier readings for a reread book (Goodreads only keeps the latest date, so these are undated). */
const earlierReadings = (row: ParsedGoodreadsRow): BookReadingEntry[] | undefined =>
  row.status === 'finished' && row.readCount > 1
    ? Array.from({ length: row.readCount - 1 }, () => ({ id: generateId(), status: 'finished' as const }))
    : undefined;

export function rowToBookInput(row: ParsedGoodreadsRow): NewBookInput {
  return {
    type: 'book',
    title: row.title,
    author: row.author,
    status: row.status,
    dateAdded: row.dateAdded,
    dateFinished: row.status === 'finished' || row.status === 'didNotFinish' ? row.dateRead : undefined,
    rating: row.rating,
    notes: row.notes,
    favorite: row.favorite || undefined,
    shelves: row.shelves.length ? row.shelves : undefined,
    previousReadings: earlierReadings(row),
    source: 'goodreads',
  };
}

const STATUS_RANK: Record<BookStatus, number> = { wantTo: 0, inProgress: 1, didNotFinish: 2, finished: 3 };

/**
 * Fills in a book already in the app: a missing rating, date or notes,
 * a status that moved forward (want to read → reading → finished), ♥ from
 * a favorites shelf, and any new shelves. Never overwrites or removes
 * what's already there. Returns undefined when there's nothing new.
 */
export function mergeRowIntoExisting(existing: BookItem, row: ParsedGoodreadsRow): LifeItemPatch | undefined {
  const patch: Partial<BookItem> = {};
  const rank = (s?: BookStatus) => (s ? STATUS_RANK[s] : -1);
  if (rank(row.status) > rank(existing.status)) patch.status = row.status;
  const finishedNow = (patch.status ?? existing.status) === 'finished' || (patch.status ?? existing.status) === 'didNotFinish';
  if (!existing.dateFinished && row.dateRead && finishedNow) patch.dateFinished = row.dateRead;
  if (!existing.dateAdded && row.dateAdded) patch.dateAdded = row.dateAdded;
  if (existing.rating == null && row.rating != null) patch.rating = row.rating;
  if (!existing.notes && row.notes) patch.notes = row.notes;
  if (!existing.favorite && row.favorite) patch.favorite = true;
  const shelves = [...new Set([...(existing.shelves ?? []), ...row.shelves])];
  if (shelves.length > (existing.shelves?.length ?? 0)) patch.shelves = shelves;
  if (!existing.previousReadings?.length && row.status === 'finished' && row.readCount > 1) patch.previousReadings = earlierReadings(row);
  return Object.keys(patch).length ? ({ type: 'book', ...patch } as LifeItemPatch) : undefined;
}

export interface GoodreadsPlan {
  creates: NewBookInput[];
  updates: { id: string; patch: LifeItemPatch }[];
  summary: {
    books: number;
    newBooks: number;
    updatedBooks: number;
    unchangedBooks: number;
    finished: number;
    reading: number;
    wantTo: number;
    didNotFinish: number;
    reviews: number;
    favorites: number;
    rereads: number;
    shelves: string[];
  };
}

/** Exactly what an import will add and change — pure, so it's shown before anything is written. */
export function planGoodreadsImport(rows: ParsedGoodreadsRow[], existingBooks: BookItem[]): GoodreadsPlan {
  const existing = new Map<string, BookItem>();
  for (const b of existingBooks) if (!b.deletedAt) existing.set(bookKey(b.title, b.author), b);

  const seen = new Set<string>();
  const creates: NewBookInput[] = [];
  const updates: GoodreadsPlan['updates'] = [];
  let unchanged = 0;
  for (const row of rows) {
    const key = bookKey(row.title, row.author);
    if (seen.has(key)) continue; // the same book listed twice
    seen.add(key);
    const match = existing.get(key);
    if (!match) creates.push(rowToBookInput(row));
    else {
      const patch = mergeRowIntoExisting(match, row);
      if (patch) updates.push({ id: match.id, patch });
      else unchanged++;
    }
  }
  const count = (s: BookStatus) => rows.filter((r) => r.status === s).length;
  return {
    creates,
    updates,
    summary: {
      books: seen.size,
      newBooks: creates.length,
      updatedBooks: updates.length,
      unchangedBooks: unchanged,
      finished: count('finished'),
      reading: count('inProgress'),
      wantTo: count('wantTo'),
      didNotFinish: count('didNotFinish'),
      reviews: rows.filter((r) => r.notes).length,
      favorites: rows.filter((r) => r.favorite).length,
      rereads: rows.filter((r) => r.status === 'finished' && r.readCount > 1).length,
      shelves: [...new Set(rows.flatMap((r) => r.shelves))],
    },
  };
}
