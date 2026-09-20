import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { Person } from '../schema';

/**
 * Placeholder repository for the future People section (part of
 * LIFE). The store exists and is included in backups, but there is
 * no UI for it in Stage 1 — the Today "relationship connection" tool
 * currently offers generic message prompts rather than per-contact
 * reminders.
 */

export async function getPeople(): Promise<Person[]> {
  const all = await db.people.toArray();
  return all.filter((p) => !p.deletedAt);
}

export async function savePerson(
  input: Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
): Promise<Person> {
  const timestamp = nowIso();
  const person: Person = { ...input, id: generateId(), createdAt: timestamp, updatedAt: timestamp };
  await db.people.add(person);
  return person;
}
