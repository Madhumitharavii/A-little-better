import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The local Dexie/IndexedDB database remains the app's source of
 * truth and works fully offline with zero Supabase configuration —
 * see src/db/db.ts. This client is used by the optional cross-device
 * sync layer in src/lib/sync/ (auth in authService.ts, row/image
 * helpers in syncService.ts, orchestration in syncEngine.ts, which
 * App.tsx runs automatically).
 *
 * Reads two Vite env vars, both optional:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 * See .env.example. If either is missing, `supabase` is null and
 * `isSupabaseConfigured` is false — every function in src/lib/sync
 * checks this and no-ops (or rejects with a clear message) rather
 * than throwing at import time, so the app works identically with
 * or without Supabase set up.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        // Sessions persist in IndexedDB-backed storage by default in
        // supabase-js; fine to leave as the library default for now.
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // Purely informational for local development — never thrown, never
  // shown to the person using the app.
  // eslint-disable-next-line no-console
  console.info('[A Little Better] Supabase env vars not set — running fully local/offline. See .env.example.');
}
