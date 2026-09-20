import { parseCsv } from '@/shared/utils/csv';
import type { NewPeriodEntryInput } from '@/db/repositories/periodRepository';

/**
 * A deliberately generic CSV importer for period/cycle history — NOT
 * locked to any one app. There's no official public export API for
 * Flo (or most period-tracking apps), so this never talks to any
 * service; it only reads a CSV file the person already exported
 * themselves from whichever app they used, then maps its columns.
 *
 * It tries a list of common column-name variants so it has a
 * reasonable chance of reading Flo's export, another app's export, or
 * a hand-made spreadsheet — whichever the person brings.
 */

const START_COLUMN_CANDIDATES = ['start date', 'period start', 'cycle start', 'date', 'start'];
const END_COLUMN_CANDIDATES = ['end date', 'period end', 'cycle end', 'end'];

export interface ParsedPeriodRow {
  startDate: string;
  endDate?: string;
}

function normalizeDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Accept YYYY-MM-DD directly; otherwise try to parse and reformat.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseCycleCsv(csvText: string): ParsedPeriodRow[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (candidates: string[]) => {
    for (const candidate of candidates) {
      const idx = header.indexOf(candidate);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const startIdx = findCol(START_COLUMN_CANDIDATES);
  const endIdx = findCol(END_COLUMN_CANDIDATES);

  if (startIdx === -1) {
    throw new Error("Couldn't find a start-date column in this file. Expected a header like 'Start Date' or 'Date'.");
  }

  return rows
    .slice(1)
    .map((cells): ParsedPeriodRow | null => {
      const startDate = normalizeDate(cells[startIdx] ?? '');
      if (!startDate) return null;
      const endDate = endIdx !== -1 ? normalizeDate(cells[endIdx] ?? '') : undefined;
      return endDate ? { startDate, endDate } : { startDate };
    })
    .filter((row): row is ParsedPeriodRow => row !== null);
}

export function rowsToPeriodInputs(rows: ParsedPeriodRow[]): Omit<NewPeriodEntryInput, 'source'>[] {
  return rows.map((row) => ({ startDate: row.startDate, endDate: row.endDate }));
}
