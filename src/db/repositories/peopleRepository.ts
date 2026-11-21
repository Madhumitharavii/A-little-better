import { db } from '../db';
import { generateId, nowIso } from '../id';
import { getLocalDateKey } from '../dateUtils';
import type { Person } from '../schema';

/**
 * My People — the people I want to stay connected with. Shown on the
 * Me page (add / edit / remove) and in Today's Relationship Connection
 * tool (tap who I reached out to). Synced like everything else; a
 * removal is a soft delete so it reaches other devices.
 */

/** Everyone not removed, in the order they were added. */
export async function getPeople(): Promise<Person[]> {
  const all = await db.people.toArray();
  return all.filter((p) => !p.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function savePerson(
  input: Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
): Promise<Person> {
  const timestamp = nowIso();
  const person: Person = { ...input, id: generateId(), createdAt: timestamp, updatedAt: timestamp };
  await db.people.add(person);
  return person;
}

type PersonPatch = Partial<Pick<Person, 'name' | 'relationship' | 'notes' | 'lastContactedAt'>>;

export async function updatePerson(id: string, patch: PersonPatch): Promise<void> {
  const existing = await db.people.get(id);
  if (!existing) return;
  await db.people.put({ ...existing, ...patch, updatedAt: nowIso() });
}

/** Records that I connected with this person today (a local date, e.g. "2026-11-21"). */
export async function markContactedToday(id: string): Promise<void> {
  await updatePerson(id, { lastContactedAt: getLocalDateKey() });
}

export async function removePerson(id: string): Promise<void> {
  const existing = await db.people.get(id);
  if (!existing) return;
  const timestamp = nowIso();
  await db.people.put({ ...existing, deletedAt: timestamp, updatedAt: timestamp });
}
