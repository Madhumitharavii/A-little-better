import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import feedHandler from './api/feed';

// A Little Better — local-first PWA build config.
// No network calls are required for the app to function. Runtime caching
// below covers the Google Fonts CDN, plus the app's own on-device AI files
// (/models and /ort — too large to precache, so they're cached on first use
// and then work offline).
export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [
    react(),
    // In local development, answer /api/feed with the same relay Vercel runs in production.
    {
      name: 'dev-feed-relay',
      configureServer(server) {
        server.middlewares.use('/api/feed', async (req, res) => {
          const response = await feedHandler(new Request(`http://localhost${req.originalUrl ?? req.url}`));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      manifest: {
        name: 'A Little Better',
        short_name: 'A Little Better',
        description: "Don't optimize your life. Take care of it.",
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192.png?v=2',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/maskable-512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Our own service worker (src/sw.ts): newest page when online, the matching saved
      // page when offline — see the comment there.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['**/models/**', '**/ort/**'],
      },
      devOptions: {
        // Lets you test install/offline behavior during `npm run dev` too.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 5173,
  },
  // Transformers.js ships its own WebAssembly loader; let it load as-is.
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  worker: {
    format: 'es',
  },
});
