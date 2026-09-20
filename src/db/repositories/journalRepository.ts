import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { JournalEntry, SourceTool } from '../schema';

/** All non-deleted journal entries, most recent first. */
export async function getJournalEntries(): Promise<JournalEntry[]> {
  const all = await db.journalEntries.orderBy('date').reverse().toArray();
  return all.filter((entry) => !entry.deletedAt);
}

export async function getJournalEntry(id: string): Promise<JournalEntry | undefined> {
  return db.journalEntries.get(id);
}

interface NewJournalEntryInput {
  date: string;
  title?: string;
  body: string;
  mood?: string;
  tags?: string[];
  sourceTool?: SourceTool;
}

export async function saveJournalEntry(input: NewJournalEntryInput): Promise<JournalEntry> {
  const timestamp = nowIso();
  const entry: JournalEntry = {
    id: generateId(),
    date: input.date,
    title: input.title,
    body: input.body,
    mood: input.mood,
    tags: input.tags,
    sourceTool: input.sourceTool ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.journalEntries.add(entry);
  return entry;
}

type JournalPatch = Partial<
  Pick<JournalEntry, 'title' | 'body' | 'mood' | 'tags' | 'date'>
>;

export async function updateJournalEntry(
  id: string,
  patch: JournalPatch,
): Promise<JournalEntry | undefined> {
  const existing = await db.journalEntries.get(id);
  if (!existing) return undefined;
  const updated: JournalEntry = { ...existing, ...patch, updatedAt: nowIso() };
  await db.journalEntries.put(updated);
  return updated;
}

/** Soft delete — keeps the row (with deletedAt set) so Stage 2 sync can propagate it. */
export async function deleteJournalEntry(id: string): Promise<void> {
  const existing = await db.journalEntries.get(id);
  if (!existing) return;
  await db.journalEntries.put({ ...existing, deletedAt: nowIso(), updatedAt: nowIso() });
}
