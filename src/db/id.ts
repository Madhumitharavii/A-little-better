/**
 * Stable, client-generated IDs and timestamps.
 *
 * Generating IDs on the client (rather than letting a server assign
 * them) is what makes offline writes safe: a record created on the
 * phone with no connectivity already has its final, permanent ID, so
 * it never needs to be "reconciled" with a server-issued one later
 * during Stage 2 sync.
 */

export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}
