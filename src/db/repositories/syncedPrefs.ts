import type { Table } from 'dexie';
import { getLifeRows, subscribeLifeRows } from '../lifeStore';
import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { SyncedPrefItem } from '../schema';

/**
 * Preferences that follow you between devices. Each is a row in the
 * synced lifeItems table (type "pref"), so they travel with normal sync —
 * no extra database tables needed. Reads take the newest row for a key.
 */
export type PrefKey = 'aiEnabled' | 'advisorHistory' | 'advisorSeen' | 'studyTimer' | 'connectedAccounts' | 'water';

const table = () => db.lifeItems as unknown as Table<SyncedPrefItem, string>;

async function newest(key: PrefKey): Promise<SyncedPrefItem | undefined> {
  // The shared copy when it's loaded (no extra full read of the table); otherwise read it.
  const all = (getLifeRows() as unknown as SyncedPrefItem[] | undefined) ?? (await table().toArray());
  const rows = all.filter((r) => r.type === 'pref' && r.key === key && !r.deletedAt);
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export async function readPref<T>(key: PrefKey): Promise<{ value: T; updatedAt: string } | undefined> {
  const row = await newest(key);
  return row ? { value: row.value as T, updatedAt: row.updatedAt } : undefined;
}

/** What this device itself last wrote, per key — so its own writes aren't treated as news from another device. */
const ownWrites = new Map<PrefKey, string>();

export async function writePref(key: PrefKey, value: unknown): Promise<void> {
  const row = await newest(key);
  if (row && JSON.stringify(row.value) === JSON.stringify(value)) return;
  const now = nowIso();
  ownWrites.set(key, now);
  await table().put(row ? { ...row, value, updatedAt: now } : { id: generateId(), type: 'pref', title: key, key, value, createdAt: now, updatedAt: now });
}

/** Calls back when a newer value arrives (from another device, via sync). Returns an unsubscribe function. */
export function watchPref<T>(key: PrefKey, onChange: (value: T) => void): () => void {
  let last: string | undefined;
  const check = () => {
    const rows = getLifeRows();
    if (!rows) return;
    let row: SyncedPrefItem | undefined;
    for (const r of rows as unknown as SyncedPrefItem[]) {
      if (r.type === 'pref' && r.key === key && !r.deletedAt && (!row || r.updatedAt > row.updatedAt)) row = r;
    }
    if (!row || row.updatedAt === last) return;
    last = row.updatedAt;
    if (ownWrites.get(key) === row.updatedAt) return;
    onChange(row.value as T);
  };
  const stop = subscribeLifeRows(check);
  check();
  return stop;
}
