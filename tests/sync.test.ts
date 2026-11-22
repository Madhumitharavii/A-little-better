/**
 * Sync engine tests — runs the real syncEngine against the real local
 * database (in-memory IndexedDB) and a small pretend Supabase that
 * behaves like the real one where it matters: rows are per user, and
 * the SERVER stamps `synced_at` with its own clock on every write.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Pretend Supabase ────────────────────────────────────────────────
const USER = '11111111-1111-4111-8111-111111111111';
type Row = Record<string, unknown> & { id: string; user_id: string };

const remote = vi.hoisted(() => {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  let serverTick = 0;
  const SERVER_START = Date.parse('2026-11-21T10:00:00.000Z');
  return {
    tables,
    /** The server's clock: advances one second per write, formatted the way Postgres returns it. */
    serverNow() {
      serverTick += 1;
      return new Date(SERVER_START + serverTick * 1000).toISOString().replace('Z', '+00:00');
    },
    reset() {
      tables.clear();
      serverTick = 0;
    },
    table(name: string) {
      if (!tables.has(name)) tables.set(name, new Map());
      return tables.get(name)!;
    },
  };
});

function keyFor(table: string, row: Row) {
  return table === 'settings' ? `${row.user_id}:${row.id}` : row.id;
}

/** Writes a row as if another device pushed it (server assigns synced_at). Like the real
 *  database, care entries / reflections are unique per (user, date[, item]): a row with the
 *  same natural key but a new id REPLACES the existing one (the app upserts on that key). */
function remoteUpsert(table: string, row: Row) {
  const t = remote.table(table);
  const natural = (r: Row) =>
    table === 'care_entries' ? `${r.user_id}|${r.date}|${r.item_key}` : table === 'daily_reflections' ? `${r.user_id}|${r.date}` : null;
  const key = natural(row);
  if (key) for (const [k, existing] of t) if (natural(existing) === key && k !== keyFor(table, row)) t.delete(k);
  t.set(keyFor(table, row), { ...row, synced_at: remote.serverNow() });
}

vi.mock('@/lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: null }));

vi.mock('@/lib/sync/authService', () => ({ getCurrentUserId: async () => USER }));

vi.mock('@/lib/sync/syncService', () => ({
  pushRow: async (table: string, row: Row) => remoteUpsert(table, row),
  pushRows: async (table: string, rows: Row[]) => rows.forEach((row) => remoteUpsert(table, row)),
  pullRowsSince: async (table: string, userId: string, since?: string) =>
    [...remote.table(table).values()].filter(
      (row) => row.user_id === userId && (!since || Date.parse(row.synced_at as string) > Date.parse(since)),
    ),
  fetchRemoteStamps: async (table: string, userId: string, ids: string[]) =>
    new Map(
      [...remote.table(table).values()]
        .filter((row) => row.user_id === userId && ids.includes(row.id as string))
        .map((row) => [row.id as string, row.updated_at as string]),
    ),
  softDeleteRow: async (table: string, id: string, deletedAt: string) => {
    const row = remote.table(table).get(id);
    if (row) remote.table(table).set(id, { ...row, deleted_at: deletedAt, updated_at: deletedAt, synced_at: remote.serverNow() });
  },
  uploadImageBlob: async (userId: string, imageId: string) => `${userId}/${imageId}`,
  downloadImageBlob: async () => new Blob(['img']),
  deleteImageBlob: async () => {},
}));

// Imported after the mocks above.
import { db } from '@/db/db';
import { runSync, getSyncStatus, friendlySyncError } from '@/lib/sync/syncEngine';
import { clearCareEntry } from '@/db/repositories/careRepository';
import { ensureDefaultSettings, getSettings, saveSyncBookkeeping } from '@/db/repositories/settingsRepository';
import * as mapping from '@/lib/sync/mapping';
import type { CareEntry, JournalEntry } from '@/db/schema';

const iso = (s: string) => new Date(s).toISOString();

function care(id: string, date: string, itemKey: CareEntry['itemKey'], updatedAt: string): CareEntry {
  return { id, date, itemKey, status: 'done', createdAt: updatedAt, updatedAt };
}

function journal(id: string, body: string, updatedAt: string): JournalEntry {
  return { id, date: updatedAt.slice(0, 10), body, createdAt: updatedAt, updatedAt, deletedAt: null };
}

async function syncOk() {
  await runSync();
  const status = getSyncStatus();
  expect(status.status, status.errorMessage).toBe('synced');
}

beforeEach(async () => {
  vi.useRealTimers();
  remote.reset();
  await db.delete();
  await db.open();
  await ensureDefaultSettings();
});

describe('first sync', () => {
  it('uploads everything already on the device', async () => {
    await db.journalEntries.put(journal('j1', 'hello', iso('2026-08-01T09:00:00Z')));
    await db.careEntries.put(care('c1', '2026-08-01', 'bathed', iso('2026-08-01T09:00:00Z')));

    await syncOk();

    expect(remote.table('journal_entries').get('j1')?.body).toBe('hello');
    expect(remote.table('care_entries').has('c1')).toBe(true);
  });

  it('downloads what is already in the account onto an empty device', async () => {
    const entry = journal('j2', 'from my phone', iso('2026-09-01T09:00:00Z'));
    remoteUpsert('journal_entries', mapping.journalEntryToRemote(entry, USER, 'phone') as unknown as Row);

    await syncOk();

    expect((await db.journalEntries.get('j2'))?.body).toBe('from my phone');
  });
});

describe('conflicts (last write wins)', () => {
  it('takes a newer remote edit and keeps a newer local edit', async () => {
    await db.journalEntries.put(journal('older-here', 'local old', iso('2026-09-01T09:00:00Z')));
    await db.journalEntries.put(journal('newer-here', 'local new', iso('2026-09-05T09:00:00Z')));
    await syncOk();

    remoteUpsert('journal_entries', mapping.journalEntryToRemote(journal('older-here', 'remote newer', iso('2026-09-03T09:00:00Z')), USER, 'phone') as unknown as Row);
    remoteUpsert('journal_entries', mapping.journalEntryToRemote(journal('newer-here', 'remote older', iso('2026-09-02T09:00:00Z')), USER, 'phone') as unknown as Row);
    await syncOk();

    expect((await db.journalEntries.get('older-here'))?.body).toBe('remote newer');
    expect((await db.journalEntries.get('newer-here'))?.body).toBe('local new');
  });
});

describe('deletes', () => {
  it('un-ticking a care item marks it deleted in the cloud', async () => {
    await db.careEntries.put(care('c1', '2026-11-21', 'movement', iso('2026-11-21T08:00:00Z')));
    await syncOk();

    await clearCareEntry('2026-11-21', 'movement');
    expect(await db.syncTombstones.count()).toBe(1);
    await syncOk();

    expect(remote.table('care_entries').get('c1')?.deleted_at).toBeTruthy();
    expect(await db.syncTombstones.count()).toBe(0);
    // ...and the next pull doesn't bring it back.
    await syncOk();
    expect(await db.careEntries.get('c1')).toBeUndefined();
  });

  it('a care item deleted on another device disappears here', async () => {
    const entry = care('c2', '2026-11-20', 'bathed', iso('2026-11-20T08:00:00Z'));
    await db.careEntries.put(entry);
    await syncOk();

    const deletedAt = iso('2026-11-20T09:00:00Z');
    remoteUpsert('care_entries', { ...(mapping.careEntryToRemote(entry, USER, 'phone') as unknown as Row), deleted_at: deletedAt, updated_at: deletedAt });
    await syncOk();

    expect(await db.careEntries.get('c2')).toBeUndefined();
  });
});

describe('same item ticked on two devices', () => {
  it('ends with one record — the newer one — everywhere', async () => {
    await db.careEntries.put(care('mac', '2026-11-21', 'bathed', iso('2026-11-21T07:00:00Z')));
    remoteUpsert('care_entries', mapping.careEntryToRemote(care('phone', '2026-11-21', 'bathed', iso('2026-11-21T07:30:00Z')), USER, 'phone') as unknown as Row);

    await syncOk();
    const local = await db.careEntries.where('[date+itemKey]').equals(['2026-11-21', 'bathed']).toArray();
    expect(local.map((c) => c.id)).toEqual(['phone']);

    await syncOk();
    // The database allows one row per day + item: the account holds just the newer one.
    const cloud = [...remote.table('care_entries').values()].filter((r) => r.date === '2026-11-21' && r.item_key === 'bathed');
    expect(cloud.map((r) => [r.id, !!r.deleted_at])).toEqual([['phone', false]]);
  });
});

describe('clocks', () => {
  it("a device whose clock runs an hour fast still receives other devices' changes", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T11:00:00Z')); // server is at ~10:00
    await syncOk();

    remoteUpsert('journal_entries', mapping.journalEntryToRemote(journal('jx', 'written on phone', iso('2026-11-21T10:05:00Z')), USER, 'phone') as unknown as Row);
    await syncOk();

    expect((await db.journalEntries.get('jx'))?.body).toBe('written on phone');
  });

  it("sync's own bookkeeping never makes settings look newly edited", async () => {
    const before = (await getSettings()).updatedAt;
    await saveSyncBookkeeping({ lastSyncedAt: iso('2030-01-01T00:00:00Z') });
    expect((await getSettings()).updatedAt).toBe(before);
  });
});

describe('found in the full audit', () => {
  it('re-ticking an item after un-ticking it keeps syncing (no clash with the one-per-day rule)', async () => {
    await db.careEntries.put(care('c1', '2026-11-21', 'bathed', iso('2026-11-21T09:00:00Z')));
    await syncOk();
    await clearCareEntry('2026-11-21', 'bathed'); // un-tick
    await db.careEntries.put(care('c2', '2026-11-21', 'bathed', new Date().toISOString())); // re-tick now → new id
    await syncOk();
    const rows = [...remote.table('care_entries').values()].filter((r) => r.date === '2026-11-21' && r.item_key === 'bathed');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'c2', deleted_at: null });
  });

  it("the same day's reflection written on two devices is combined, not rejected or lost", async () => {
    remoteUpsert('daily_reflections', mapping.dailyReflectionToRemote({ id: 'phone', date: '2026-11-21', gratitude: 'Morning coffee', createdAt: iso('2026-11-21T08:00:00Z'), updatedAt: iso('2026-11-21T08:00:00Z') }, USER, 'phone'));
    await db.dailyReflections.put({ id: 'mac', date: '2026-11-21', eveningGoodThing: 'A long walk', createdAt: iso('2026-11-21T20:00:00Z'), updatedAt: iso('2026-11-21T20:00:00Z') });
    await syncOk();
    await syncOk();
    const local = await db.dailyReflections.where('date').equals('2026-11-21').toArray();
    expect(local).toHaveLength(1);
    expect(local[0]).toMatchObject({ gratitude: 'Morning coffee', eveningGoodThing: 'A long walk' });
    const cloud = [...remote.table('daily_reflections').values()].filter((r) => r.date === '2026-11-21');
    expect(cloud).toHaveLength(1);
    expect(cloud[0]).toMatchObject({ gratitude: 'Morning coffee', evening_good_thing: 'A long walk' });
  });

  it('an older offline edit never overwrites a newer version already in the account', async () => {
    remoteUpsert('journal_entries', mapping.journalEntryToRemote(journal('j1', 'Newer, from the Mac', iso('2026-11-21T11:00:00Z')), USER, 'mac'));
    await db.journalEntries.put(journal('j1', 'Older, edited offline on the phone', iso('2026-11-21T10:00:00Z')));
    await syncOk();
    expect(remote.table('journal_entries').get('j1')?.body).toBe('Newer, from the Mac');
    expect((await db.journalEntries.get('j1'))?.body).toBe('Newer, from the Mac');
  });

  it("a new device's default settings never reset the settings already in the account", async () => {
    remoteUpsert('settings', mapping.settingsToRemote({ ...(await getSettings()), theme: 'dark', nightReminderEnabled: true, updatedAt: iso('2026-11-20T10:00:00Z') }, USER, 'mac'));
    await syncOk();
    const s = await getSettings();
    expect(s.theme).toBe('dark');
    expect(s.nightReminderEnabled).toBe(true);
    expect([...remote.table('settings').values()][0]).toMatchObject({ theme: 'dark' });
  });
});

describe('error messages', () => {
  it('turns raw errors into calm sentences', () => {
    expect(friendlySyncError(new TypeError('Failed to fetch'))).toMatch(/Couldn't reach the cloud/);
    expect(friendlySyncError({ message: 'JWT expired' })).toMatch(/sign-in has expired/);
    expect(friendlySyncError({ code: '42501', message: 'permission denied for table people' })).toMatch(/didn't allow/);
    expect(friendlySyncError(new Error('something odd'))).toMatch(/safe on this device/);
  });
});
