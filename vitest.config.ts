import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests live in tests/ (outside src, so the app's own type-check stays
// unchanged). They run in Node with an in-memory IndexedDB.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
  },
});
