import { describe, it, expect } from 'vitest';
import { parseCycleFile, planPeriodImport, dayKey, MAX_PERIOD_DAYS } from '@/features/me/period/floImport';
import type { PeriodEntry } from '@/db/schema';

// Made-up data in the shape Flo's export is known to use (operationalData.cycles / point_events_manual_v2).
const flo = {
  operationalData: {
    cycles: [
      { period_start_date: '2026-07-02', period_end_date: '2026-07-06' },
      { period_start_date: '2026-07-30', period_end_date: '2026-08-03' },
      { period_start_date: '2026-08-27' }, // no end date
      { period_start_date: '2026-09-24', period_end_date: '2026-10-30' }, // far too long
      { period_start_date: '2026-10-22', period_end_date: '2026-10-19' }, // ends before it starts
      { period_start_date: '2026-07-02', period_end_date: '2026-07-06' }, // repeat
      { period_start_date: '2026-12-20', period_end_date: '2026-12-24' }, // predicted, in the future
      'garbage',
    ],
    point_events_manual_v2: [
      { category: 'Symptom', subcategory: 'Cramps', date: '2026-07-02' },
      { category: 'Symptom', subcategory: 'Cramps', date: '2026-07-30' },
      { category: 'PeriodIntensity', subcategory: 'Heavy', date: '2026-07-03' },
      { category: 'PeriodIntensity', subcategory: 'Light', date: '2026-07-05' },
      { category: 'OvulationTest', subcategory: 'Positive', date: '2026-07-16' },
    ],
  },
};

describe('Flo import', () => {
  const today = '2026-11-22';
  const parsed = parseCycleFile(JSON.stringify(flo), today);

  it('reads cycles, fixing what needs fixing and skipping predictions', () => {
    expect(parsed.format).toBe('flo');
    expect(parsed.periods.map((p) => [p.startDate, p.endDate])).toEqual([
      ['2026-07-02', '2026-07-06'],
      ['2026-07-30', '2026-08-03'],
      ['2026-08-27', undefined],
      ['2026-09-24', '2026-10-08'], // capped
      ['2026-10-22', undefined],
    ]);
    expect(parsed.adjustments).toMatchObject({
      'Periods with no end date, saved with the start only': 2,
      [`Periods longer than ${MAX_PERIOD_DAYS} days, shortened`]: 1,
      'Periods ending before they start, end date dropped': 1,
      'Predicted future periods, skipped': 1,
      "Cycles that couldn't be read": 1,
    });
  });

  it('takes a clear flow level from logged events, and lists the rest', () => {
    expect(parsed.periods[0].flow).toBe('heavy');
    expect(parsed.periods[1].flow).toBeUndefined();
    expect(parsed.events).toMatchObject({ 'Symptom: cramps': 2, 'Ovulation Test: positive': 1, 'Period Intensity: heavy': 1 });
  });

  it('accepts the JSON even inside a .txt with extra text around it', () => {
    const txt = `Your Flo data\n\n${JSON.stringify(flo)}\n\nThanks`;
    expect(parseCycleFile(txt, today).periods).toHaveLength(5);
  });

  it('still reads a CSV', () => {
    const csv = parseCycleFile('Start Date,End Date\n2026-07-02,2026-07-06\n2026-07-30,', today);
    expect(csv.format).toBe('csv');
    expect(csv.periods).toHaveLength(2);
  });

  it('explains a file that is not a Flo export', () => {
    expect(() => parseCycleFile('{"hello": 1}', today)).toThrow(/Flo export/);
  });

  it('plans the import: skips periods already logged, works out typical lengths', () => {
    const mine = [{ id: 'a', startDate: '2026-07-03', endDate: '2026-07-07', source: 'manual', createdAt: 'x', updatedAt: 'x' }] as PeriodEntry[];
    const plan = planPeriodImport(parsed.periods, mine);
    expect(plan.summary).toMatchObject({ found: 5, new: 4, alreadyLogged: 1, first: '2026-07-02', last: '2026-10-22', typicalCycle: 28, typicalPeriod: 5, withFlow: 1 });
    expect(planPeriodImport(parsed.periods, [...mine, ...plan.creates.map((p, i) => ({ ...p, id: `n${i}`, source: 'import', createdAt: 'x', updatedAt: 'x' }) as PeriodEntry)]).summary.new).toBe(0);
  });

  it('reads the date formats it may meet', () => {
    expect(dayKey('2026-07-02')).toBe('2026-07-02');
    expect(dayKey('2026-07-02T10:00:00.000Z')).toBe('2026-07-02');
    expect(dayKey('2026/07/02')).toBe('2026-07-02');
    expect(dayKey(1782950400)).toBe('2026-07-02');
    expect(dayKey('soon')).toBeUndefined();
  });
});

describe('cycle CSV dates', () => {
  it('reads day-first dates as written in India, and checks CSV rows like Flo ones', async () => {
    const { parseDayFirst } = await import('@/features/me/period/periodImport');
    expect(parseDayFirst('05/03/2024')).toBe('2024-03-05');
    expect(parseDayFirst('15/03/2024')).toBe('2024-03-15');
    expect(parseDayFirst('03/25/2024')).toBe('2024-03-25');
    expect(parseDayFirst('31/02/2024')).toBeUndefined();
    const csv = parseCycleFile('Start Date,End Date\n05/03/2026,09/03/2026\n20/12/2026,24/12/2026', '2026-11-22');
    expect(csv.periods).toEqual([{ startDate: '2026-03-05', endDate: '2026-03-09' }]);
    expect(csv.adjustments['Predicted future periods, skipped']).toBe(1);
  });
});
