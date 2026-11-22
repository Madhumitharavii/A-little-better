import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { SyncTableName } from './types';

/**
 * Low-level Supabase helpers for two-way sync: generic push/pull of
 * rows, soft deletes, and image blob upload/download against
 * Supabase Storage. These are deliberately "dumb" primitives — the
 * actual sync process (what to push, last-write-wins conflict
 * handling, never blindly overwriting either device's data) lives in
 * `syncEngine.ts`, which is the only caller of this file.
 *
 * Every exported function checks `isSupabaseConfigured` and throws a
 * clear, catchable error if it's not set up, rather than the app
 * crashing or silently doing nothing.
 */

function requireSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Sync is not set up on this device yet — Supabase is not configured.');
  }
  return supabase;
}

/**
 * The columns an upsert matches on. Usually the primary key `id`; `settings` uses its
 * composite key (user_id, id). Care entries and daily reflections have a UNIQUE rule on
 * their natural key in 0001_initial_schema.sql — one per (user, date, item) and per
 * (user, date) — so they're matched on THAT: re-ticking an item (a new local id) or a
 * second device writing the same day then updates the existing row instead of being
 * rejected (which used to stop every later sync).
 */
export function conflictTarget(table: SyncTableName): string {
  if (table === 'settings') return 'user_id,id';
  if (table === 'care_entries') return 'user_id,date,item_key';
  if (table === 'daily_reflections') return 'user_id,date';
  return 'id';
}

/**
 * The server's updated_at for each of these rows (only ones that exist). Used before
 * pushing, so a device never overwrites a NEWER version already in the account (e.g.
 * after editing offline, or restoring an old backup).
 */
export async function fetchRemoteStamps(table: SyncTableName, userId: string, ids: string[]): Promise<Map<string, string>> {
  const client = requireSupabase();
  const stamps = new Map<string, string>();
  for (let i = 0; i < ids.length; i += STAMP_CHUNK) {
    const chunk = ids.slice(i, i + STAMP_CHUNK);
    const { data, error } = await client.from(table).select('id, updated_at').eq('user_id', userId).in('id', chunk);
    if (error) throw error;
    for (const row of (data ?? []) as { id: string; updated_at: string }[]) stamps.set(row.id, row.updated_at);
  }
  return stamps;
}

const STAMP_CHUNK = 150;

/**
 * Upserts a single row (insert-or-update, matched by its primary key) into
 * the given table. The row must already be in the table's remote
 * shape — see mapping.ts for local-entity-to-row conversion.
 */
export async function pushRow<T extends Record<string, unknown>>(table: SyncTableName, row: T): Promise<void> {
  const client = requireSupabase();
  // supabase-js's upsert() is typed against a Database-generated Row
  // shape via postgrest-js's RejectExcessProperties<Row, T> helper,
  // which can't be evaluated against our *generic* T at this call
  // site (only a concrete object shape) — so TS rejects it no matter
  // what T's actual shape is. Casting the call itself to `any` here
  // sidesteps that entirely; it only affects this one library call,
  // not pushRow's own signature or the type-checking every caller of
  // pushRow still gets.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from(table) as any).upsert(row, { onConflict: conflictTarget(table) });
  if (error) throw error;
}

/** Upserts many rows in one call — more efficient than pushRow in a loop for bulk operations. */
export async function pushRows<T extends Record<string, unknown>>(table: SyncTableName, rows: T[]): Promise<void> {
  if (rows.length === 0) return;
  const client = requireSupabase();
  // In chunks, so a big import (thousands of films) doesn't become one huge request.
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from(table) as any).upsert(rows.slice(i, i + PUSH_CHUNK), { onConflict: conflictTarget(table) });
    if (error) throw error;
  }
}

const PUSH_CHUNK = 500;
/** Supabase returns at most 1000 rows per request by default — larger pulls are paged. */
export const PULL_PAGE = 1000;

/**
 * Pulls every row for the current user changed since `sinceIso`
 * (compared against the server-assigned `synced_at`, not the
 * client's `updated_at` — this avoids missing rows due to clock
 * skew between devices). Pass `undefined` for a full pull.
 */
export async function pullRowsSince<T>(table: SyncTableName, userId: string, sinceIso?: string): Promise<T[]> {
  const client = requireSupabase();
  // Keyset paging on synced_at: each page starts from the last timestamp seen (not a row
  // offset), so a row another device updates mid-pull just moves to a later page instead
  // of shifting the others and making one get skipped.
  type Row = { id: string; synced_at: string };
  const all: T[] = [];
  const seen = new Set<string>();
  let since = sinceIso;
  let inclusive = false;
  for (let guard = 0; guard < 10_000; guard++) {
    let query = client.from(table).select('*').eq('user_id', userId);
    if (since) query = inclusive ? query.gte('synced_at', since) : query.gt('synced_at', since);
    const { data, error } = await query.order('synced_at', { ascending: true }).order('id', { ascending: true }).limit(PULL_PAGE);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    for (const row of rows) if (!seen.has(row.id)) (seen.add(row.id), all.push(row as unknown as T));
    if (rows.length < PULL_PAGE) break;
    const last = rows[rows.length - 1].synced_at;
    if (rows.every((r) => r.synced_at === last)) {
      // A full page sharing one timestamp: read the rest of that timestamp by offset, then move past it.
      for (let from = PULL_PAGE; ; from += PULL_PAGE) {
        const { data: more, error: err } = await client.from(table).select('*').eq('user_id', userId).eq('synced_at', last).order('id', { ascending: true }).range(from, from + PULL_PAGE - 1);
        if (err) throw err;
        for (const row of (more ?? []) as Row[]) if (!seen.has(row.id)) (seen.add(row.id), all.push(row as unknown as T));
        if (!more || more.length < PULL_PAGE) break;
      }
      since = last;
      inclusive = false;
    } else {
      since = last;
      inclusive = true; // rows sharing the last timestamp may continue on the next page (already-seen ones are skipped)
    }
  }
  return all;
}

/**
 * Marks a row deleted remotely (soft delete, matching the local
 * pattern) rather than actually removing the row — so a future pull
 * on another device can learn about the deletion instead of just
 * seeing the row vanish with no explanation.
 */
export async function softDeleteRow(table: SyncTableName, id: string, deletedAtIso: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from(table).update({ deleted_at: deletedAtIso, updated_at: deletedAtIso }).eq('id', id);
  if (error) throw error;
}

const IMAGE_BUCKET = 'life-images';

/** Uploads a local image blob to Storage at `${userId}/${imageId}`, matching the storage RLS policy in the migration. */
export async function uploadImageBlob(userId: string, imageId: string, blob: Blob): Promise<string> {
  const client = requireSupabase();
  const path = `${userId}/${imageId}`;
  const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType: blob.type || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function downloadImageBlob(storagePath: string): Promise<Blob> {
  const client = requireSupabase();
  const { data, error } = await client.storage.from(IMAGE_BUCKET).download(storagePath);
  if (error) throw error;
  return data;
}

export async function deleteImageBlob(storagePath: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.storage.from(IMAGE_BUCKET).remove([storagePath]);
  if (error) throw error;
}
