import type { BookItem } from '@/db/schema';
import { parseCsv } from '@/shared/utils/csv';

/**
 * Goodreads → A Little Better is a ONE-WAY import of the CSV from
 * Goodreads' "Export Library" feature (My Books → Import/Export).
 * Like the Letterboxd importer, this never talks to goodreads.com —
 * it only parses a file the person downloaded themselves.
 *
 * Goodreads' export has one row per book (not per reading), with an
 * "Exclusive Shelf" column (to-read / currently-reading / read) and
 * a "Bookshelves" column for any custom shelves. Per spec, only
 * finished or did-not-finish books are imported — "Want to Read" and
 * anything still unread is skipped, since this app isn't a to-read
 * queue.
 */

export interface ParsedGoodreadsRow {
  title: string;
  author?: string;
  rating?: number;
  dateRead?: string;
  dateAdded?: string;
  review?: string;
  status: 'finished' | 'didNotFinish';
}

function normalizeDate(raw: string | undefined): string | undefined {
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

function looksLikeDnfShelf(bookshelves: string): boolean {
  const normalized = bookshelves.toLowerCase().replace(/[\s_]/g, '-');
  return normalized.includes('did-not-finish') || normalized.includes('dnf') || normalized.includes('abandoned');
}

export function parseGoodreadsCsv(csvText: string): ParsedGoodreadsRow[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const titleIdx = col('title');
  const authorIdx = col('author');
  const ratingIdx = col('my rating');
  const dateReadIdx = col('date read');
  const dateAddedIdx = col('date added');
  const reviewIdx = col('my review');
  const shelfIdx = col('exclusive shelf');
  const bookshelvesIdx = col('bookshelves');

  if (titleIdx === -1) {
    throw new Error("This doesn't look like a Goodreads export (no 'Title' column found).");
  }

  const parsed: ParsedGoodreadsRow[] = [];

  for (const cells of rows.slice(1)) {
    const title = cells[titleIdx]?.trim();
    if (!title) continue;

    const exclusiveShelf = shelfIdx !== -1 ? cells[shelfIdx]?.trim().toLowerCase() : '';
    const bookshelves = bookshelvesIdx !== -1 ? cells[bookshelvesIdx]?.trim() ?? '' : '';
    const isDnf = looksLikeDnfShelf(bookshelves);
    const isRead = exclusiveShelf === 'read';

    // Only Read or Did-Not-Finish books are imported — everything
    // else (to-read, currently-reading, with no dnf tag) is skipped.
    if (!isRead && !isDnf) continue;

    const ratingRaw = ratingIdx !== -1 ? cells[ratingIdx]?.trim() : '';
    const rating = ratingRaw && Number(ratingRaw) > 0 ? Number(ratingRaw) : undefined;

    parsed.push({
      title,
      author: authorIdx !== -1 ? cells[authorIdx]?.trim() || undefined : undefined,
      rating,
      dateRead: dateReadIdx !== -1 ? normalizeDate(cells[dateReadIdx]) : undefined,
      dateAdded: dateAddedIdx !== -1 ? normalizeDate(cells[dateAddedIdx]) : undefined,
      review: reviewIdx !== -1 ? cells[reviewIdx]?.trim() || undefined : undefined,
      status: isDnf ? 'didNotFinish' : 'finished',
    });
  }

  return parsed;
}

export function findExistingDuplicate(row: ParsedGoodreadsRow, existing: BookItem[]): BookItem | undefined {
  return existing.find(
    (b) =>
      b.title.trim().toLowerCase() === row.title.trim().toLowerCase() &&
      (b.author ?? '').trim().toLowerCase() === (row.author ?? '').trim().toLowerCase(),
  );
}

export function rowToBookInput(row: ParsedGoodreadsRow): Omit<BookItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type'> {
  return {
    title: row.title,
    author: row.author,
    status: row.status,
    dateAdded: row.dateAdded,
    dateFinished: row.dateRead,
    rating: row.rating,
    notes: row.review,
    source: 'goodreads',
  };
}
