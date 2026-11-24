import { describe, expect, it } from 'vitest';
import { inWakingHours, waterDue, WATER_DEFAULTS } from '@/lib/water';

const at = (hhmm: string) => new Date(`2026-11-24T${hhmm}:00`);
const minsAgo = (d: Date, m: number) => d.getTime() - m * 60_000;

describe('drink-water reminders', () => {
  it('only during waking hours, including ones that cross midnight', () => {
    expect(inWakingHours(at('08:59'), WATER_DEFAULTS)).toBe(false);
    expect(inWakingHours(at('09:00'), WATER_DEFAULTS)).toBe(true);
    expect(inWakingHours(at('22:00'), WATER_DEFAULTS)).toBe(false);
    const owl = { ...WATER_DEFAULTS, from: '11:00', until: '02:00' };
    expect(inWakingHours(at('01:30'), owl)).toBe(true);
    expect(inWakingHours(at('03:00'), owl)).toBe(false);
  });

  it('nudges on opening the app, but not again straight after one', () => {
    const now = at('14:00');
    expect(waterDue(now, WATER_DEFAULTS, undefined, 'open')).toBe(true);
    expect(waterDue(now, WATER_DEFAULTS, minsAgo(now, 5), 'open')).toBe(false);
    expect(waterDue(now, WATER_DEFAULTS, minsAgo(now, 25), 'open')).toBe(true);
  });

  it('while open, every so often', () => {
    const now = at('14:00');
    expect(waterDue(now, WATER_DEFAULTS, minsAgo(now, 59), 'tick')).toBe(false);
    expect(waterDue(now, WATER_DEFAULTS, minsAgo(now, 60), 'tick')).toBe(true);
    expect(waterDue(now, { ...WATER_DEFAULTS, everyMinutes: 30 }, minsAgo(now, 31), 'tick')).toBe(true);
  });

  it('never when turned off or outside waking hours', () => {
    expect(waterDue(at('14:00'), { ...WATER_DEFAULTS, enabled: false }, undefined, 'open')).toBe(false);
    expect(waterDue(at('23:30'), WATER_DEFAULTS, undefined, 'open')).toBe(false);
  });
});
