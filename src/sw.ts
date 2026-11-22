/// <reference lib="webworker" />
/**
 * The app's service worker — what lets it open offline and keep itself
 * up to date. Rules:
 *
 *  - Opening the app (a page navigation): fetch the NEWEST page from the
 *    network, so online you always get the latest version straight away
 *    (no old copy first, then a switch). If the network fails or takes
 *    more than 4 s, use the saved page from the precache — which always
 *    matches the saved code files, so it can never open to a blank screen.
 *  - App code, styles, icons and the page itself are precached together
 *    as one consistent set; a new version replaces the set as a whole.
 *  - The on-device AI model/engine and fonts are cached once and reused.
 */
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const NETWORK_TIMEOUT_MS = 4000;

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ request }) => {
    try {
      const response = await Promise.race([
        fetch(request),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
      ]);
      if (response.ok) return response;
      throw new Error(`HTTP ${response.status}`);
    } catch {
      return (await matchPrecache('index.html')) ?? Response.error();
    }
  },
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/models/') || url.pathname.startsWith('/ort/'),
  new CacheFirst({
    cacheName: 'on-device-ai',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 12 })],
  }),
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);
