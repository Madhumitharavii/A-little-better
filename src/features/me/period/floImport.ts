import type { PeriodEntry } from '@/db/schema';
import { getLocalDateKey } from '@/db/dateUtils';
import { parseCycleCsv } from './periodImport';

/**
 * Reads cycle history from Flo's data export (or a CSV from anywhere).
 *
 * Flo has no export button: you ask support (Profile → Help → Contact
 * us) and they email a password-protected ZIP with a JSON file (the
 * password comes in a separate email). Its known shape, confirmed by
 * two open-source importers (Mensinator's FloImport.kt and
 * flo-to-drip's formatjson.js, documented by Bloom):
 *
 *   operationalData.cycles[]                 { period_start_date, period_end_date }  (yyyy-MM-dd)
 *   operationalData.point_events_manual_v2[] { category, subcategory, date }         (logged events)
 *
 * Flow levels and symptoms aren't documented anywhere, so events are
 * counted by "category: subcategory" and shown in the preview — that's
 * what's needed to map more once a real export has been seen. A flow
 * level is applied only when an event clearly says Light/Medium/Heavy.
 * Pure functions; nothing is sent anywhere.
 */

export type Flow = NonNullable<PeriodEntry['flow']>;

export interface ImportedPeriod {
  startDate: string;
  endDate?: string;
  flow?: Flow;
}

export interface ParsedCycleFile {
  format: 'flo' | 'csv';
  periods: ImportedPeriod[];
  /** Fixes made while reading, e.g. "Periods with no end date": 2. */
  adjustments: Record<string, number>;
  /** Flo events found, by "category: subcategory" — shown, not imported. */
  events: Record<string, number>;
}

/** Longest run of days accepted as one period; longer usually means a missing end date. */
export const MAX_PERIOD_DAYS = 15;

const DAY = 86_400_000;
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const keyMs = (key: string) => Date.parse(`${key}T00:00:00Z`);

/** "2024-03-05", "2024-03-05T00:00:00Z", "2024/03/05" or a Unix timestamp → "2024-03-05". */
export function dayKey(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return getLocalDateKey(new Date(value < 1e12 ? value * 1000 : value));
  if (typeof value !== 'string') return undefined;
  const m = value.trim().match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (!m) return undefined;
  const key = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(keyMs(key)) ? undefined : key;
}

const FLOW_WORDS: Record<string, Flow> = { light: 'light', spotting: 'light', medium: 'medium', moderate: 'medium', heavy: 'heavy', veryheavy: 'heavy' };
const FLOW_RANK: Record<Flow, number> = { light: 1, medium: 2, heavy: 3 };
const words = (s: string) => s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();

/** Finds Flo's data object — normally `operationalData`, but accepts `cycles` at the top level too. */
function floData(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const inner = o.operationalData ?? o.operational_data;
  if (inner && typeof inner === 'object') return inner as Record<string, unknown>;
  if (Array.isArray(o.cycles) || Array.isArray(o.point_events_manual_v2)) return o;
  return null;
}

export function parseFloJson(json: unknown, today: string, format: ParsedCycleFile['format'] = 'flo'): ParsedCycleFile {
  const data = floData(json);
  if (!data) throw new Error("This doesn't look like a Flo export (no cycles found). If it came as a ZIP, unzip it first and choose the .json file inside.");
  const adjustments: Record<string, number> = {};
  const note = (what: string) => (adjustments[what] = (adjustments[what] ?? 0) + 1);
  const todayMs = keyMs(today);

  const periods: ImportedPeriod[] = [];
  const cycles = Array.isArray(data.cycles) ? data.cycles : [];
  for (const c of cycles) {
    if (!c || typeof c !== 'object') {
      note("Cycles that couldn't be read");
      continue;
    }
    const cycle = c as Record<string, unknown>;
    const start = dayKey(cycle.period_start_date ?? cycle.periodStartDate ?? cycle.start_date ?? cycle.startDate);
    if (!start) {
      note('Cycles without a start date, skipped');
      continue;
    }
    if (keyMs(start) > todayMs) {
      note('Predicted future periods, skipped');
      continue;
    }
    let end = dayKey(cycle.period_end_date ?? cycle.periodEndDate ?? cycle.end_date ?? cycle.endDate);
    if (end && keyMs(end) < keyMs(start)) {
      note('Periods ending before they start, end date dropped');
      end = undefined;
    }
    if (end && (keyMs(end) - keyMs(start)) / DAY >= MAX_PERIOD_DAYS) {
      note(`Periods longer than ${MAX_PERIOD_DAYS} days, shortened`);
      end = toKey(keyMs(start) + (MAX_PERIOD_DAYS - 1) * DAY);
    }
    if (end && keyMs(end) > todayMs) end = today;
    if (!end) note('Periods with no end date, saved with the start only');
    periods.push(end ? { startDate: start, endDate: end } : { startDate: start });
  }

  // Logged events: counted for the preview; a clear Light/Medium/Heavy sets that period's flow.
  const events: Record<string, number> = {};
  const list = Array.isArray(data.point_events_manual_v2) ? data.point_events_manual_v2 : [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const ev = e as Record<string, unknown>;
    const category = String(ev.category ?? '');
    const sub = String(ev.subcategory ?? '');
    const label = sub ? `${words(category)}: ${words(sub).toLowerCase()}` : words(category) || 'Unknown';
    events[label] = (events[label] ?? 0) + 1;
    const flow = FLOW_WORDS[sub.toLowerCase().replace(/[\s_]/g, '')];
    const date = dayKey(ev.date);
    if (!flow || !date || !/period|menstru|bleed|flow/i.test(category)) continue;
    const p = periods.find((x) => x.startDate <= date && date <= (x.endDate ?? x.startDate));
    if (p && (!p.flow || FLOW_RANK[flow] > FLOW_RANK[p.flow])) p.flow = flow;
  }

  return { format, periods: dedupe(periods), adjustments, events };
}

function dedupe(periods: ImportedPeriod[]): ImportedPeriod[] {
  const byStart = new Map<string, ImportedPeriod>();
  for (const p of periods) {
    const had = byStart.get(p.startDate);
    if (!had || (!had.endDate && p.endDate)) byStart.set(p.startDate, p);
  }
  return [...byStart.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Reads any supported file: Flo's JSON (also if saved as .txt), or a CSV with a start-date column. */
export function parseCycleFile(text: string, today: string): ParsedCycleFile {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch {
      const inner = trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1);
      json = JSON.parse(inner); // throws a clear "Unexpected token" if it really isn't JSON
    }
    return parseFloJson(json, today);
  }
  if (trimmed.includes('"operationalData"')) {
    return parseFloJson(JSON.parse(trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1)), today);
  }
  // A CSV gets the same checks as Flo's cycles (future predictions, end before start, too long).
  const rows = parseCycleCsv(trimmed);
  return parseFloJson({ cycles: rows.map((r) => ({ period_start_date: r.startDate, period_end_date: r.endDate })) }, today, 'csv');
}

export interface PeriodImportPlan {
  creates: ImportedPeriod[];
  summary: {
    found: number;
    new: number;
    alreadyLogged: number;
    first?: string;
    last?: string;
    /** Median days between period starts (typical cycle), when it can be worked out. */
    typicalCycle?: number;
    /** Median period length in days, for periods with an end date. */
    typicalPeriod?: number;
    withFlow: number;
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

/** What an import would add. A period overlapping one already logged (same days) is skipped, so re-running is safe. */
export function planPeriodImport(periods: ImportedPeriod[], existing: PeriodEntry[]): PeriodImportPlan {
  const live = existing.filter((e) => !e.deletedAt);
  const overlaps = (p: ImportedPeriod) => live.some((e) => p.startDate <= (e.endDate ?? e.startDate) && e.startDate <= (p.endDate ?? p.startDate));
  const creates = periods.filter((p) => !overlaps(p));
  const starts = periods.map((p) => keyMs(p.startDate));
  const gaps = starts.slice(1).map((s, i) => Math.round((s - starts[i]) / DAY)).filter((g) => g >= 15 && g <= 60);
  const lengths = periods.filter((p) => p.endDate).map((p) => Math.round((keyMs(p.endDate!) - keyMs(p.startDate)) / DAY) + 1);
  return {
    creates,
    summary: {
      found: periods.length,
      new: creates.length,
      alreadyLogged: periods.length - creates.length,
      first: periods[0]?.startDate,
      last: periods[periods.length - 1]?.startDate,
      typicalCycle: median(gaps),
      typicalPeriod: median(lengths),
      withFlow: periods.filter((p) => p.flow).length,
    },
  };
}
