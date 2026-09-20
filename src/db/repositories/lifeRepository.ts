import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { LifeItem, LifeItemType, NewLifeItemInput, LifeItemPatch, BookItem, MovieItem } from '../schema';
import { deleteLifeImage } from './lifeImageRepository';

/**
 * All repository functions here are pure reads unless named
 * create/update/delete/toggle/log — the read functions (getLifeItems,
 * searchLifeItems, getRecentlyAdded, getLifeCounts) are safe to call
 * from inside a Dexie liveQuery querier because they never write.
 */

function sortKey(item: LifeItem): string {
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

export async function getLifeItems(type?: LifeItemType): Promise<LifeItem[]> {
  const all = type ? await db.lifeItems.where('type').equals(type).toArray() : await db.lifeItems.toArray();
  return all.filter((item) => !item.deletedAt).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
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
    dateStarted: nowIso().slice(0, 10),
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
    dateWatched: nowIso().slice(0, 10),
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
export async function searchLifeItems(query: string): Promise<LifeItem[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const all = await db.lifeItems.toArray();
  return all.filter((item) => !item.deletedAt && itemSearchText(item).includes(trimmed));
}

export async function getRecentlyAdded(limit = 6): Promise<LifeItem[]> {
  const all = await db.lifeItems.toArray();
  return all
    .filter((item) => !item.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export interface LifeCounts {
  book: number;
  movie: number;
  series: number;
  artwork: number;
  experience: number;
  wish: number;
}

export async function getLifeCounts(): Promise<LifeCounts> {
  const all = await db.lifeItems.toArray();
  const counts: LifeCounts = { book: 0, movie: 0, series: 0, artwork: 0, experience: 0, wish: 0 };
  for (const item of all) {
    if (item.deletedAt) continue;
    counts[item.type]++;
  }
  return counts;
}
