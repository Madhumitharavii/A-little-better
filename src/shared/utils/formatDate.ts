/**
 * Formats an ISO local date key ("YYYY-MM-DD") as DD/MM/YYYY for
 * display to the person. Internal storage, sorting, and comparisons
 * everywhere else in the app continue to use the ISO string — this
 * is a display-only conversion, applied at the point of rendering.
 *
 * Returns an empty string for missing input, and returns the raw
 * value unchanged if it doesn't look like an ISO date (so unexpected
 * data never disappears or throws).
 */
export function formatDisplayDate(dateKey: string | undefined | null): string {
  if (!dateKey) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey);
  if (!match) return dateKey;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Formats a DD/MM/YYYY-displayed range, omitting the arrow when only one side is present. */
export function formatDisplayDateRange(startDateKey: string | undefined | null, endDateKey: string | undefined | null): string {
  const start = formatDisplayDate(startDateKey);
  const end = formatDisplayDate(endDateKey);
  if (start && end) return `${start} – ${end}`;
  return start || end;
}
