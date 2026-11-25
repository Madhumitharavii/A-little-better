import { readPref, watchPref, writePref } from '@/db/repositories/syncedPrefs';
import { db } from '@/db/db';
import { addDays, getLocalDateKey } from '@/db/dateUtils';
import { fireNotification } from '@/shared/utils/reminders';
import type { CareEntry } from '@/db/schema';
import { breakfastNudge, LOOK_BACK_DAYS, type MealKey } from '@/features/today/meals';

/**
 * Meal nudges, for someone who skips meals: if a meal isn't marked by a
 * certain time, one gentle reminder (once a day per meal). And in the
 * evening, if breakfast keeps getting skipped, a nudge to wake up a bit
 * earlier tomorrow. Like the water reminders, these only come while the
 * app is open (or in the background, as a notification if allowed).
 */
export interface MealPrefs {
  enabled: boolean;
}
export const MEAL_DEFAULTS: MealPrefs = { enabled: true };

type NudgeKey = MealKey | 'plan';

/** [from, until) in minutes after midnight. */
export const NUDGE_WINDOWS: Record<NudgeKey, [number, number]> = {
  breakfast: [9 * 60 + 30, 12 * 60],
  lunch: [14 * 60, 16 * 60 + 30],
  dinner: [20 * 60 + 30, 23 * 60],
  plan: [21 * 60 + 30, 24 * 60],
};

const MESSAGES: Record<MealKey, string> = {
  breakfast: '🍳 Have you had breakfast? Even something small counts.',
  lunch: '🥗 Lunch time — have you eaten yet?',
  dinner: '🍲 Have you had dinner? Don’t go to bed hungry.',
};

/** Which nudge (if any) is due now. `fired` = nudges already shown today. */
export function mealNudgeDue(now: Date, todays: CareEntry[], recent: CareEntry[], fired: string[]): { key: NudgeKey; message: string } | null {
  const t = now.getHours() * 60 + now.getMinutes();
  const marked = new Set(todays.map((e) => e.itemKey));
  for (const key of ['breakfast', 'lunch', 'dinner'] as const) {
    const [from, until] = NUDGE_WINDOWS[key];
    if (t >= from && t < until && !marked.has(key) && !fired.includes(key)) return { key, message: MESSAGES[key] };
  }
  const [from, until] = NUDGE_WINDOWS.plan;
  if (t >= from && t < until && !fired.includes('plan')) {
    // Count today too — by evening it's known whether breakfast happened.
    const tomorrow = addDays(getLocalDateKey(now), 1);
    const plan = breakfastNudge([...recent, ...todays], tomorrow);
    if (plan) return { key: 'plan', message: `⏰ ${plan}` };
  }
  return null;
}

const FIRED_KEY = 'alb.meals.fired';

function readFired(today: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FIRED_KEY) ?? 'null') as { date: string; keys: string[] } | null;
    return v?.date === today ? v.keys : [];
  } catch {
    return [];
  }
}
function saveFired(today: string, keys: string[]) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify({ date: today, keys }));
  } catch {
    /* fine */
  }
}

export async function readMealPrefs(): Promise<MealPrefs> {
  return { ...MEAL_DEFAULTS, ...((await readPref<Partial<MealPrefs>>('meals'))?.value ?? {}) };
}

let prefs = MEAL_DEFAULTS;
let started = false;

export async function saveMealPrefs(next: MealPrefs): Promise<void> {
  prefs = next;
  await writePref('meals', next);
}

export function startMealReminders(show: (message: string) => void): void {
  if (started || import.meta.env.MODE === 'test') return;
  started = true;

  const check = async () => {
    if (!prefs.enabled) return;
    const now = new Date();
    const today = getLocalDateKey(now);
    const [todays, recent] = await Promise.all([
      db.careEntries.where('date').equals(today).toArray(),
      db.careEntries.where('date').between(addDays(today, -LOOK_BACK_DAYS), today).toArray(),
    ]);
    const fired = readFired(today);
    const due = mealNudgeDue(now, todays, recent, fired);
    if (!due) return;
    if (document.visibilityState === 'visible') show(due.message);
    else if (!fireNotification('A little reminder', due.message.replace(/^\S+ /, ''))) return;
    saveFired(today, [...fired, due.key]);
  };

  void readMealPrefs().then((p) => {
    prefs = p;
    window.setTimeout(() => void check(), 9000); // after the water nudge, not on top of it
  });
  watchPref<Partial<MealPrefs>>('meals', (v) => (prefs = { ...MEAL_DEFAULTS, ...v }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.setTimeout(() => void check(), 6000);
  });
  window.setInterval(() => void check(), 5 * 60_000);
}
