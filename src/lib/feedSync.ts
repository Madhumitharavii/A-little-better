import { useEffect, useState } from 'react';
import { readPref, writePref } from '@/db/repositories/syncedPrefs';
import { bulkCreateLifeItems, bulkUpdateLifeItems, getLifeItems } from '@/db/repositories/lifeRepository';
import type { BookItem, MovieItem } from '@/db/schema';
import { planImport } from '@/features/life/movies/letterboxdImport';
import { planGoodreadsImport } from '@/features/life/books/goodreadsImport';
import { parseLetterboxdFeed } from '@/features/life/feeds/letterboxdFeed';
import { parseGoodreadsFeed, type GoodreadsShelf } from '@/features/life/feeds/goodreadsFeed';

/**
 * Keeps Life → Movies / Books up to date from your own public Letterboxd and
 * Goodreads feeds (one way: Letterboxd/Goodreads → this app). Your usernames
 * are a synced preference (stored with your data, not in the code). Feeds are
 * fetched through the app's own relay (api/feed.ts) and merged with the same
 * rules as the imports, so nothing is ever duplicated or overwritten.
 */
export interface ConnectedAccounts {
  letterboxd?: string;
  /** The number in your Goodreads profile link (goodreads.com/user/show/12345678-name). */
  goodreadsId?: string;
}

type SourceResult = { added: number; updated: number } | { error: string };
export interface FeedSyncResult {
  at: string;
  letterboxd?: SourceResult;
  goodreads?: SourceResult;
}

const LAST_KEY = 'alb.feeds.last';
const CHECK_EVERY_MS = 3 * 60 * 60 * 1000;
const listeners = new Set<(r: FeedSyncResult | null) => void>();
let running: Promise<FeedSyncResult | null> | null = null;

function readLast(): FeedSyncResult | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as FeedSyncResult) : null;
  } catch {
    return null;
  }
}

export async function getConnectedAccounts(): Promise<ConnectedAccounts> {
  return (await readPref<ConnectedAccounts>('connectedAccounts'))?.value ?? {};
}

export async function setConnectedAccounts(accounts: ConnectedAccounts): Promise<void> {
  await writePref('connectedAccounts', accounts);
}

/** "12345678", "goodreads.com/user/show/12345678-name" or a review-list link → "12345678". */
export function goodreadsIdFrom(input: string): string | undefined {
  const t = input.trim();
  const m = t.match(/(?:user\/show|review\/list(?:_rss)?)\/(\d+)/) ?? t.match(/^(\d{1,12})$/);
  return m?.[1];
}

/** "someone", "@someone" or "letterboxd.com/someone/" → "someone". */
export function letterboxdUserFrom(input: string): string | undefined {
  const t = input.trim().replace(/^@/, '');
  const m = t.match(/letterboxd\.com\/([A-Za-z0-9_]+)/) ?? t.match(/^([A-Za-z0-9_]{1,40})$/);
  return m?.[1];
}

async function fetchFeed(query: string): Promise<string> {
  const res = await fetch(`/api/feed?${query}`, { cache: 'no-store' });
  if (res.status === 404) throw new Error('not-found');
  if (!res.ok) throw new Error('unreachable');
  return res.text();
}

const friendly = (err: unknown, site: string) =>
  err instanceof Error && err.message === 'not-found'
    ? `${site} couldn't find that profile — check the name, and that the profile is public.`
    : `Couldn't reach ${site} right now. It'll try again later.`;

async function syncLetterboxd(user: string): Promise<SourceResult> {
  try {
    const exp = parseLetterboxdFeed(await fetchFeed(`source=letterboxd&user=${encodeURIComponent(user)}`));
    // From your feed, an edited Letterboxd review replaces its older text (app-written reviews are never touched).
    const plan = planImport(exp, (await getLifeItems('movie')) as MovieItem[], { updateLetterboxdReviews: true });
    const added = plan.creates.length ? await bulkCreateLifeItems(plan.creates) : 0;
    const updated = await bulkUpdateLifeItems(plan.updates);
    return { added, updated };
  } catch (err) {
    return { error: friendly(err, 'Letterboxd') };
  }
}

async function syncGoodreads(id: string): Promise<SourceResult> {
  try {
    // Read first, so a book on two shelves counts as read.
    const shelves: GoodreadsShelf[] = ['read', 'currently-reading', 'to-read'];
    const rows = [];
    for (const shelf of shelves) rows.push(...parseGoodreadsFeed(await fetchFeed(`source=goodreads&user=${id}&shelf=${shelf}`), shelf));
    const plan = planGoodreadsImport(rows, (await getLifeItems('book')) as BookItem[]);
    const added = plan.creates.length ? await bulkCreateLifeItems(plan.creates) : 0;
    const updated = await bulkUpdateLifeItems(plan.updates);
    return { added, updated };
  } catch (err) {
    return { error: friendly(err, 'Goodreads') };
  }
}

/** Checks both feeds now (if accounts are connected). Safe to call any time; overlapping calls share one run. */
export function syncFeeds(): Promise<FeedSyncResult | null> {
  if (running) return running;
  running = (async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return readLast();
    const accounts = await getConnectedAccounts();
    if (!accounts.letterboxd && !accounts.goodreadsId) return null;
    const result: FeedSyncResult = { at: new Date().toISOString() };
    if (accounts.letterboxd) result.letterboxd = await syncLetterboxd(accounts.letterboxd);
    if (accounts.goodreadsId) result.goodreads = await syncGoodreads(accounts.goodreadsId);
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(result));
    } catch {
      /* not remembered — fine */
    }
    for (const l of listeners) l(result);
    window.dispatchEvent(new CustomEvent<FeedSyncResult>('alb:feeds-synced', { detail: result }));
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Background checks: a few seconds after opening, when you come back to the app, and every 3 hours. */
export function startFeedSync(): void {
  const due = () => {
    const last = readLast();
    return !last || Date.now() - Date.parse(last.at) > CHECK_EVERY_MS;
  };
  const maybe = () => {
    if (due()) void syncFeeds();
  };
  window.setTimeout(maybe, 8000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') maybe();
  });
  window.setInterval(maybe, CHECK_EVERY_MS);
}

export function useLastFeedSync(): FeedSyncResult | null {
  const [last, setLast] = useState(readLast);
  useEffect(() => {
    listeners.add(setLast);
    return () => {
      listeners.delete(setLast);
    };
  }, []);
  return last;
}

/** "Letterboxd: 2 new, 1 updated" style summary of one source. */
export function describeSource(name: string, r: SourceResult | undefined): string | null {
  if (!r) return null;
  if ('error' in r) return `${name}: ${r.error}`;
  if (!r.added && !r.updated) return `${name}: up to date`;
  return `${name}: ${[r.added && `${r.added} new`, r.updated && `${r.updated} updated`].filter(Boolean).join(', ')}`;
}
