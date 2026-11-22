import type { Insight } from './rules';

/**
 * Chooses today's advice and remembers what's been shown, so it doesn't
 * repeat. History lives only on this device (localStorage).
 *
 * - Picks are made once per day and stay the same all day.
 * - The same advice (same rule + same subject) won't come back for a few
 *   days — unless what it's based on has changed (its fingerprint).
 * - "Not helpful" quiets that whole kind of advice for a month.
 * - Prefers one kudos + one suggestion when both exist.
 */

export interface AdvisorHistory {
  /** key → when it was last shown and what it was based on then. */
  shown: Record<string, { date: string; fingerprint: string }>;
  /** rule → date it was marked "Not helpful". */
  dismissed: Record<string, string>;
  /** Today's picks, so they stay put all day. */
  today?: { date: string; keys: string[] };
}

export const MAX_PER_DAY = 2;
const COOLDOWN_DAYS: Record<Insight['kind'], number> = { nudge: 4, care: 3, kudos: 6 };
const DISMISS_DAYS = 30;

const STORAGE_KEY = 'alb.advisor.v1';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function emptyHistory(): AdvisorHistory {
  return { shown: {}, dismissed: {} };
}

export function loadHistory(): AdvisorHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyHistory(), ...JSON.parse(raw) };
  } catch {
    // Unavailable or corrupted — start fresh; worst case, advice repeats once.
  }
  return emptyHistory();
}

const historyListeners = new Set<(history: AdvisorHistory) => void>();

/** Lets the Today card and the header pop-up stay in step (e.g. after "Not helpful" in one). */
export function subscribeHistory(listener: (history: AdvisorHistory) => void): () => void {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
}

export function saveHistory(history: AdvisorHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Not saved — fine.
  }
  for (const listener of historyListeners) listener(history);
}

// ── "seen" — drives the dot on the header's 🧭 Noticed button ──

const SEEN_KEY = 'alb.advisor.seen';
const seenListeners = new Set<() => void>();

export type SeenToday = { date: string; keys: string[] };

/** Combines advice history from two devices: latest date wins per item, per dismissal, and for today's picks. */
export function mergeHistory(a: AdvisorHistory, b: AdvisorHistory): AdvisorHistory {
  const shown = { ...a.shown };
  for (const [k, v] of Object.entries(b.shown ?? {})) if (!shown[k] || v.date > shown[k].date) shown[k] = v;
  const dismissed = { ...a.dismissed };
  for (const [k, v] of Object.entries(b.dismissed ?? {})) if (!dismissed[k] || v > dismissed[k]) dismissed[k] = v;
  const today = !a.today ? b.today : b.today && b.today.date > a.today.date ? b.today : a.today;
  return { shown, dismissed, today };
}

/** Combines "seen" from two devices: same day → both sets of keys; otherwise the later day. */
export function mergeSeen(a: SeenToday | null, b: SeenToday | null): SeenToday | null {
  if (!a || !b) return a ?? b;
  if (a.date === b.date) return { date: a.date, keys: Array.from(new Set([...a.keys, ...b.keys])) };
  return a.date > b.date ? a : b;
}

export function getSeen(): SeenToday | null {
  return readSeen();
}

/** Replaces what's been seen on this device (used when it came from another device). */
export function applySeen(seen: SeenToday | null): void {
  try {
    if (seen) localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    else localStorage.removeItem(SEEN_KEY);
  } catch {
    // Not saved — fine.
  }
  for (const listener of seenListeners) listener();
}

function readSeen(): SeenToday | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** True if every one of today's picks has already been looked at. */
export function allSeen(today: string, keys: string[]): boolean {
  const seen = readSeen();
  return !!seen && seen.date === today && keys.every((k) => seen.keys.includes(k));
}

export function markSeen(today: string, keys: string[]): void {
  if (allSeen(today, keys)) return;
  const prev = readSeen();
  const merged = prev?.date === today ? Array.from(new Set([...prev.keys, ...keys])) : keys;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ date: today, keys: merged }));
  } catch {
    // Not saved — the dot may simply show again.
  }
  for (const listener of seenListeners) listener();
}

export function subscribeSeen(listener: () => void): () => void {
  seenListeners.add(listener);
  return () => {
    seenListeners.delete(listener);
  };
}

function isResting(insight: Insight, history: AdvisorHistory, today: string): boolean {
  const dismissedOn = history.dismissed[insight.rule];
  if (dismissedOn && daysBetween(dismissedOn, today) < DISMISS_DAYS) return true;
  const last = history.shown[insight.key];
  if (!last || last.date === today) return false;
  const changed = last.fingerprint !== insight.fingerprint;
  return !changed && daysBetween(last.date, today) < COOLDOWN_DAYS[insight.kind];
}

/**
 * Returns today's advice (at most MAX_PER_DAY) and the updated history.
 * `candidates` should be all currently-applicable insights, best first.
 */
export function chooseToday(candidates: Insight[], history: AdvisorHistory, today: string): { picks: Insight[]; history: AdvisorHistory } {
  const byKey = new Map(candidates.map((c) => [c.key, c]));

  // Same day: keep the morning's picks (if they still apply and weren't dismissed).
  if (history.today?.date === today) {
    const kept = history.today.keys
      .map((k) => byKey.get(k))
      .filter((c): c is Insight => !!c && !(history.dismissed[c.rule] && daysBetween(history.dismissed[c.rule], today) < DISMISS_DAYS));
    if (kept.length > 0 || candidates.length === 0) return { picks: kept, history };
  }

  const fresh = candidates.filter((c) => !isResting(c, history, today));
  const picks: Insight[] = [];
  const firstKudos = fresh.find((c) => c.kind === 'kudos');
  const firstOther = fresh.find((c) => c.kind !== 'kudos');
  // Something to celebrate + something to try, when both exist; otherwise just the best two.
  if (firstOther) picks.push(firstOther);
  if (firstKudos) picks.push(firstKudos);
  for (const c of fresh) {
    if (picks.length >= MAX_PER_DAY) break;
    if (!picks.includes(c)) picks.push(c);
  }
  picks.splice(MAX_PER_DAY);
  picks.sort((a, b) => b.priority - a.priority);

  const shown = { ...history.shown };
  for (const p of picks) shown[p.key] = { date: today, fingerprint: p.fingerprint };
  return { picks, history: { ...history, shown, today: { date: today, keys: picks.map((p) => p.key) } } };
}

/** "Not helpful": quiet this kind of advice for a month. */
export function dismissRule(history: AdvisorHistory, rule: string, today: string): AdvisorHistory {
  return { ...history, dismissed: { ...history.dismissed, [rule]: today } };
}
