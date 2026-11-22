import { isWishlistItem } from '@/db/lifeDates';
import { db } from '../db';
import { getLocalDateKey } from '../dateUtils';
import { generateId, nowIso } from '../id';
import type { LifeItem, LifeItemType, NewLifeItemInput, LifeItemPatch, BookItem, MovieItem } from '../schema';
import { deleteLifeImage } from './lifeImageRepository';

/**
 * All repository functions here are pure reads unless named
 * create/update/delete/toggle/log — the read functions (getLifeItems,
 * searchLifeItems, getRecentlyAdded, getLifeCounts) are safe to call
 * from inside a Dexie liveQuery querier because they never write.
 */

/**
 * The Life categories. The same table also holds study subjects and
 * sessions (shown on Week), so every Life read filters to these.
 */
export const LIFE_ITEM_TYPES: readonly LifeItemType[] = ['book', 'movie', 'series', 'artwork', 'experience', 'wish'];
const isLifeItem = (item: { type: string; deletedAt?: string | null }): item is LifeItem =>
  !item.deletedAt && (LIFE_ITEM_TYPES as readonly string[]).includes(item.type);

function sortKey(item: LifeItem): string {
  const key = rawSortKey(item);
  return typeof key === 'string' ? key : String(item.createdAt ?? '');
}

function rawSortKey(item: LifeItem): unknown {
  switch (item.type) {
    case 'book':
      return item.dateFinished ?? item.dateStarted ?? item.dateAdded ?? item.createdAt;
    case 'movie':
      return item.dateWatched ?? item.createdAt;
    case 'series':
      return item.dateFinished ?? item.dateStarted ?? item.createdAt;
    case 'artwork':
      return item.dateCreated ?? item.createdAt;
    case 'experience':
      return item.date ?? item.createdAt;
    case 'wish':
      return item.dateCompleted ?? item.createdAt;
  }
}

/** Pure: Life items (optionally of one type) from all rows, newest first. */
export function selectLifeItems(all: readonly { type: string; deletedAt?: string | null }[], type?: LifeItemType): LifeItem[] {
  return all
    .filter((item): item is LifeItem => isLifeItem(item) && (!type || item.type === type))
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}

export async function getLifeItems(type?: LifeItemType): Promise<LifeItem[]> {
  // A full read + filter rather than the `type` index, so it can't come back empty if a
  // device's index ever disagrees with its rows. (Screens use the shared copy in lifeStore.ts.)
  return selectLifeItems(await db.lifeItems.toArray(), type);
}

export async function getLifeItem(id: string): Promise<LifeItem | undefined> {
  return db.lifeItems.get(id);
}

export async function createLifeItem(input: NewLifeItemInput): Promise<LifeItem> {
  const timestamp = nowIso();
  const item = { ...input, id: generateId(), createdAt: timestamp, updatedAt: timestamp } as LifeItem;
  await db.lifeItems.add(item);
  return item;
}

/** Adds many items in one transaction (used by imports — thousands of rows in a second or two). */
export async function bulkCreateLifeItems(inputs: NewLifeItemInput[]): Promise<number> {
  // One millisecond apart, so the order they were given in is kept wherever lists sort by createdAt.
  const start = Date.now();
  const items = inputs.map((input, i) => {
    const timestamp = new Date(start + i).toISOString();
    return { ...input, id: generateId(), createdAt: timestamp, updatedAt: timestamp } as LifeItem;
  });
  await db.lifeItems.bulkAdd(items);
  return items.length;
}

/** Applies many patches in one transaction (imports re-run over thousands of items). */
export async function bulkUpdateLifeItems(updates: { id: string; patch: LifeItemPatch }[]): Promise<number> {
  if (!updates.length) return 0;
  const timestamp = nowIso();
  return db.transaction('rw', db.lifeItems, async () => {
    const existing = await db.lifeItems.bulkGet(updates.map((u) => u.id));
    const next = existing
      .map((item, i) => (item ? ({ ...item, ...updates[i].patch, updatedAt: timestamp } as LifeItem) : null))
      .filter((x): x is LifeItem => x !== null);
    await db.lifeItems.bulkPut(next);
    return next.length;
  });
}

export async function updateLifeItem(id: string, patch: LifeItemPatch): Promise<LifeItem | undefined> {
  const existing = await db.lifeItems.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch, updatedAt: nowIso() } as LifeItem;
  await db.lifeItems.put(updated);
  return updated;
}

/** Only touches the `favorite` field, shared by every category, so it bypasses the per-type patch typing. */
export async function toggleFavorite(id: string): Promise<LifeItem | undefined> {
  const existing = await db.lifeItems.get(id);
  if (!existing) return undefined;
  const updated: LifeItem = { ...existing, favorite: !existing.favorite, updatedAt: nowIso() };
  await db.lifeItems.put(updated);
  return updated;
}

/**
 * Logs a fresh re-read of a book: the CURRENT reading (top-level
 * status/dates/rating/notes) is archived into previousReadings
 * exactly as it stands, and the top-level fields reset to a new
 * "Currently Reading" attempt starting today. Nothing is overwritten
 * or lost — this is additive.
 */
export async function logBookReread(id: string): Promise<BookItem | undefined> {
  const existing = await db.lifeItems.get(id);
  if (!existing || existing.type !== 'book') return undefined;

  const archivedReading = {
    id: generateId(),
    status: existing.status,
    dateStarted: existing.dateStarted,
    dateFinished: existing.dateFinished,
    rating: existing.rating,
    notes: existing.notes,
  };

  const updated: BookItem = {
    ...existing,
    status: 'inProgress',
    dateStarted: getLocalDateKey(),
    dateFinished: undefined,
    rating: undefined,
    notes: undefined,
    previousReadings: [...(existing.previousReadings ?? []), archivedReading],
    updatedAt: nowIso(),
  };
  await db.lifeItems.put(updated);
  return updated;
}

/**
 * Logs a fresh rewatch of a movie — same pattern as logBookReread.
 * The current watch is archived into previousWatches and the
 * top-level fields reset for a new watch dated today.
 */
export async function logMovieRewatch(id: string): Promise<MovieItem | undefined> {
  const existing = await db.lifeItems.get(id);
  if (!existing || existing.type !== 'movie') return undefined;

  const archivedWatch = {
    id: generateId(),
    dateWatched: existing.dateWatched,
    rating: existing.rating,
    review: existing.review,
    source: existing.source === 'letterboxd' ? ('letterboxd' as const) : ('manual' as const),
  };

  const updated: MovieItem = {
    ...existing,
    dateWatched: getLocalDateKey(),
    rating: undefined,
    review: undefined,
    rewatch: true,
    previousWatches: [...(existing.previousWatches ?? []), archivedWatch],
    updatedAt: nowIso(),
  };
  await db.lifeItems.put(updated);
  return updated;
}

/**
 * Soft delete — keeps the row (with deletedAt set) so a future sync
 * stage can propagate the deletion. Associated image blobs ARE
 * removed immediately, since they're not needed once nothing
 * references them and can be large; the small metadata row stays for
 * sync-safety like every other entity in the app.
 */
export async function deleteLifeItem(id: string): Promise<void> {
  const existing = await db.lifeItems.get(id);
  if (!existing) return;

  const imageIds: string[] = [];
  if (existing.type === 'artwork' && existing.imageId) imageIds.push(existing.imageId);
  if (existing.type === 'experience' && existing.imageIds) imageIds.push(...existing.imageIds);
  if (existing.type === 'book' && existing.coverImageId) imageIds.push(existing.coverImageId);
  if (existing.type === 'movie' && existing.posterImageId) imageIds.push(existing.posterImageId);
  if (existing.type === 'series' && existing.posterImageId) imageIds.push(existing.posterImageId);
  await Promise.all(imageIds.map((imgId) => deleteLifeImage(imgId)));

  await db.lifeItems.put({ ...existing, deletedAt: nowIso(), updatedAt: nowIso() });
}

function itemSearchText(item: LifeItem): string {
  const parts: (string | undefined)[] = [item.title, item.notes];
  if (item.type === 'book') parts.push(item.author, item.quote);
  if (item.type === 'movie') parts.push(item.review, ...(item.tags ?? []));
  if (item.type === 'artwork') parts.push(item.medium, item.mood);
  if (item.type === 'experience') parts.push(item.location, item.people, item.description, item.favoriteMemory, ...(item.tags ?? []));
  if (item.type === 'wish') parts.push(item.category);
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/** Simple local, case-insensitive substring search across all LIFE categories. */
export function selectSearch(all: readonly { type: string; deletedAt?: string | null }[], query: string): LifeItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return all.filter((item): item is LifeItem => isLifeItem(item) && itemSearchText(item).includes(trimmed));
}

export async function searchLifeItems(query: string): Promise<LifeItem[]> {
  return selectSearch(await db.lifeItems.toArray(), query);
}

export function selectRecentlyAdded(all: readonly { type: string; deletedAt?: string | null }[], limit = 6): LifeItem[] {
  return all
    .filter((item): item is LifeItem => isLifeItem(item) && !isWishlistItem(item))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

export async function getRecentlyAdded(limit = 6): Promise<LifeItem[]> {
  return selectRecentlyAdded(await db.lifeItems.toArray(), limit);
}

export interface LifeCounts {
  book: number;
  movie: number;
  series: number;
  artwork: number;
  experience: number;
  wish: number;
}

export function selectLifeCounts(all: readonly { type: string; deletedAt?: string | null }[]): LifeCounts {
  const counts: LifeCounts = { book: 0, movie: 0, series: 0, artwork: 0, experience: 0, wish: 0 };
  for (const item of all) {
    if (!isLifeItem(item) || isWishlistItem(item)) continue;
    counts[item.type]++;
  }
  return counts;
}

export async function getLifeCounts(): Promise<LifeCounts> {
  return selectLifeCounts(await db.lifeItems.toArray());
}
