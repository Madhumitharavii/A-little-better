import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { SyncTableName } from './types';

/**
 * NOTHING IN THE APP CALLS THIS FILE YET.
 *
 * This is the safe backend foundation for a future two-way sync
 * feature: generic push/pull helpers against Supabase, plus image
 * blob upload/download against Supabase Storage. The actual sync
 * process — deciding what to push, resolving conflicts between two
 * devices, merging instead of overwriting, and the UI to turn it on —
 * is intentionally NOT built in this pass. Building that on top of
 * these primitives, without ever blindly overwriting either device's
 * data, is the next step.
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
 * Upserts a single row (insert-or-update, matched by its `id`) into
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
  const { error } = await (client.from(table) as any).upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

/** Upserts many rows in one call — more efficient than pushRow in a loop for bulk operations. */
export async function pushRows<T extends Record<string, unknown>>(table: SyncTableName, rows: T[]): Promise<void> {
  if (rows.length === 0) return;
  const client = requireSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from(table) as any).upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

/**
 * Pulls every row for the current user changed since `sinceIso`
 * (compared against the server-assigned `synced_at`, not the
 * client's `updated_at` — this avoids missing rows due to clock
 * skew between devices). Pass `undefined` for a full pull.
 */
export async function pullRowsSince<T>(table: SyncTableName, userId: string, sinceIso?: string): Promise<T[]> {
  const client = requireSupabase();
  let query = client.from(table).select('*').eq('user_id', userId);
  if (sinceIso) {
    query = query.gt('synced_at', sinceIso);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
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
