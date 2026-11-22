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

/**
 * Day-first wins for slashed/dotted dates ("05/03/2024" = 5 March), as written in India
 * and most of the world; it's read month-first only when the first number can't be a
 * day-of-month pairing (e.g. "03/25/2024", where 25 can only be the day).
 */
export function parseDayFirst(raw: string): string | undefined {
  const m = raw.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return undefined;
  const [a, b] = [Number(m[1]), Number(m[2])];
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  let day = a;
  let month = b;
  if (b > 12 && a <= 12) [day, month] = [b, a]; // only valid month-first
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1) return undefined; // e.g. 31/02
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Accept YYYY-MM-DD directly; DD/MM/YYYY next; otherwise try to parse and reformat.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dayFirst = parseDayFirst(trimmed);
  if (dayFirst) return dayFirst;
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
