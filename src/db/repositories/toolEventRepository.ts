import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { ToolEvent } from '../schema';

/** Notes a tap on "I'm bored" / "I'm scrolling" — on this device only, for the advisor. */
export async function recordToolEvent(tool: ToolEvent['tool']): Promise<void> {
  await db.toolEvents.add({ id: generateId(), tool, at: nowIso() });
}

export async function getToolEvents(): Promise<ToolEvent[]> {
  return db.toolEvents.toArray();
}
