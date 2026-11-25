import { getLifeRows, subscribeLifeRows } from '@/db/lifeStore';
import { getLocalDateKey } from '@/db/dateUtils';
import { markLetterAnnounced } from '@/db/repositories/letterRepository';
import { fireNotification } from '@/shared/utils/reminders';
import { isOpen, lettersFrom } from '@/features/letters/letters';

/**
 * When a sealed letter's day comes, says so once: a message in the app,
 * or a notification if the app is in the background (and allowed).
 * Checked when the app opens, comes back, and every few minutes — so a
 * letter set for New Year opens at midnight if the app is open then.
 */
let started = false;

export function startLetterWatch(show: (message: string) => void): void {
  if (started || import.meta.env.MODE === 'test') return;
  started = true;
  let busy = false;

  const check = async () => {
    const rows = getLifeRows();
    if (!rows || busy) return;
    const today = getLocalDateKey();
    const fresh = lettersFrom(rows).filter((l) => isOpen(l, today) && !l.announcedAt && !l.readAt);
    if (!fresh.length) return;
    const message =
      fresh.length === 1 ? '💌 A message from your past self is open.' : `💌 ${fresh.length} messages from your past self are open.`;
    if (document.visibilityState === 'visible') show(`${message} It’s on Today.`);
    else if (!fireNotification('A message from your past self', message.replace('💌 ', ''))) return;
    busy = true;
    try {
      for (const l of fresh) await markLetterAnnounced(l.id);
    } finally {
      busy = false;
    }
  };

  // Rows load a moment after start; wait for them, then a little longer so it doesn't land on top of other messages.
  let waiting = true;
  const onRows = () => {
    if (!waiting || !getLifeRows()) return;
    waiting = false;
    stop();
    window.setTimeout(() => void check(), 2500);
  };
  const stop = subscribeLifeRows(onRows);
  onRows();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.setTimeout(() => void check(), 2500);
  });
  window.setInterval(() => void check(), 5 * 60_000);
}
