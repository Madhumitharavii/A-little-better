import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

/**
 * Thin wrappers around Supabase Auth. Nothing in the app calls these
 * yet — this exists so a future "Connect sync" screen has a ready
 * foundation. Every function rejects with a clear message if
 * Supabase isn't configured, rather than throwing a confusing
 * "cannot read property of null" error.
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
