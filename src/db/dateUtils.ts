/**
 * Local-calendar-date helpers.
 *
 * Everything in this app keys "days" by the device's local calendar
 * date, not UTC — carried over deliberately from the prototype, which
 * fixed a real bug class (a day flipping over at the wrong moment
 * near midnight depending on timezone offset).
 */

export function getLocalDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The LOCAL date of a stored timestamp (e.g. createdAt). A plain `.slice(0, 10)` of an ISO
 * timestamp gives the UTC date — in India that's the previous day for anything done
 * between midnight and 5:30 am. Date-only keys ("2026-11-22") are returned as they are.
 */
export function localDateKeyOf(iso: string | undefined | null): string | undefined {
  if (!iso) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : getLocalDateKey(d);
}

export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return getLocalDateKey(dt);
}

export function formatFriendlyDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** Start (Monday) of the local week containing dateKey, as a date key. */
export function startOfWeek(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  dt.setDate(dt.getDate() + diff);
  return getLocalDateKey(dt);
}
