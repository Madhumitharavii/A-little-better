import { db } from '@/db/db';
import { nowIso } from '@/db/id';
import type { BookItem, MovieItem } from '@/db/schema';
import { undoAutoLog } from '@/features/life/promises';

/** The day picks stopped logging things straight away — only picks up to then are undone. */
const CHANGED_ON = '2026-11-25';
const DONE_KEY = 'alb.undoPickLogs.v1';

/**
 * One-time: films and books that "Pick for me" logged straight away go
 * back to the watchlist / to-read shelf (still remembered as a pick).
 * If you really watched one and logged it on Letterboxd, the next feed
 * sync marks it watched again with the real date.
 */
export async function undoPickAutoLogs(): Promise<void> {
  try {
    if (localStorage.getItem(DONE_KEY)) return;
  } catch {
    return;
  }
  const rows = (await db.lifeItems.toArray()) as unknown as (MovieItem | BookItem)[];
  const now = nowIso();
  const changed = rows.flatMap((r) => {
    if (r.type !== 'movie' && r.type !== 'book') return [];
    const patch = undoAutoLog(r, CHANGED_ON);
    return patch ? [{ ...r, ...patch, updatedAt: now }] : [];
  });
  if (changed.length) await db.lifeItems.bulkPut(changed as never);
  try {
    localStorage.setItem(DONE_KEY, now);
  } catch {
    /* fine */
  }
}
