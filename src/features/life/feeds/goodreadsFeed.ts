import type { BookStatus } from '@/db/schema';
import { cleanReview } from '@/shared/utils/html';
import { normalizeDate, type ParsedGoodreadsRow } from '../books/goodreadsImport';
import { parseRssItems } from './rss';

export type GoodreadsShelf = 'read' | 'currently-reading' | 'to-read';

const norm = (s: string) => s.toLowerCase().replace(/[\s_]+/g, '-');
const STANDARD = new Set(['read', 'to-read', 'currently-reading']);

/**
 * One Goodreads shelf feed (goodreads.com/review/list_rss/<id>?shelf=…) → the
 * rows the Goodreads importer understands, so the same merge rules apply.
 */
export function parseGoodreadsFeed(xml: string, shelf: GoodreadsShelf): ParsedGoodreadsRow[] {
  return parseRssItems(xml)
    .map((item): ParsedGoodreadsRow | null => {
      const title = (item.title ?? '').trim();
      if (!title) return null;
      const shelves = (item.user_shelves ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const dnf = shelves.some((s) => /did-not-finish|\bdnf\b|abandon/.test(norm(s)));
      const status: BookStatus = dnf ? 'didNotFinish' : shelf === 'read' ? 'finished' : shelf === 'currently-reading' ? 'inProgress' : 'wantTo';
      const rating = Number(item.user_rating);
      const review = cleanReview(item.user_review ?? '');
      return {
        title,
        author: item.author_name?.trim() || undefined,
        rating: rating > 0 ? rating : undefined,
        dateRead: normalizeDate(item.user_read_at),
        dateAdded: normalizeDate(item.user_date_added),
        notes: review || undefined,
        status,
        readCount: 0,
        favorite: shelves.some((s) => /^(favou?rites?|favs?)$/.test(norm(s))),
        shelves: shelves.filter((s) => !STANDARD.has(s.toLowerCase()) && !/did-not-finish|\bdnf\b|abandon|^favou?rites?$/.test(norm(s))),
      };
    })
    .filter((r): r is ParsedGoodreadsRow => r !== null);
}
