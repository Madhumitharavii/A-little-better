/**
 * Types describing the shape of rows in the Supabase/Postgres tables
 * defined in supabase/migrations/0001_initial_schema.sql. These are
 * intentionally separate from the local Dexie entity types in
 * src/db/schema.ts — see mapping.ts for the conversion functions
 * between the two. Nothing in the app currently reads or writes
 * these; this is groundwork for a future sync feature.
 */

export type SyncTableName =
  | 'care_entries'
  | 'daily_reflections'
  | 'journal_entries'
  | 'life_items'
  | 'life_images'
  | 'people'
  | 'period_entries'
  | 'settings';

/** Columns present on every synced table. */
export interface RemoteRowBase {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Which device last wrote this row — informational, for a future conflict view. */
  device_id: string | null;
  /** Server-assigned; when this row was last received by Supabase. Used for incremental pulls. */
  synced_at: string;
}

export interface RemoteCareEntry extends RemoteRowBase {
  date: string;
  item_key: string;
  status: string;
  skip_reason: string | null;
  value_minutes: number | null;
}

export interface RemoteDailyReflection extends RemoteRowBase {
  date: string;
  gratitude: string | null;
  small_win: string | null;
  evening_good_thing: string | null;
  evening_leave_for_tomorrow: string | null;
  evening_mood: string | null;
  evening_done: boolean | null;
}

export interface RemoteJournalEntry extends RemoteRowBase {
  date: string;
  title: string | null;
  body: string;
  mood: string | null;
  tags: string[] | null;
  source_tool: string | null;
}

/**
 * LIFE items keep a small set of shared columns (useful for querying
 * without unpacking JSON) plus a `payload` column holding every
 * type-specific field (author, year, seasons, imageIds, ...) as-is.
 * This mirrors the local discriminated-union design and avoids
 * having to add a Postgres migration every time a LIFE category
 * gains a new field — a deliberate tradeoff explained in the summary.
 */
export interface RemoteLifeItem extends RemoteRowBase {
  type: string;
  title: string;
  favorite: boolean | null;
  notes: string | null;
  payload: Record<string, unknown>;
}

export interface RemoteLifeImage extends RemoteRowBase {
  storage_path: string;
  mime_type: string;
}

export interface RemotePerson extends RemoteRowBase {
  name: string;
  relationship: string | null;
  desired_cadence_days: number | null;
  last_contacted_at: string | null;
  notes: string | null;
}

export interface RemotePeriodEntry extends RemoteRowBase {
  start_date: string;
  end_date: string | null;
  flow: string | null;
  notes: string | null;
  source: string;
  import_source_label: string | null;
}

export interface RemoteSettings extends RemoteRowBase {
  sound_enabled: boolean;
  theme: string;
  night_reminder_enabled: boolean | null;
  night_reminder_time: string | null;
  morning_reminder_enabled: boolean | null;
  morning_reminder_time: string | null;
  last_night_reminder_fired_date: string | null;
  last_morning_reminder_fired_date: string | null;
}
