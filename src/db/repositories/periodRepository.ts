import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { PeriodEntry, PeriodSource } from '../schema';

export async function getPeriodEntries(): Promise<PeriodEntry[]> {
  const all = await db.periodEntries.toArray();
  return all.filter((e) => !e.deletedAt).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export interface NewPeriodEntryInput {
  startDate: string;
  endDate?: string;
  flow?: PeriodEntry['flow'];
  notes?: string;
  source: PeriodSource;
  importSourceLabel?: string;
}

export async function createPeriodEntry(input: NewPeriodEntryInput): Promise<PeriodEntry> {
  const timestamp = nowIso();
  const entry: PeriodEntry = { ...input, id: generateId(), createdAt: timestamp, updatedAt: timestamp };
  await db.periodEntries.add(entry);
  return entry;
}

type PeriodPatch = Partial<Pick<PeriodEntry, 'startDate' | 'endDate' | 'flow' | 'notes'>>;

export async function updatePeriodEntry(id: string, patch: PeriodPatch): Promise<PeriodEntry | undefined> {
  const existing = await db.periodEntries.get(id);
  if (!existing) return undefined;
  const updated: PeriodEntry = { ...existing, ...patch, updatedAt: nowIso() };
  await db.periodEntries.put(updated);
  return updated;
}

export async function deletePeriodEntry(id: string): Promise<void> {
  const existing = await db.periodEntries.get(id);
  if (!existing) return;
  await db.periodEntries.put({ ...existing, deletedAt: nowIso(), updatedAt: nowIso() });
}

/**
 * Bulk-imports parsed cycle history from any source (Flo's export, or
 * any other app's, as long as it's mapped to start/end dates first —
 * see periodImport.ts). Entries whose startDate already exists
 * locally are skipped, so re-running an import is safe.
 */
export async function importPeriodEntries(
  entries: Omit<NewPeriodEntryInput, 'source'>[],
  sourceLabel: string,
): Promise<number> {
  const existing = await getPeriodEntries();
  const existingDates = new Set(existing.map((e) => e.startDate));
  let imported = 0;
  for (const entry of entries) {
    if (existingDates.has(entry.startDate)) continue;
    await createPeriodEntry({ ...entry, source: 'import', importSourceLabel: sourceLabel });
    existingDates.add(entry.startDate);
    imported++;
  }
  return imported;
}
