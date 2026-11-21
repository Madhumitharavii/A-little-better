import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

/**
 * Thin wrappers around Supabase Auth, used by AccountSection (Settings →
 * Cross-device Sync) and syncEngine. Every function rejects with a
 * clear message if Supabase isn't configured, rather than throwing a
 * confusing "cannot read property of null" error.
 */

function requireSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Sync is not set up on this device yet — Supabase is not configured.');
  }
  return supabase;
}

export async function signUpWithEmail(email: string, password: string) {
  const client = requireSupabase();
  return client.auth.signUp({ email, password });
}

export async function signInWithEmail(email: string, password: string) {
  const client = requireSupabase();
  return client.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const client = requireSupabase();
  return client.auth.signOut();
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ── Forgot password ────────────────────────────────────────────────
//
// 1. sendPasswordResetEmail() asks Supabase to email a reset link that
//    points back to this app (the current page's address).
// 2. Opening that link signs the person in with a short-lived
//    "recovery" session, and Supabase Auth emits PASSWORD_RECOVERY
//    while the app starts up.
// 3. The app then shows "Set a new password" (⚙️ Settings → Cross-device Sync),
//    which calls updatePassword().
//
// The PASSWORD_RECOVERY event fires once, right at startup — long
// before the Settings page (where the form lives) is on screen.
// So it's captured here, at module load, into a small flag that the
// UI can subscribe to whenever it mounts.

let recoveryPending = false;
const recoveryListeners = new Set<(pending: boolean) => void>();

function setRecoveryPending(pending: boolean) {
  recoveryPending = pending;
  for (const listener of recoveryListeners) listener(pending);
}

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') setRecoveryPending(true);
    if (event === 'SIGNED_OUT') setRecoveryPending(false);
  });
}

/** Subscribe to "a password-reset link was just opened". Calls the listener immediately with the current value. */
export function subscribePasswordRecovery(listener: (pending: boolean) => void): () => void {
  recoveryListeners.add(listener);
  listener(recoveryPending);
  return () => {
    recoveryListeners.delete(listener);
  };
}

/** Lets the person dismiss the set-new-password form without changing anything. */
export function dismissPasswordRecovery() {
  setRecoveryPending(false);
}

/**
 * Emails a password-reset link for `email`. The link returns to this
 * app's current address, which must be listed under Authentication →
 * URL Configuration → Redirect URLs in the Supabase dashboard
 * (otherwise Supabase falls back to the project's Site URL).
 */
export async function sendPasswordResetEmail(email: string) {
  const client = requireSupabase();
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  return client.auth.resetPasswordForEmail(email, { redirectTo });
}

/** Sets a new password for the currently signed-in person (used after opening a reset link). */
export async function updatePassword(newPassword: string) {
  const client = requireSupabase();
  const result = await client.auth.updateUser({ password: newPassword });
  if (!result.error) setRecoveryPending(false);
  return result;
}
