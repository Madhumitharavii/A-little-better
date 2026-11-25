import type { Table } from 'dexie';
import { db } from '../db';
import { generateId, nowIso } from '../id';
import { getLocalDateKey } from '../dateUtils';
import type { LetterItem } from '../schema';

/** Letters to your future self — rows of the synced lifeItems table (type "letter"). */
const table = () => db.lifeItems as unknown as Table<LetterItem, string>;

export async function sealLetter(body: string, openOn: string): Promise<void> {
  const now = nowIso();
  await table().add({ id: generateId(), type: 'letter', title: 'Letter to future me', body, writtenOn: getLocalDateKey(), openOn, createdAt: now, updatedAt: now });
}

async function patch(id: string, change: Partial<LetterItem>): Promise<void> {
  const row = await table().get(id);
  if (row) await table().put({ ...row, ...change, updatedAt: nowIso() });
}

export const markLetterRead = (id: string) => patch(id, { readAt: nowIso() });
export const markLetterAnnounced = (id: string) => patch(id, { announcedAt: nowIso() });
/** Throws it away (on every device), without opening it. */
export const discardLetter = (id: string) => patch(id, { deletedAt: nowIso(), body: '' });
