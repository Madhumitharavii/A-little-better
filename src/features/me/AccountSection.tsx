import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { signUpWithEmail, signInWithEmail, signOut } from '@/lib/sync/authService';
import { runSync, subscribeSyncStatus, type SyncStatusInfo } from '@/lib/sync/syncEngine';
import { formatDisplayDate } from '@/shared/utils/formatDate';

/**
 * A small, peaceful account/sync section for Me — not a technical
 * dashboard. Sign in once per device with the same email/password
 * used everywhere else, and the same account's data becomes
 * available on every signed-in device automatically.
 */

const STATUS_COPY: Record<SyncStatusInfo['status'], string> = {
  not_configured: 'Sync not configured',
  signed_out: 'Not signed in',
  idle: 'Up to date',
  syncing: 'Syncing…',
  synced: 'Synced just now',
  offline: 'Offline — saved locally',
  error: 'Sync failed',
};

export default function AccountSection({ showToast }: { showToast: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatusInfo>({ status: isSupabaseConfigured ? 'signed_out' : 'not_configured' });

  useEffect(() => subscribeSyncStatus(setStatus), []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user) void runSync();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="p-3 bg-sand-50 rounded-2xl border border-sand-200">
        <p className="font-semibold text-sand-900 text-xs">🔗 Cross-device Sync</p>
        <p className="text-[11px] text-sand-800/60 mt-1">
          Sync not configured. Your data stays fully local and private on this device — see .env.example if you'd
          like to set up sync later.
        </p>
      </div>
    );
  }

  const handleAuth = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setAuthError(null);
    try {
      if (mode === 'signIn') {
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) throw error;
        showToast('Signed in ✨');
      } else {
        const { error } = await signUpWithEmail(email.trim(), password);
        if (error) throw error;
        showToast('Account created — check your email if confirmation is required.');
      }
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!userEmail) {
    return (
      <div className="p-3 bg-sand-50 rounded-2xl border border-sand-200 space-y-3">
        <div>
          <p className="font-semibold text-sand-900 text-xs">🔗 Cross-device Sync</p>
          <p className="text-[11px] text-sand-800/60 mt-1">
            Sign in once here and on your other device to keep the same data everywhere.
          </p>
        </div>

        <div className="flex bg-sand-100 p-1 rounded-xl text-[11px] font-medium">
          <button
            onClick={() => setMode('signIn')}
            className={`flex-1 py-1.5 rounded-lg ${mode === 'signIn' ? 'bg-white shadow-sm font-semibold text-sand-900' : 'text-sand-800/70'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signUp')}
            className={`flex-1 py-1.5 rounded-lg ${mode === 'signUp' ? 'bg-white shadow-sm font-semibold text-sand-900' : 'text-sand-800/70'}`}
          >
            Create Account
          </button>
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full p-2.5 bg-white border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full p-2.5 bg-white border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none"
        />

        {authError && <p className="text-[11px] text-terracotta-600 bg-terracotta-100 px-3 py-2 rounded-xl">{authError}</p>}

        <button
          onClick={handleAuth}
          disabled={busy || !email.trim() || !password}
          className="w-full py-2.5 bg-terracotta-400 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-semibold rounded-2xl"
        >
          {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Create Account'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 bg-sand-50 rounded-2xl border border-sand-200 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sand-900 text-xs">🔗 Cross-device Sync</p>
          <p className="text-[11px] text-sand-800/60 truncate">Signed in as {userEmail}</p>
        </div>
        <button
          onClick={async () => {
            await signOut();
            showToast('Signed out');
          }}
          className="px-2.5 py-1.5 bg-sand-200 hover:bg-sand-300 text-sand-900 rounded-lg font-semibold text-[11px] shrink-0"
        >
          Sign Out
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p
          className={`text-[11px] font-medium ${
            status.status === 'error'
              ? 'text-terracotta-600'
              : status.status === 'syncing'
                ? 'text-sand-800/70'
                : 'text-sage-700'
          }`}
        >
          {STATUS_COPY[status.status]}
          {status.status === 'synced' && status.lastSyncedAt ? ` · ${formatDisplayDate(status.lastSyncedAt.slice(0, 10))}` : ''}
        </p>
        <button
          onClick={() => runSync()}
          disabled={status.status === 'syncing'}
          className="px-2.5 py-1.5 bg-white hover:bg-sand-100 border border-sand-200 text-sand-800 rounded-lg font-semibold text-[11px] shrink-0 disabled:opacity-50"
        >
          Sync now
        </button>
      </div>
      {status.status === 'error' && status.errorMessage && (
        <p className="text-[10px] text-terracotta-600/80">{status.errorMessage}</p>
      )}
    </div>
  );
}
