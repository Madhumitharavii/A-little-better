import { db } from '../db';
import { nowIso } from '../id';
import type { SyncTombstone } from '../schema';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

/**
 * Notes that a row was hard-deleted locally, so the next sync can
 * mark it deleted in Supabase too (see syncEngine.ts pushTombstones).
 *
 * Skipped entirely when Supabase isn't configured: in that case the
 * row never reached the server, and if sync is set up later, the
 * first sync pushes only what still exists locally — so there's
 * nothing a tombstone would need to tell anyone.
 */
export async function recordTombstone(table: SyncTombstone['table'], rowId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await db.syncTombstones.put({ id: `${table}:${rowId}`, table, rowId, deletedAt: nowIso() });
}

export async function listTombstones(): Promise<SyncTombstone[]> {
  return db.syncTombstones.toArray();
}

export async function clearTombstone(id: string): Promise<void> {
  await db.syncTombstones.delete(id);
}
