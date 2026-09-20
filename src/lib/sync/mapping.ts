import type {
  CareEntry,
  DailyReflection,
  JournalEntry,
  LifeItem,
  Person,
  PeriodEntry,
  AppSettings,
} from '@/db/schema';
import type {
  RemoteCareEntry,
  RemoteDailyReflection,
  RemoteJournalEntry,
  RemoteLifeItem,
  RemotePerson,
  RemotePeriodEntry,
  RemoteSettings,
} from './types';

/**
 * Every `toRemote*` function takes the local entity plus the two bits
 * of context only the sync layer knows (whose account this belongs
 * to, and which device is writing) and returns a row ready to upsert.
 * `synced_at` is deliberately omitted — that column is server-assigned
 * (see the migration's default), not client-controlled.
 *
 * Every `fromRemote*` function is the inverse, used when pulling rows
 * down and writing them into Dexie.
 */

export function careEntryToRemote(entry: CareEntry, userId: string, deviceId: string | null): Omit<RemoteCareEntry, 'synced_at'> {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    item_key: entry.itemKey,
    status: entry.status,
    skip_reason: entry.skipReason ?? null,
    value_minutes: entry.valueMinutes ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    deleted_at: null,
    device_id: deviceId,
  };
}

export function careEntryFromRemote(row: RemoteCareEntry): CareEntry {
  return {
    id: row.id,
    date: row.date,
    itemKey: row.item_key as CareEntry['itemKey'],
    status: row.status as CareEntry['status'],
    skipReason: row.skip_reason ?? undefined,
    valueMinutes: row.value_minutes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function dailyReflectionToRemote(
  entry: DailyReflection,
  userId: string,
  deviceId: string | null,
): Omit<RemoteDailyReflection, 'synced_at'> {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    gratitude: entry.gratitude ?? null,
    small_win: entry.smallWin ?? null,
    evening_good_thing: entry.eveningGoodThing ?? null,
    evening_leave_for_tomorrow: entry.eveningLeaveForTomorrow ?? null,
    evening_mood: entry.eveningMood ?? null,
    evening_done: entry.eveningDone ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    deleted_at: null,
    device_id: deviceId,
  };
}

export function dailyReflectionFromRemote(row: RemoteDailyReflection): DailyReflection {
  return {
    id: row.id,
    date: row.date,
    gratitude: row.gratitude ?? undefined,
    smallWin: row.small_win ?? undefined,
    eveningGoodThing: row.evening_good_thing ?? undefined,
    eveningLeaveForTomorrow: row.evening_leave_for_tomorrow ?? undefined,
    eveningMood: row.evening_mood ?? undefined,
    eveningDone: row.evening_done ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function journalEntryToRemote(
  entry: JournalEntry,
  userId: string,
  deviceId: string | null,
): Omit<RemoteJournalEntry, 'synced_at'> {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    title: entry.title ?? null,
    body: entry.body,
    mood: entry.mood ?? null,
    tags: entry.tags ?? null,
    source_tool: entry.sourceTool ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    deleted_at: entry.deletedAt ?? null,
    device_id: deviceId,
  };
}

export function journalEntryFromRemote(row: RemoteJournalEntry): JournalEntry {
  return {
    id: row.id,
    date: row.date,
    title: row.title ?? undefined,
    body: row.body,
    mood: row.mood ?? undefined,
    tags: row.tags ?? undefined,
    sourceTool: (row.source_tool as JournalEntry['sourceTool']) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * LIFE items: id/type/title/favorite/notes/createdAt/updatedAt/deletedAt
 * become their own columns; every other field (author, year, seasons,
 * imageIds, status, ...) is preserved as-is in `payload`.
 */
export function lifeItemToRemote(item: LifeItem, userId: string, deviceId: string | null): Omit<RemoteLifeItem, 'synced_at'> {
  const { id, type, title, favorite, notes, createdAt, updatedAt, deletedAt, ...rest } = item;
  return {
    id,
    user_id: userId,
    type,
    title,
    favorite: favorite ?? null,
    notes: notes ?? null,
    payload: rest as Record<string, unknown>,
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: deletedAt ?? null,
    device_id: deviceId,
  };
}

export function lifeItemFromRemote(row: RemoteLifeItem): LifeItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    favorite: row.favorite ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    ...row.payload,
  } as LifeItem;
}

export function personToRemote(person: Person, userId: string, deviceId: string | null): Omit<RemotePerson, 'synced_at'> {
  return {
    id: person.id,
    user_id: userId,
    name: person.name,
    relationship: person.relationship ?? null,
    desired_cadence_days: person.desiredCadenceDays ?? null,
    last_contacted_at: person.lastContactedAt ?? null,
    notes: person.notes ?? null,
    created_at: person.createdAt,
    updated_at: person.updatedAt,
    deleted_at: person.deletedAt ?? null,
    device_id: deviceId,
  };
}

export function personFromRemote(row: RemotePerson): Person {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship ?? undefined,
    desiredCadenceDays: row.desired_cadence_days ?? undefined,
    lastContactedAt: row.last_contacted_at ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function periodEntryToRemote(
  entry: PeriodEntry,
  userId: string,
  deviceId: string | null,
): Omit<RemotePeriodEntry, 'synced_at'> {
  return {
    id: entry.id,
    user_id: userId,
    start_date: entry.startDate,
    end_date: entry.endDate ?? null,
    flow: entry.flow ?? null,
    notes: entry.notes ?? null,
    source: entry.source,
    import_source_label: entry.importSourceLabel ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    deleted_at: entry.deletedAt ?? null,
    device_id: deviceId,
  };
}

export function periodEntryFromRemote(row: RemotePeriodEntry): PeriodEntry {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    flow: (row.flow as PeriodEntry['flow']) ?? undefined,
    notes: row.notes ?? undefined,
    source: row.source as PeriodEntry['source'],
    importSourceLabel: row.import_source_label ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Locally there's exactly one settings row, with the fixed id
 * "app-settings" (see settingsRepository.ts). Remotely, every user
 * needs their own settings row, so by convention the remote row's id
 * IS the user's id — there's still exactly one row per user.
 */
export function settingsToRemote(settings: AppSettings, userId: string, deviceId: string | null): Omit<RemoteSettings, 'synced_at'> {
  return {
    id: userId,
    user_id: userId,
    sound_enabled: settings.soundEnabled,
    theme: settings.theme,
    night_reminder_enabled: settings.nightReminderEnabled ?? null,
    night_reminder_time: settings.nightReminderTime ?? null,
    morning_reminder_enabled: settings.morningReminderEnabled ?? null,
    morning_reminder_time: settings.morningReminderTime ?? null,
    last_night_reminder_fired_date: settings.lastNightReminderFiredDate ?? null,
    last_morning_reminder_fired_date: settings.lastMorningReminderFiredDate ?? null,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt,
    deleted_at: null,
    device_id: deviceId,
  };
}

export function settingsFromRemote(row: RemoteSettings): AppSettings {
  return {
    id: 'app-settings',
    soundEnabled: row.sound_enabled,
    theme: row.theme as AppSettings['theme'],
    nightReminderEnabled: row.night_reminder_enabled ?? undefined,
    nightReminderTime: row.night_reminder_time ?? undefined,
    morningReminderEnabled: row.morning_reminder_enabled ?? undefined,
    morningReminderTime: row.morning_reminder_time ?? undefined,
    lastNightReminderFiredDate: row.last_night_reminder_fired_date ?? undefined,
    lastMorningReminderFiredDate: row.last_morning_reminder_fired_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
