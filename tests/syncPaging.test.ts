import { describe, it, expect, vi } from 'vitest';

/**
 * Supabase caps a select at 1000 rows by default. A big import
 * (thousands of films) must still reach every device in full, so pulls
 * are paged and pushes are chunked. This fakes the Supabase client to
 * enforce that cap.
 */
const server = vi.hoisted(() => ({ rows: [] as { id: string; user_id: string; synced_at: string }[], upserts: [] as number[] }));

vi.mock('@/lib/supabaseClient', () => {
  const builder = () => {
    let filtered = [...server.rows];
    const q = {
      select: () => q,
      eq: (col: string, v: string) => ((filtered = filtered.filter((r) => (r as Record<string, string>)[col] === v)), q),
      gt: (col: string, v: string) => ((filtered = filtered.filter((r) => (r as Record<string, string>)[col] > v)), q),
      gte: (col: string, v: string) => ((filtered = filtered.filter((r) => (r as Record<string, string>)[col] >= v)), q),
      limit: async (n: number) => ({ data: filtered.slice(0, Math.min(n, 1000)), error: null }),
      // Sort by synced_at then id (the app always orders by both).
      order: () => ((filtered = [...filtered].sort((a, b) => a.synced_at.localeCompare(b.synced_at) || a.id.localeCompare(b.id))), q),
      range: async (from: number, to: number) => ({ data: filtered.slice(from, Math.min(to + 1, from + 1000)), error: null }),
      upsert: async (rows: unknown[]) => (server.upserts.push(rows.length), { error: null }),
    };
    return q;
  };
  return { isSupabaseConfigured: true, supabase: { from: () => builder() } };
});

import { pullRowsSince, pushRows } from '@/lib/sync/syncService';

describe('sync paging', () => {
  it('pulls every row, not just the first 1000', async () => {
    server.rows = Array.from({ length: 2345 }, (_, i) => ({ id: `r${String(i).padStart(5, '0')}`, user_id: 'u1', synced_at: `2026-11-21T10:${String(i % 60).padStart(2, '0')}:00Z` }));
    const rows = await pullRowsSince<{ id: string }>('life_items', 'u1');
    expect(rows).toHaveLength(2345);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2345);
  });

  it('still gets every row when more than a page share one timestamp (one big import)', async () => {
    server.rows = Array.from({ length: 2500 }, (_, i) => ({ id: `b${String(i).padStart(5, '0')}`, user_id: 'u1', synced_at: '2026-11-21T10:00:00Z' }));
    const rows = await pullRowsSince<{ id: string }>('life_items', 'u1');
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
  });

  it('pushes big batches in chunks', async () => {
    server.upserts = [];
    await pushRows('life_items', Array.from({ length: 1234 }, (_, i) => ({ id: `x${i}` })));
    expect(server.upserts).toEqual([500, 500, 234]);
  });
});
