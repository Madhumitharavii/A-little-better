import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { CareEntry, CareItemKey, CareStatus } from '../schema';

/** All care entries for one local date (one row per item at most). */
export async function getDailyCare(date: string): Promise<CareEntry[]> {
  return db.careEntries.where('date').equals(date).toArray();
}

/** Every care entry ever recorded, oldest first — used to compute streaks/stats. */
export async function getAllCareEntries(): Promise<CareEntry[]> {
  return db.careEntries.orderBy('date').toArray();
}

interface SaveCareEntryInput {
  date: string;
  itemKey: CareItemKey;
  status: CareStatus;
  skipReason?: string | null;
  /** If provided, replaces valueMinutes outright rather than adding to it. */
  valueMinutes?: number;
}

/**
 * Create-or-update the single row for (date, itemKey). Marking an
 * item done or skipped is always a full upsert of that day's status —
 * there's only ever one row per item per day.
 */
export async function saveCareEntry(input: SaveCareEntryInput): Promise<CareEntry> {
  const existing = await db.careEntries
    .where('[date+itemKey]')
    .equals([input.date, input.itemKey])
    .first();

  const timestamp = nowIso();

  if (existing) {
    const updated: CareEntry = {
      ...existing,
      status: input.status,
      skipReason: input.status === 'skipped' ? input.skipReason ?? null : null,
      valueMinutes: input.valueMinutes ?? existing.valueMinutes,
      updatedAt: timestamp,
    };
    await db.careEntries.put(updated);
    return updated;
  }

  const created: CareEntry = {
    id: generateId(),
    date: input.date,
    itemKey: input.itemKey,
    status: input.status,
    skipReason: input.status === 'skipped' ? input.skipReason ?? null : null,
    valueMinutes: input.valueMinutes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.careEntries.add(created);
  return created;
}

/**
 * Adds minutes to a day's reading/focus tally (creating the row and
 * marking it done if it doesn't exist yet).
 */
export async function addMinutesToCareEntry(
  date: string,
  itemKey: Extract<CareItemKey, 'reading' | 'focus'>,
  minutesToAdd: number,
): Promise<CareEntry> {
  const existing = await db.careEntries
    .where('[date+itemKey]')
    .equals([date, itemKey])
    .first();

  const timestamp = nowIso();

  if (existing) {
    const updated: CareEntry = {
      ...existing,
      status: 'done',
      skipReason: null,
      valueMinutes: (existing.valueMinutes ?? 0) + minutesToAdd,
      updatedAt: timestamp,
    };
    await db.careEntries.put(updated);
    return updated;
  }

  const created: CareEntry = {
    id: generateId(),
    date,
    itemKey,
    status: 'done',
    valueMinutes: minutesToAdd,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.careEntries.add(created);
  return created;
}

/** Clears a single item's status for the day (used to "un-check" something). */
export async function clearCareEntry(date: string, itemKey: CareItemKey): Promise<void> {
  const existing = await db.careEntries
    .where('[date+itemKey]')
    .equals([date, itemKey])
    .first();
  if (existing) {
    await db.careEntries.delete(existing.id);
  }
}
