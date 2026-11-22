import type { Table } from 'dexie';
import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { ToolEvent, ToolEventItem } from '../schema';

/**
 * Taps on "I'm bored" / "I'm scrolling", for Noticed for You. Kept as
 * rows of the synced lifeItems table so phone and Mac share them.
 */
const table = () => db.lifeItems as unknown as Table<ToolEventItem, string>;
const isTap = (row: { type?: string; deletedAt?: string | null }): boolean => row.type === 'toolEvent' && !row.deletedAt;

export async function recordToolEvent(tool: ToolEvent['tool']): Promise<void> {
  const at = nowIso();
  await table().add({ id: generateId(), type: 'toolEvent', title: tool, tool, at, createdAt: at, updatedAt: at });
}

export async function getToolEvents(): Promise<ToolEvent[]> {
  return (await table().toArray()).filter(isTap).map(({ id, tool, at }) => ({ id, tool, at }));
}

/** Forgets every tap — on all devices (the deletions sync like any other). */
export async function clearToolEvents(): Promise<number> {
  const taps = (await table().toArray()).filter(isTap);
  const now = nowIso();
  await table().bulkPut(taps.map((t) => ({ ...t, deletedAt: now, updatedAt: now })));
  return taps.length;
}

/** One-time move of taps saved by older versions in the local-only table, so they sync too. */
export async function migrateLocalToolEvents(): Promise<void> {
  const old = await db.toolEvents.toArray();
  if (!old.length) return;
  const existing = new Set((await table().bulkGet(old.map((e) => e.id))).filter(Boolean).map((r) => r!.id));
  const now = nowIso();
  await table().bulkPut(
    old
      .filter((e) => !existing.has(e.id))
      .map((e) => ({ id: e.id, type: 'toolEvent' as const, title: e.tool, tool: e.tool, at: e.at, createdAt: e.at, updatedAt: now })),
  );
  await db.toolEvents.clear();
}
