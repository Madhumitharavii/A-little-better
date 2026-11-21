import { db } from '../db';
import { nowIso } from '../id';
import type { AppSettings } from '../schema';

const SETTINGS_ID = 'app-settings' as const;

function buildDefaultSettings(): AppSettings {
  const timestamp = nowIso();
  return {
    id: SETTINGS_ID,
    soundEnabled: false,
    theme: 'system',
    nightReminderEnabled: false,
    nightReminderTime: '22:30',
    morningReminderEnabled: false,
    morningReminderTime: '07:00',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Pure read. Never writes to the database — this is what makes it
 * safe to call from inside a Dexie `liveQuery` querier (used by
 * `useLiveQuery` in App.tsx and SettingsSection.tsx). liveQuery runs
 * its querier inside a readonly transaction, so a write here would
 * throw ReadOnlyError.
 *
 * If no settings row exists yet (first launch, before
 * `ensureDefaultSettings` has run), this returns an in-memory
 * default rather than persisting one — the UI still gets sensible
 * defaults on the very first paint, and the real row appears a
 * moment later once `ensureDefaultSettings` writes it, which
 * liveQuery will automatically pick up as a fresh emission.
 */
export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(SETTINGS_ID);
  return existing ?? buildDefaultSettings();
}

/**
 * Creates the default settings row if (and only if) one doesn't
 * already exist yet. This performs the actual write, so it must be
 * called from a normal write context — e.g. once on app startup —
 * never from inside a liveQuery querier. Safe to call on every
 * launch: it's a no-op once a row exists, so existing settings are
 * never overwritten.
 */
export async function ensureDefaultSettings(): Promise<void> {
  const existing = await db.settings.get(SETTINGS_ID);
  if (existing) return;
  await db.settings.add(buildDefaultSettings());
}

type SettingsPatch = Partial<
  Pick<
    AppSettings,
    | 'soundEnabled'
    | 'theme'
    | 'nightReminderEnabled'
    | 'nightReminderTime'
    | 'morningReminderEnabled'
    | 'morningReminderTime'
    | 'lastNightReminderFiredDate'
    | 'lastMorningReminderFiredDate'
  >
>;

export async function saveSettings(patch: SettingsPatch): Promise<AppSettings> {
  const existing = await getSettings();
  const updated: AppSettings = { ...existing, ...patch, updatedAt: nowIso() };
  await db.settings.put(updated);
  return updated;
}

type SyncBookkeepingPatch = Partial<Pick<AppSettings, 'deviceId' | 'lastSyncedAt' | 'syncCursors'>>;

/**
 * Saves sync's own local bookkeeping WITHOUT touching `updatedAt`.
 * `updatedAt` is what last-write-wins compares when syncing settings
 * between devices, so it must only move when the person actually
 * changes a setting — otherwise every sync would make this device's
 * (possibly stale) settings look "newest" and overwrite a real change
 * made on another device.
 */
export async function saveSyncBookkeeping(patch: SyncBookkeepingPatch): Promise<void> {
  await ensureDefaultSettings();
  await db.settings.update(SETTINGS_ID, patch);
}

/**
 * Returns this device's sync id, generating and persisting one on
 * first call if none exists yet (used by syncEngine to tag rows with
 * the device that wrote them).
 */
export async function ensureDeviceId(): Promise<string> {
  const current = await getSettings();
  if (current.deviceId) return current.deviceId;
  const deviceId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await saveSyncBookkeeping({ deviceId });
  return deviceId;
}
