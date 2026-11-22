import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import { recordToolEvent, getToolEvents, clearToolEvents, migrateLocalToolEvents } from '@/db/repositories/toolEventRepository';
import { lifeItemToRemote } from '@/lib/sync/mapping';
import type { LifeItem } from '@/db/schema';

describe('"I\'m bored" / "I\'m scrolling" taps', () => {
  beforeEach(async () => {
    await db.lifeItems.clear();
    await db.toolEvents.clear();
  });

  it('are stored in the synced table, so every device sees them', async () => {
    await recordToolEvent('bored');
    const [row] = await db.lifeItems.toArray();
    expect(row).toMatchObject({ type: 'toolEvent', tool: 'bored', title: 'bored' });
    const remote = lifeItemToRemote(row as LifeItem, 'user', null);
    expect(remote).toMatchObject({ type: 'toolEvent', title: 'bored', deleted_at: null });
  });

  it('clearing them marks each one deleted, so the clear reaches other devices too', async () => {
    await recordToolEvent('bored');
    await recordToolEvent('scrolling');
    expect(await clearToolEvents()).toBe(2);
    expect(await getToolEvents()).toEqual([]);
    const rows = await db.lifeItems.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !!r.deletedAt)).toBe(true);
  });

  it('moves taps saved by older versions into the synced table, once', async () => {
    await db.toolEvents.bulkAdd([
      { id: '00000000-0000-4000-8000-000000000001', tool: 'bored', at: '2026-11-20T10:00:00Z' },
      { id: '00000000-0000-4000-8000-000000000002', tool: 'scrolling', at: '2026-11-21T10:00:00Z' },
    ]);
    await migrateLocalToolEvents();
    await migrateLocalToolEvents();
    expect((await getToolEvents()).map((e) => e.tool).sort()).toEqual(['bored', 'scrolling']);
    expect(await db.toolEvents.count()).toBe(0);
  });
});
