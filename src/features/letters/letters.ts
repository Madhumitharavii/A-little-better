import type { LetterItem } from '@/db/schema';

/** Open on or after its date (local date keys compare as strings). */
export const isOpen = (l: LetterItem, today: string): boolean => l.openOn <= today;

export function lettersFrom(rows: readonly { type?: string; deletedAt?: string | null }[] | undefined): LetterItem[] {
  return ((rows ?? []).filter((r) => r.type === 'letter' && !r.deletedAt) as LetterItem[]).sort((a, b) => a.openOn.localeCompare(b.openOn));
}

/** Open but not read yet — newest opening first. */
export const unreadOpen = (letters: LetterItem[], today: string): LetterItem[] =>
  letters.filter((l) => isOpen(l, today) && !l.readAt).sort((a, b) => b.openOn.localeCompare(a.openOn));

const toDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** "in 3 days", "in 5 months", "in about a year". */
export function untilText(today: string, openOn: string): string {
  const days = daysBetween(today, openOn);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 45) return `in ${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `in ${months} months`;
  const years = Math.round((days / 365.25) * 2) / 2;
  return years === 1 ? 'in about a year' : `in about ${years} years`;
}

/** The same day some months on (clamped to the month's last day). */
export function addMonthsKey(key: string, months: number): string {
  const d = toDate(key);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toKey(target);
}

/** 1 January of next year. */
export const nextNewYear = (today: string): string => `${Number(today.slice(0, 4)) + 1}-01-01`;

export function quickDates(today: string): { label: string; date: string }[] {
  return [
    { label: 'In a month', date: addMonthsKey(today, 1) },
    { label: 'In 6 months', date: addMonthsKey(today, 6) },
    { label: 'Next New Year', date: nextNewYear(today) },
    { label: 'In a year', date: addMonthsKey(today, 12) },
  ];
}

export function longDate(key: string): string {
  return toDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
