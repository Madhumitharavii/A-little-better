import { readPref, watchPref, writePref } from '@/db/repositories/syncedPrefs';
import { fireNotification } from '@/shared/utils/reminders';

/**
 * Drink-water nudges: one when you open the app (or come back to it), and
 * then every so often while it stays open — as a message in the app, or a
 * system notification when the app is in the background (if you've allowed
 * notifications). Only during your waking hours. Nothing leaves the device;
 * the settings follow you between devices like your other preferences.
 */
export interface WaterPrefs {
  enabled: boolean;
  everyMinutes: number;
  from: string; // "HH:MM"
  until: string; // "HH:MM"
}

export const WATER_DEFAULTS: WaterPrefs = { enabled: true, everyMinutes: 60, from: '09:00', until: '22:00' };

/** Opening the app again soon after a nudge shouldn't nudge again. */
export const OPEN_QUIET_MINUTES = 20;

const LAST_KEY = 'alb.water.last';

const MESSAGES = [
  '💧 Time for a glass of water.',
  '💧 A few sips of water?',
  '💧 Little water break — your body will thank you.',
  '💧 Have you had some water lately?',
];

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function inWakingHours(now: Date, p: WaterPrefs): boolean {
  const t = now.getHours() * 60 + now.getMinutes();
  const from = minutesOf(p.from);
  const until = minutesOf(p.until);
  return from <= until ? t >= from && t < until : t >= from || t < until; // e.g. 10:00–01:00 for night owls
}

/** Whether to nudge now — on opening the app ('open') or on the regular check while it's open ('tick'). */
export function waterDue(now: Date, p: WaterPrefs, lastAt: number | undefined, reason: 'open' | 'tick'): boolean {
  if (!p.enabled || !inWakingHours(now, p)) return false;
  if (lastAt === undefined) return true;
  const since = (now.getTime() - lastAt) / 60_000;
  return since >= (reason === 'open' ? Math.min(OPEN_QUIET_MINUTES, p.everyMinutes) : p.everyMinutes);
}

export async function readWaterPrefs(): Promise<WaterPrefs> {
  return { ...WATER_DEFAULTS, ...((await readPref<Partial<WaterPrefs>>('water'))?.value ?? {}) };
}

function readLast(): number | undefined {
  try {
    const v = Number(localStorage.getItem(LAST_KEY));
    return v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}
function saveLast(t: number) {
  try {
    localStorage.setItem(LAST_KEY, String(t));
  } catch {
    /* fine */
  }
}

let started = false;
let prefs = WATER_DEFAULTS;

/** Saves your water settings (they follow you to your other devices) and uses them right away. */
export async function saveWaterPrefs(next: WaterPrefs): Promise<void> {
  prefs = next;
  await writePref('water', next);
}

export function startWaterReminders(show: (message: string) => void): void {
  if (started || import.meta.env.MODE === 'test') return;
  started = true;
  let n = Math.floor(Math.random() * MESSAGES.length);

  const check = (reason: 'open' | 'tick') => {
    const now = new Date();
    if (!waterDue(now, prefs, readLast(), reason)) return;
    const message = MESSAGES[n++ % MESSAGES.length];
    if (document.visibilityState === 'visible') show(message);
    else if (!fireNotification('Water 💧', message.replace('💧 ', ''))) return; // can't show it now — wait until you're back
    saveLast(now.getTime());
  };

  void readWaterPrefs().then((p) => {
    prefs = p;
    window.setTimeout(() => check('open'), 4000);
  });
  watchPref<Partial<WaterPrefs>>('water', (v) => (prefs = { ...WATER_DEFAULTS, ...v }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.setTimeout(() => check('open'), 1500);
  });
  window.setInterval(() => check('tick'), 60_000);
}
