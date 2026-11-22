import type { Table } from 'dexie';
import { db } from '@/db/db';
import { nowIso } from '@/db/id';
import { getSettings, saveSyncBookkeeping, ensureDeviceId } from '@/db/repositories/settingsRepository';
import { listTombstones, clearTombstone, recordTombstone } from '@/db/repositories/syncTombstoneRepository';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getCurrentUserId } from './authService';
import {
  pushRow,
  pushRows,
  pullRowsSince,
  fetchRemoteStamps,
  softDeleteRow,
  uploadImageBlob,
  downloadImageBlob,
  deleteImageBlob,
} from './syncService';
import * as mapping from './mapping';
import type {
  RemoteCareEntry,
  RemoteDailyReflection,
  RemoteJournalEntry,
  RemoteLifeItem,
  RemoteLifeImage,
  RemotePerson,
  RemotePeriodEntry,
  RemoteSettings,
  SyncTableName,
} from './types';
import type { CareEntry, DailyReflection, JournalEntry, LifeItem, Person, PeriodEntry } from '@/db/schema';

/**
 * THE ACTUAL SYNC ORCHESTRATOR. This is what makes cross-device sync
 * real rather than just available — see App.tsx for where runSync()
 * gets called (startup, foreground, periodic, connectivity-restored)
 * and AccountSection.tsx for the sign-in UI and manual "Sync now".
 *
 * ── Conflict rule ──
 * Every table pushes local rows changed since the last successful
 * sync, then pulls remote rows changed since then. For each pulled
 * row: if there's no local row, create it (unless it's already
 * deleted remotely — nothing to create). If a local row exists,
 * the remote row only overwrites it when remote.updated_at is
 * STRICTLY newer than local.updatedAt — a newer local edit always
 * wins over an older remote row, and a remote soft-delete is applied
 * like any other update (only when newer), so it can't resurrect an
 * older local copy but also can't silently vanish a newer local
 * edit. This is last-write-wins per row, using each record's own
 * updatedAt — deliberately not a CRDT; simple and sufficient for one
 * person's own devices.
 *
 * ── Two clocks, never mixed ──
 * PUSH decides "what changed here since last time" by comparing local
 * rows' updatedAt to `lastSyncedAt` — both written by this device's
 * own clock. `lastSyncedAt` is the time the last successful sync
 * STARTED, so an edit made while a sync is running is still pushed
 * next time instead of falling into a gap.
 * PULL decides "what changed on the server since last time" using
 * per-table cursors holding the newest SERVER-assigned `synced_at`
 * already pulled — never this device's clock — so a phone whose clock
 * is a few minutes off can't skip another device's changes. Each pull
 * also re-reads a small overlap window before the cursor, to catch a
 * row whose transaction committed just after an earlier pull read the
 * table; re-reading a row is harmless (it's only applied if newer).
 *
 * ── Deletions ──
 * Soft-deleted tables (journal, people, period, LIFE) carry the
 * deletion as an ordinary row update. Care entries and images are
 * hard-deleted locally, so those deletions are recorded as local
 * tombstones (syncTombstoneRepository) and pushed first as remote
 * soft-deletes — and images are also removed from Storage. Pulled
 * remote deletions for those tables delete the local row.
 *
 * ── First-sync safety ──
 * On a device's very first sync (no lastSyncedAt yet), "push" means
 * "push everything local" — so existing local-only data reaches
 * Supabase before the pull can run, even if the remote account is
 * currently empty. The pull that follows then only ever ADDS missing
 * rows or applies strictly-newer ones; it never clears anything. An
 * empty remote account can never wipe a device that already has data,
 * and a device with an empty local database correctly receives
 * everything already in the account.
 */

export type SyncStatus = 'not_configured' | 'signed_out' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncedAt?: string;
  errorMessage?: string;
}

/** How far before each pull cursor to re-read, to catch late-committing writes. */
const PULL_OVERLAP_MS = 2 * 60 * 1000;

let currentStatus: SyncStatusInfo = { status: isSupabaseConfigured ? 'signed_out' : 'not_configured' };
const listeners = new Set<(info: SyncStatusInfo) => void>();

function setStatus(patch: Partial<SyncStatusInfo>) {
  currentStatus = { ...currentStatus, ...patch };
  for (const listener of listeners) listener(currentStatus);
}

/** Subscribe to sync status changes. Returns an unsubscribe function. Calls the listener immediately with the current status. */
export function subscribeSyncStatus(listener: (info: SyncStatusInfo) => void): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(): SyncStatusInfo {
  return currentStatus;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

type Cursors = Partial<Record<SyncTableName, string>>;

/**
 * True when timestamp `a` is strictly later than `b`. Compares real
 * times, not text: Postgres returns e.g. "…:16.12+00:00" while the
 * app writes "…:16.120Z", and comparing those as strings can get the
 * order wrong.
 */
function isLater(a: string, b: string): boolean {
  return Date.parse(a) > Date.parse(b);
}

/** The `since` value to pull with: the table's server-clock cursor minus the overlap window (or undefined → full pull). */
function pullSinceFor(cursors: Cursors, table: SyncTableName): string | undefined {
  const cursor = cursors[table];
  if (!cursor) return undefined;
  const ms = Date.parse(cursor);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms - PULL_OVERLAP_MS).toISOString();
}

/** Advances a table's cursor to the newest server `synced_at` seen in a pull (never moves it backwards). */
function advanceCursor(cursors: Cursors, table: SyncTableName, rows: { synced_at: string }[]): void {
  let newest = cursors[table];
  for (const row of rows) {
    if (!newest || isLater(row.synced_at, newest)) newest = row.synced_at;
  }
  if (newest) cursors[table] = newest;
}

/**
 * Tells Supabase about local hard-deletes recorded since the last
 * sync (care entries un-checked, images removed). Runs before any
 * table is pushed or pulled, so a deleted row can't be pulled back
 * down in the same cycle. Each tombstone is cleared only once its
 * remote soft-delete succeeded; a failure stops the sync and they're
 * retried next time.
 */
async function pushTombstones(userId: string): Promise<void> {
  const tombstones = await listTombstones();
  for (const tombstone of tombstones) {
    // Updating a row that never reached the server is a harmless no-op.
    await softDeleteRow(tombstone.table, tombstone.rowId, tombstone.deletedAt);
    if (tombstone.table === 'life_images') {
      try {
        await deleteImageBlob(`${userId}/${tombstone.rowId}`);
      } catch {
        // The row is already marked deleted, so no device will
        // download it again; a leftover file in Storage is harmless
        // and shouldn't block the rest of sync.
      }
    }
    await clearTombstone(tombstone.id);
  }
}

/** Generic push-then-pull for any table whose local/remote rows both carry id/updatedAt(-ish)/deleted fields in the same shape family. */
async function syncTable<
  Local extends { id: string; updatedAt: string },
  Remote extends { id: string; updated_at: string; deleted_at: string | null; synced_at: string },
>(
  table: 'care_entries' | 'daily_reflections' | 'journal_entries' | 'people' | 'period_entries' | 'life_items',
  dexieTable: Table<Local, string>,
  toRemote: (row: Local, userId: string, deviceId: string | null) => Record<string, unknown>,
  fromRemote: (row: Remote) => Local,
  userId: string,
  deviceId: string | null,
  pushSinceIso: string | undefined,
  cursors: Cursors,
  /**
   * False for tables whose local schema has no deletedAt (care entries,
   * daily reflections): a newer remote soft-delete then removes the
   * local row, instead of being written back as a live row.
   */
  localHasSoftDelete: boolean,
  /**
   * For tables that must hold at most one row per natural key (care
   * entries: one per date + item). Returns a local row with the same
   * natural key but a DIFFERENT id — which happens when two devices
   * each ticked the same item for the same day before syncing.
   */
  findLocalTwin?: (remote: Remote) => Promise<Local | undefined>,
  /** Table name used for tombstones when a duplicate twin is resolved. */
  twinTombstoneTable?: 'care_entries',
  /**
   * For twins whose content should be COMBINED rather than one discarded (daily
   * reflections: morning notes on the phone + evening notes on the Mac, same day).
   */
  mergeTwin?: (remote: Local, twin: Local) => Local,
  /** The natural key a table's rows are unique on (care: date+item, reflections: date), for de-duplicating a push. */
  naturalKey?: (row: Local) => string,
): Promise<void> {
  // Tables with a natural key (care, reflections) PULL first: a row for the same day from
  // another device may have a different id, so twins are resolved (or combined) here before
  // anything is uploaded — otherwise an older upload could replace a newer row for that day.
  if (naturalKey) {
    await pull();
    await push();
  } else {
    await push();
    await pull();
  }

  async function push() {
  // PUSH: local rows changed since the last sync (or everything, on
  // a first sync) go up, so local-only data always reaches the account.
  const allLocal = await dexieTable.toArray();
  let toPush = pushSinceIso ? allLocal.filter((row) => isLater(row.updatedAt, pushSinceIso)) : allLocal;
  if (naturalKey) {
    // One row per natural key per upload (an upsert can't touch the same row twice).
    const newest = new Map<string, Local>();
    for (const row of toPush) {
      const key = naturalKey(row);
      const had = newest.get(key);
      if (!had || isLater(row.updatedAt, had.updatedAt)) newest.set(key, row);
    }
    toPush = [...newest.values()];
  }
  if (toPush.length > 0) {
    // Never overwrite a NEWER version already in the account (an older offline edit, or a
    // restored backup, would otherwise replace newer data or bring deleted rows back).
    const stamps = await fetchRemoteStamps(table, userId, toPush.map((row) => row.id));
    toPush = toPush.filter((row) => {
      const remoteStamp = stamps.get(row.id);
      return !remoteStamp || !isLater(remoteStamp, row.updatedAt);
    });
  }
  if (toPush.length > 0) {
    await pushRows(table, toPush.map((row) => toRemote(row, userId, deviceId)));
  }
  }

  async function pull() {
  // PULL: only ever creates missing rows or applies strictly-newer ones.
  const remoteRows = await pullRowsSince<Remote>(table, userId, pullSinceFor(cursors, table));

  if (findLocalTwin) {
    // Small tables with a natural key (care, reflections): row by row, to resolve twins.
    for (const remote of remoteRows) {
      const local = await dexieTable.get(remote.id);
      if (!local) {
        if (remote.deleted_at) continue;
        const twin = await findLocalTwin(remote);
        if (twin && mergeTwin) {
          // Keep both devices' writing: combine into the remote id, and push the result back.
          await dexieTable.delete(twin.id);
          await dexieTable.put({ ...mergeTwin(fromRemote(remote), twin), id: remote.id, updatedAt: nowIso() });
          continue;
        }
        if (twin && twinTombstoneTable) {
          // Two records for the same thing (e.g. "Bath" on the same day, ticked on two
          // devices). Keep whichever was changed last.
          if (isLater(remote.updated_at, twin.updatedAt)) {
            await dexieTable.delete(twin.id);
            await recordTombstone(twinTombstoneTable, twin.id);
            await dexieTable.put(fromRemote(remote));
          } else {
            await recordTombstone(twinTombstoneTable, remote.id);
          }
          continue;
        }
        await dexieTable.put(fromRemote(remote));
        continue;
      }
      if (isLater(remote.updated_at, local.updatedAt)) {
        if (remote.deleted_at && !localHasSoftDelete) await dexieTable.delete(remote.id);
        else await dexieTable.put(fromRemote(remote));
      }
    }
  } else if (remoteRows.length > 0) {
    // Everything else: decide in memory and write in a few big batches — thousands of
    // rows (e.g. a first sync of a big library) apply in a moment instead of one by one.
    const locals = await dexieTable.bulkGet(remoteRows.map((r) => r.id));
    const puts: Local[] = [];
    const deletes: string[] = [];
    remoteRows.forEach((remote, i) => {
      const local = locals[i];
      if (!local) {
        if (!remote.deleted_at) puts.push(fromRemote(remote));
      } else if (isLater(remote.updated_at, local.updatedAt)) {
        if (remote.deleted_at && !localHasSoftDelete) deletes.push(remote.id);
        else puts.push(fromRemote(remote));
      }
    });
    for (let i = 0; i < puts.length; i += APPLY_CHUNK) await dexieTable.bulkPut(puts.slice(i, i + APPLY_CHUNK));
    if (deletes.length) await dexieTable.bulkDelete(deletes);
  }
  advanceCursor(cursors, table, remoteRows);
  }
}

const APPLY_CHUNK = 500;

/** Combines two versions of the same day's reflection: each field from whichever has it, newer winning when both do. */
export function mergeReflections(remote: DailyReflection, twin: DailyReflection): DailyReflection {
  const [newer, older] = isLater(twin.updatedAt, remote.updatedAt) ? [twin, remote] : [remote, twin];
  const pick = <K extends keyof DailyReflection>(k: K) => (newer[k] !== undefined && newer[k] !== '' ? newer[k] : older[k]);
  return {
    ...older,
    ...newer,
    gratitude: pick('gratitude'),
    smallWin: pick('smallWin'),
    eveningGoodThing: pick('eveningGoodThing'),
    eveningLeaveForTomorrow: pick('eveningLeaveForTomorrow'),
    eveningMood: pick('eveningMood'),
    eveningDone: !!(remote.eveningDone || twin.eveningDone),
  };
}

/**
 * Settings is a special case: exactly one row per user, and the
 * local singleton id ('app-settings') differs from the remote row's
 * id (the user's own id, by convention — see mapping.ts). Also,
 * deviceId/lastSyncedAt/syncCursors are local-only bookkeeping fields
 * that never exist on the remote row, so they must be preserved
 * across a pull.
 */
async function syncSettings(
  userId: string,
  deviceId: string | null,
  pushSinceIso: string | undefined,
  cursors: Cursors,
): Promise<void> {
  const local = await getSettings();
  const untouchedDefaults = Date.parse(local.updatedAt) <= 0; // a fresh install's defaults (see settingsRepository)
  if (!untouchedDefaults && (!pushSinceIso || isLater(local.updatedAt, pushSinceIso))) {
    const remoteStamp = (await fetchRemoteStamps('settings', userId, [userId])).get(userId);
    if (!remoteStamp || !isLater(remoteStamp, local.updatedAt)) {
      await pushRow('settings', mapping.settingsToRemote(local, userId, deviceId));
    }
  }

  const remoteRows = await pullRowsSince<RemoteSettings>('settings', userId, pullSinceFor(cursors, 'settings'));
  advanceCursor(cursors, 'settings', remoteRows);
  const remote = remoteRows.find((row) => row.id === userId) ?? remoteRows[0];
  if (!remote) return;

  const currentLocal = await getSettings();
  if (isLater(remote.updated_at, currentLocal.updatedAt)) {
    const merged = mapping.settingsFromRemote(remote);
    await db.settings.put({
      ...merged,
      deviceId: currentLocal.deviceId,
      lastSyncedAt: currentLocal.lastSyncedAt,
      syncCursors: currentLocal.syncCursors,
      // Reminders fire per device — keep this device's own "shown today" notes.
      lastNightReminderFiredDate: currentLocal.lastNightReminderFiredDate,
      lastMorningReminderFiredDate: currentLocal.lastMorningReminderFiredDate,
    });
  }
}

/**
 * Images: local blobs are uploaded once (tracked via
 * remoteUploadedAt, so re-running sync never re-uploads the same
 * image) and remote images not yet present locally are downloaded.
 * A remote image marked deleted is removed locally too. A
 * book/movie/series cover or artwork/experience photo referencing an
 * image id keeps displaying locally the whole time regardless of
 * where that image is in its sync — see useLifeImageUrl, which simply
 * shows nothing until the blob exists locally.
 */
async function syncLifeImages(userId: string, deviceId: string | null, cursors: Cursors): Promise<void> {
  const allLocalImages = await db.lifeImages.toArray();
  for (const image of allLocalImages) {
    if (image.remoteUploadedAt) continue;
    const storagePath = await uploadImageBlob(userId, image.id, image.blob);
    const timestamp = nowIso();
    await pushRow('life_images', {
      id: image.id,
      user_id: userId,
      storage_path: storagePath,
      mime_type: image.blob.type || 'application/octet-stream',
      created_at: image.createdAt,
      updated_at: image.createdAt,
      deleted_at: null,
      device_id: deviceId,
    });
    await db.lifeImages.put({ ...image, remoteUploadedAt: timestamp });
  }

  const remoteImages = await pullRowsSince<RemoteLifeImage>('life_images', userId, pullSinceFor(cursors, 'life_images'));
  for (const remote of remoteImages) {
    const existing = await db.lifeImages.get(remote.id);
    if (remote.deleted_at) {
      // Deleted on another device — drop this device's copy too.
      if (existing) await db.lifeImages.delete(remote.id);
      continue;
    }
    if (existing) continue;
    try {
      const blob = await downloadImageBlob(remote.storage_path);
      await db.lifeImages.put({ id: remote.id, blob, createdAt: remote.created_at, remoteUploadedAt: remote.synced_at });
    } catch {
      // A single image failing to download shouldn't break the rest
      // of sync — the referencing LIFE item still syncs fine; the
      // photo just won't show on this device until a later retry.
      // (That retry needs a full re-read, so don't let the cursor
      // move past this image.)
      return;
    }
  }
  advanceCursor(cursors, 'life_images', remoteImages);
}

/**
 * Turns a raw Supabase/network error into a calm, plain sentence for
 * the Me page. Whatever happened, local data is always safe — every
 * change is saved on the device first and simply waits for the next
 * successful sync.
 */
export function friendlySyncError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
  const text = raw.toLowerCase();
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';

  if (text.includes('failed to fetch') || text.includes('network') || text.includes('load failed')) {
    return "Couldn't reach the cloud. Free Supabase projects pause after a week without use — if this keeps happening, resume the project in the Supabase dashboard. Your data is safe on this device and will sync once it's reachable.";
  }
  if (text.includes('jwt') || text.includes('token') || code === 'PGRST301' || code === '401') {
    return 'Your sign-in has expired. Sign out and back in to keep syncing — nothing on this device is lost.';
  }
  if (code === '42501' || text.includes('permission denied') || text.includes('row-level security')) {
    return "The cloud didn't allow this change (a permissions setting in Supabase). Your data is safe on this device.";
  }
  if (text.includes('bucket') || text.includes('storage')) {
    return "A photo couldn't sync this time. Everything else is fine; it'll try again on the next sync.";
  }
  return "Sync didn't finish this time. Your data is safe on this device, and it'll try again shortly.";
}

let syncInFlight = false;

/**
 * Runs one full push-then-pull cycle across every synced table plus
 * images. Safe to call as often as you like — no-ops cleanly if
 * Supabase isn't configured, nobody's signed in, the device is
 * offline, or a sync is already running.
 */
export async function runSync(): Promise<void> {
  if (!isSupabaseConfigured) {
    setStatus({ status: 'not_configured' });
    return;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    setStatus({ status: 'signed_out' });
    return;
  }

  if (!isOnline()) {
    setStatus({ status: 'offline' });
    return;
  }

  if (syncInFlight) return;
  syncInFlight = true;
  setStatus({ status: 'syncing' });

  try {
    // Captured BEFORE anything is pushed — see "Two clocks" above.
    const startedAt = nowIso();
    const deviceId = await ensureDeviceId();
    const settingsBefore = await getSettings();
    const pushSinceIso = settingsBefore.lastSyncedAt;
    // Working copy; only saved if the whole cycle succeeds.
    const cursors: Cursors = { ...(settingsBefore.syncCursors ?? {}) };

    await pushTombstones(userId);

    await syncTable<CareEntry, RemoteCareEntry>(
      'care_entries',
      db.careEntries,
      mapping.careEntryToRemote,
      mapping.careEntryFromRemote,
      userId,
      deviceId,
      pushSinceIso,
      cursors,
      false,
      (remote) => db.careEntries.where('[date+itemKey]').equals([remote.date, remote.item_key]).first(),
      'care_entries',
      undefined,
      (row) => `${row.date}|${row.itemKey}`,
    );
    await syncTable<DailyReflection, RemoteDailyReflection>(
      'daily_reflections',
      db.dailyReflections,
      mapping.dailyReflectionToRemote,
      mapping.dailyReflectionFromRemote,
      userId,
      deviceId,
      pushSinceIso,
      cursors,
      false,
      (remote) => db.dailyReflections.where('date').equals(remote.date).first(),
      undefined,
      mergeReflections,
      (row) => row.date,
    );
    await syncTable<JournalEntry, RemoteJournalEntry>(
      'journal_entries',
      db.journalEntries,
      mapping.journalEntryToRemote,
      mapping.journalEntryFromRemote,
      userId,
      deviceId,
      pushSinceIso,
      cursors,
      true,
    );
    await syncTable<Person, RemotePerson>(
      'people',
      db.people,
      mapping.personToRemote,
      mapping.personFromRemote,
      userId,
      deviceId,
      pushSinceIso,
      cursors,
      true,
    );
    await syncTable<PeriodEntry, RemotePeriodEntry>(
      'period_entries',
      db.periodEntries,
      mapping.periodEntryToRemote,
      mapping.periodEntryFromRemote,
      userId,
      deviceId,
      pushSinceIso,
      cursors,
      true,
    );
    // LIFE — books, movies, series (seasons/episodes travel inside
    // each series' own payload, not as separate rows — see
    // mapping.ts), artwork, experiences, and wishlist entries are
    // ALL LifeItem rows, so this one call covers every LIFE category.
    await syncTable<LifeItem, RemoteLifeItem>(
      'life_items',
      db.lifeItems,
      mapping.lifeItemToRemote,
      mapping.lifeItemFromRemote,
      userId,
      deviceId,
      pushSinceIso,
      cursors,
      true,
    );

    await syncSettings(userId, deviceId, pushSinceIso, cursors);
    await syncLifeImages(userId, deviceId, cursors);

    await saveSyncBookkeeping({ lastSyncedAt: startedAt, syncCursors: cursors });
    setStatus({ status: 'synced', lastSyncedAt: nowIso(), errorMessage: undefined });
  } catch (err) {
    setStatus({ status: 'error', errorMessage: friendlySyncError(err) });
  } finally {
    syncInFlight = false;
  }
}
