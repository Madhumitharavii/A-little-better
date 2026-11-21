/**
 * Keeps the installed app (Dock / home screen) on the latest version.
 *
 * The service worker is set to auto-update: when a new version is
 * deployed it installs in the background and takes over. On its own
 * that only shows on the *next* launch — and an installed app often
 * keeps running for days. So:
 *  - when a new version takes over, reload once so it shows straight away;
 *  - check for a new version whenever the app comes back to the
 *    foreground (and every 30 minutes while it's open).
 */
export function keepAppUpdated(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  // Only reload when an OLD version was in control — not on the very first install.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  const check = () => {
    void navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => undefined));
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, 30 * 60 * 1000);
}
