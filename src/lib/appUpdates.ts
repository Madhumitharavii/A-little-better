/**
 * Keeps the installed app (Dock / home screen) up to date.
 *
 * Normally the service worker opens the newest page when online. But an
 * installed app can still end up running an old copy — a slow network
 * when it opened, or a service worker update that didn't go through — and
 * then it would stay old until it happened to be reopened at the right
 * moment. So the app also checks for itself:
 *
 *  - when it opens, when it comes back to the front, and every 30 minutes,
 *    it asks the server which version is current (a tiny request that
 *    skips every cache);
 *  - if that isn't the version running, it fetches the new service worker
 *    and reloads once onto the new version.
 *
 * A reload only happens when the running version really is out of date,
 * and never twice in a row for the same version, so it can't loop.
 */

const RELOADED_FOR_KEY = 'alb.updatedTo';

/** The app's main code file as named in a page, e.g. "/assets/index-AbC123.js". */
const entryIn = (html: string): string | undefined => html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];

function runningEntry(): string | undefined {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
  return el ? new URL(el.src, location.href).pathname : undefined;
}

async function latestEntry(): Promise<string | undefined> {
  // The query string makes this miss the service worker's saved page, and no-store skips the browser's cache.
  const res = await fetch(`/index.html?latest=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return undefined;
  const entry = entryIn(await res.text());
  return entry ? new URL(entry, location.href).pathname : undefined;
}

let checking = false;

async function checkForNewVersion(): Promise<void> {
  if (checking || !navigator.onLine) return;
  checking = true;
  try {
    const [running, latest] = [runningEntry(), await latestEntry()];
    if (!running || !latest || running === latest) return;

    let already: string | null = null;
    try {
      already = sessionStorage.getItem(RELOADED_FOR_KEY);
    } catch {
      /* no storage — the version check above still stops loops once updated */
    }
    if (already === latest) return; // reloaded for this version already and still old: don't loop

    // Bring the service worker up to date first, so the reload gets the new page.
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update().catch(() => undefined);
    const incoming = reg?.installing ?? reg?.waiting;
    if (incoming) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        incoming.addEventListener('statechange', () => {
          if (incoming.state === 'activated' || incoming.state === 'redundant') done();
        });
        window.setTimeout(done, 10_000);
      });
    }
    try {
      sessionStorage.setItem(RELOADED_FOR_KEY, latest);
    } catch {
      /* fine */
    }
    location.reload();
  } catch {
    // Offline or the server didn't answer — try again next time.
  } finally {
    checking = false;
  }
}

export function keepAppUpdated(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const check = () => void checkForNewVersion();
  window.setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, 30 * 60 * 1000);
}
