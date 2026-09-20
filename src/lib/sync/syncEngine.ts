import type { Table } from 'dexie';
import { db } from '@/db/db';
import { nowIso } from '@/db/id';
import { getSettings, saveSettings, ensureDeviceId } from '@/db/repositories/settingsRepository';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getCurrentUserId } from './authService';
import { pushRow, pushRows, pullRowsSince, uploadImageBlob, downloadImageBlob } from './syncService';
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
} from './types';
import type { CareEntry, DailyReflection, JournalEntry, LifeItem, Person, PeriodEntry } from '@/db/schema';

/**
 * THE ACTUAL SYNC ORCHESTRATOR. This is what makes cross-device sync
 * real rather than just available — see App.tsx for where runSync()
 * gets called (startup, foreground, periodic, connectivity-restored)
 * and AccountSection.tsx for the sign-in UI and manual "Sync now".
 *
 * ── Conflict rule (documented briefly, per the spec) ──
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
 * ── First-sync safety ──
 * Every table syncs push-then-pull. On a device's very first sync
 * (no lastSyncedAt yet), "push" means "push everything local" — so
 * existing local-only data reaches Supabase before the pull can run,
 * even if the remote account is currently empty. The pull that
 * follows then only ever ADDS missing rows or applies strictly-newer
 * ones; it never clears anything. An empty remote account can never
 * wipe a device that already has data, and a device with an empty
 * local database correctly receives everything already in the
 * account.
 */

export type SyncStatus = 'not_configured' | 'signed_out' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncedAt?: string;
  errorMessage?: string;
}

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

/** Generic push-then-pull for any table whose local/remote rows both carry id/updatedAt(-ish)/deleted fields in the same shape family. */
async function syncTable<
  Local extends { id: string; updatedAt: string },
  Remote extends { id: string; updated_at: string; deleted_at: string | null },
>(
  table: 'care_entries' | 'daily_reflections' | 'journal_entries' | 'people' | 'period_entries' | 'life_items',
  dexieTable: Table<Local, string>,
  toRemote: (row: Local, userId: string, deviceId: string | null) => Record<string, unknown>,
  fromRemote: (row: Remote) => Local,
  userId: string,
  deviceId: string | null,
  sinceIso: string | undefined,
): Promise<void> {
  // PUSH: local rows changed since the last sync (or everything, on
  // a first sync) go up first, so local-only data always reaches the
  // account before anything could be pulled over it.
  const allLocal = await dexieTable.toArray();
  const toPush = sinceIso ? allLocal.filter((row) => row.updatedAt > sinceIso) : allLocal;
  if (toPush.length > 0) {
    await pushRows(table, toPush.map((row) => toRemote(row, userId, deviceId)));
  }

  // PULL: only ever creates missing rows or applies strictly-newer ones.
  const remoteRows = await pullRowsSince<Remote>(table, userId, sinceIso);
  for (const remote of remoteRows) {
    const local = await dexieTable.get(remote.id);
    if (!local) {
      if (remote.deleted_at) continue;
      await dexieTable.put(fromRemote(remote));
      continue;
    }
    if (remote.updated_at > local.updatedAt) {
      await dexieTable.put(fromRemote(remote));
    }
    // else: local is newer or equal — keep local, do nothing.
  }
}

/**
 * Settings is a special case: exactly one row per user, and the
 * local singleton id ('app-settings') differs from the remote row's
 * id (the user's own id, by convention — see mapping.ts). Also,
 * deviceId/lastSyncedAt are local-only bookkeeping fields that never
 * exist on the remote row, so they must be preserved across a pull.
 */
async function syncSettings(userId: string, deviceId: string | null, sinceIso: string | undefined): Promise<void> {
  const local = await getSettings();
  if (!sinceIso || local.updatedAt > sinceIso) {
    await pushRow('settings', mapping.settingsToRemote(local, userId, deviceId));
  }

  const remoteRows = await pullRowsSince<RemoteSettings>('settings', userId, sinceIso);
  const remote = remoteRows.find((row) => row.id === userId) ?? remoteRows[0];
  if (!remote) return;

  const currentLocal = await getSettings();
  if (remote.updated_at > currentLocal.updatedAt) {
    const merged = mapping.settingsFromRemote(remote);
    await db.settings.put({ ...merged, deviceId: currentLocal.deviceId, lastSyncedAt: currentLocal.lastSyncedAt });
  }
}

/**
 * Images: local blobs are uploaded once (tracked via
 * remoteUploadedAt, so re-running sync never re-uploads the same
 * image) and remote images not yet present locally are downloaded.
 * A book/movie/series cover or artwork/experience photo referencing
 * an image id keeps displaying locally the whole time regardless of
 * where that image is in its sync — see useLifeImageUrl, which
 * simply shows nothing until the blob exists locally.
 *
 * Known limitation: local image deletion is a hard delete (see
 * lifeImageRepository.ts) with no local trace afterward, so a
 * deletion doesn't currently propagate to other devices in this
 * pass — the remote copy and any device that already downloaded it
 * keep it until that's built.
 */
async function syncLifeImages(userId: string, deviceId: string | null, sinceIso: string | undefined): Promise<void> {
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

  const remoteImages = await pullRowsSince<RemoteLifeImage>('life_images', userId, sinceIso);
  for (const remote of remoteImages) {
    if (remote.deleted_at) continue;
    const existing = await db.lifeImages.get(remote.id);
    if (existing) continue;
    try {
      const blob = await downloadImageBlob(remote.storage_path);
      await db.lifeImages.put({ id: remote.id, blob, createdAt: remote.created_at, remoteUploadedAt: remote.synced_at });
    } catch {
      // A single image failing to download shouldn't break the rest
      // of sync — the referencing LIFE item still syncs fine; the
      // photo just won't show on this device until a later retry.
    }
  }
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
    const deviceId = await ensureDeviceId();
    const settingsBefore = await getSettings();
    const sinceIso = settingsBefore.lastSyncedAt;

    await syncTable<CareEntry, RemoteCareEntry>(
      'care_entries',
      db.careEntries,
      mapping.careEntryToRemote,
      mapping.careEntryFromRemote,
      userId,
      deviceId,
      sinceIso,
    );
    await syncTable<DailyReflection, RemoteDailyReflection>(
      'daily_reflections',
      db.dailyReflections,
      mapping.dailyReflectionToRemote,
      mapping.dailyReflectionFromRemote,
      userId,
      deviceId,
      sinceIso,
    );
    await syncTable<JournalEntry, RemoteJournalEntry>(
      'journal_entries',
      db.journalEntries,
      mapping.journalEntryToRemote,
      mapping.journalEntryFromRemote,
      userId,
      deviceId,
      sinceIso,
    );
    await syncTable<Person, RemotePerson>(
      'people',
      db.people,
      mapping.personToRemote,
      mapping.personFromRemote,
      userId,
      deviceId,
      sinceIso,
    );
    await syncTable<PeriodEntry, RemotePeriodEntry>(
      'period_entries',
      db.periodEntries,
      mapping.periodEntryToRemote,
      mapping.periodEntryFromRemote,
      userId,
      deviceId,
      sinceIso,
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
      sinceIso,
    );

    await syncSettings(userId, deviceId, sinceIso);
    await syncLifeImages(userId, deviceId, sinceIso);

    const finishedAt = nowIso();
    await saveSettings({ lastSyncedAt: finishedAt });
    setStatus({ status: 'synced', lastSyncedAt: finishedAt, errorMessage: undefined });
  } catch (err) {
    setStatus({ status: 'error', errorMessage: err instanceof Error ? err.message : 'Sync failed' });
  } finally {
    syncInFlight = false;
  }
}
