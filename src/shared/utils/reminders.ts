import { getLocalDateKey } from '@/db/dateUtils';
import type { AppSettings } from '@/db/schema';

/**
 * IMPORTANT — honest limitation:
 *
 * A PWA (even installed on Android) cannot reliably wake itself up at
 * an exact time when it's closed and the browser isn't running —
 * that requires either native OS alarm APIs (not available to web
 * apps) or a push server that wakes the service worker (which this
 * app doesn't have, since there's no backend yet). What this CAN do
 * reliably is check "should a reminder have fired today?" every time
 * the app is opened or brought to the foreground, and fire a
 * notification then. In practice: if you open the app any time after
 * your reminder time, you'll see it once that day. If you never open
 * the app, nothing fires. For a guaranteed wake-up alarm, use your
 * phone's built-in alarm clock for now — this is the upgrade path
 * noted in remindersRepository once native/push support exists.
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

function fireNotification(title: string, body: string): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: title });
    return true;
  } catch {
    return false;
  }
}

const NIGHT_MESSAGE =
  "It's past your wind-down time. Your future self would love an early night — maybe start easing off screens now?";
const MORNING_MESSAGE =
  'Still here? Sometimes the snooze button just delays the day. One small first step — open the curtains, drink some water — can help more than five more minutes.';

export interface ReminderCheckResult {
  nightFired: boolean;
  morningFired: boolean;
  /** Set when a reminder "fired" logically but the browser Notification couldn't be shown (e.g. permission denied) — show this as an in-app toast instead. */
  nightFallbackMessage?: string;
  morningFallbackMessage?: string;
}

/**
 * Best-effort, foreground-only reminder check — see the module doc
 * comment above. Fires at most once per calendar day per reminder;
 * the caller is responsible for persisting lastNightReminderFiredDate
 * / lastMorningReminderFiredDate via saveSettings after this returns.
 */
export function checkReminders(settings: AppSettings, now: Date = new Date()): ReminderCheckResult {
  const today = getLocalDateKey(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const result: ReminderCheckResult = { nightFired: false, morningFired: false };

  if (settings.nightReminderEnabled && settings.nightReminderTime && settings.lastNightReminderFiredDate !== today) {
    const [h, m] = settings.nightReminderTime.split(':').map(Number);
    if (currentMinutes >= h * 60 + m) {
      const shown = fireNotification('Time to wind down 🌙', NIGHT_MESSAGE);
      result.nightFired = true;
      if (!shown) result.nightFallbackMessage = NIGHT_MESSAGE;
    }
  }

  if (settings.morningReminderEnabled && settings.morningReminderTime && settings.lastMorningReminderFiredDate !== today) {
    const [h, m] = settings.morningReminderTime.split(':').map(Number);
    if (currentMinutes >= h * 60 + m) {
      const shown = fireNotification('Good morning ☀️', MORNING_MESSAGE);
      result.morningFired = true;
      if (!shown) result.morningFallbackMessage = MORNING_MESSAGE;
    }
  }

  return result;
}
