import { getLocalDateKey } from '@/db/dateUtils';

/** "Today", "Yesterday", "5 days ago", or "Not yet" — gentle, never a score. */
export function describeLastContact(dateKey: string | undefined): string {
  if (!dateKey) return 'Not yet';
  const today = Date.parse(getLocalDateKey());
  const then = Date.parse(dateKey.slice(0, 10));
  if (Number.isNaN(then)) return 'Not yet';
  const days = Math.round((today - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (days < 60) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} months ago`;
}
