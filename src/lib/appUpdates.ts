/**
 * Keeps the installed app (Dock / home screen) up to date.
 *
 * The page itself is loaded network-first (see vite.config.ts), so when
 * online the app always opens on the newest version. The service worker
 * (which keeps the app working offline) auto-updates in the background;
 * here we just ask it to check for a new version whenever the app comes
 * back to the foreground, and every 30 minutes while it's open.
 *
 * (An earlier version also reloaded the page when a new service worker
 * took over. With the page fetched fresh that's no longer needed, and the
 * extra reload made the layout appear to jump between versions.)
 */
export function keepAppUpdated(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const check = () => {
    void navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => undefined));
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, 30 * 60 * 1000);
}
