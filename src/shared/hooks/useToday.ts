import { useEffect, useState } from 'react';
import { getLocalDateKey } from '@/db/dateUtils';

/**
 * Today's local date key, kept current: it rolls over at local midnight and
 * re-checks whenever the app comes back to the foreground — so an app left
 * open overnight never shows (or writes to) yesterday.
 */
export function useToday(): string {
  const [today, setToday] = useState(getLocalDateKey);
  useEffect(() => {
    const refresh = () => setToday(getLocalDateKey());
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime();
    const timeout = window.setTimeout(refresh, nextMidnight - now.getTime());
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [today]);
  return today;
}
