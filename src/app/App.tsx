import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TABS, type TabId } from './routes';
import { getSettings, saveSettings } from '@/db/repositories/settingsRepository';
import Toast from '@/shared/components/Toast';
import { useToast } from '@/shared/hooks/useToast';
import TodayPage from '@/features/today/TodayPage';
import JournalPage from '@/features/journal/JournalPage';
import MePage from '@/features/me/MePage';
import LifePage from '@/features/life/LifePage';
import WeekPage from '@/features/week/WeekPage';
import { checkReminders } from '@/shared/utils/reminders';
import { getLocalDateKey } from '@/db/dateUtils';
import { runSync } from '@/lib/sync/syncEngine';

const PILLARS = [
  { label: 'CARE', color: 'bg-sage-500' },
  { label: 'LOVE', color: 'bg-terracotta-400' },
  { label: 'REFLECT', color: 'bg-slate-500' },
  { label: 'GROW', color: 'bg-amber-500' },
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('today');
  const { toastMessage, showToast } = useToast();

  const settings = useLiveQuery(() => getSettings(), []);

  // Best-effort reminders: checked whenever the app is opened or
  // brought back to the foreground — see shared/utils/reminders.ts
  // for why this can't be a guaranteed background alarm yet.
  useEffect(() => {
    const runCheck = () => {
      if (document.visibilityState !== 'visible') return;
      getSettings().then((current) => {
        const result = checkReminders(current);
        const today = getLocalDateKey();
        if (result.nightFired) saveSettings({ lastNightReminderFiredDate: today });
        if (result.morningFired) saveSettings({ lastMorningReminderFiredDate: today });
        if (result.nightFallbackMessage) showToast(result.nightFallbackMessage);
        if (result.morningFallbackMessage) showToast(result.morningFallbackMessage);
      });
    };
    runCheck();
    document.addEventListener('visibilitychange', runCheck);
    return () => document.removeEventListener('visibilitychange', runCheck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatic cross-device sync. runSync() itself no-ops instantly
  // and safely if Supabase isn't configured, nobody's signed in, or
  // the device is offline — so it's always safe to call from here.
  // Fire-and-forget (never awaited in render) so this never blocks
  // the UI, and throttled so rapid foreground/online events in a
  // short span don't fire a burst of requests.
  useEffect(() => {
    let lastAttempt = 0;
    const MIN_INTERVAL_MS = 30_000;

    const attemptSync = () => {
      const now = Date.now();
      if (now - lastAttempt < MIN_INTERVAL_MS) return;
      lastAttempt = now;
      void runSync();
    };

    attemptSync(); // initial sync shortly after startup

    const onVisibility = () => {
      if (document.visibilityState === 'visible') attemptSync();
    };
    document.addEventListener('visibilitychange', onVisibility);

    window.addEventListener('online', attemptSync);

    // A gentle background heartbeat while the app stays open, so a
    // change made on another device shows up without needing to
    // background/foreground this one.
    const intervalId = window.setInterval(attemptSync, 60_000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', attemptSync);
      window.clearInterval(intervalId);
    };
  }, []);

  const toggleSound = async () => {
    if (!settings) return;
    const next = !settings.soundEnabled;
    await saveSettings({ soundEnabled: next });
    showToast(next ? 'Subtle chimes enabled 🔔' : 'Sound turned off 🔇');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16 min-h-screen">
      <header className="pb-6 border-b border-sand-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-terracotta-400/10 flex items-center justify-center text-terracotta-600 text-xl font-bold">
              🍃
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-sand-900 tracking-tight">
                A Little Better
              </h1>
              <p className="text-[11px] text-sand-800/70 font-medium tracking-wide uppercase">
                Private Life-Care Space
              </p>
            </div>
          </div>

          <nav className="flex items-center bg-sand-100 p-1 rounded-2xl text-xs font-medium text-sand-800 flex-wrap">
            {TABS.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.implemented) {
                      setCurrentTab(tab.id);
                    } else {
                      showToast(`The '${tab.label}' sanctuary is being prepared.`);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl capitalize transition-all ${
                    isActive
                      ? 'bg-white text-sand-900 shadow-sm font-semibold'
                      : tab.implemented
                        ? 'hover:text-sand-900 text-sand-800/80'
                        : 'text-sand-800/40 cursor-not-allowed'
                  }`}
                >
                  {tab.label}
                  {!tab.implemented && <span className="ml-1 text-[8px] opacity-40">•</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-[11px] text-sand-800/70 font-medium border-t border-sand-100 pt-3">
          <div className="flex items-center gap-4">
            {PILLARS.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${p.color}`}></span> {p.label}
              </span>
            ))}
          </div>

          <button
            onClick={toggleSound}
            className="text-[11px] text-sand-800/60 hover:text-sand-900 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sand-100/60 transition-colors"
          >
            <span>{settings?.soundEnabled ? '🔔 Chimes On' : '🔇 Quiet Mode'}</span>
          </button>
        </div>
      </header>

      <Toast message={toastMessage} />

      <main className="mt-8">
        {currentTab === 'today' && <TodayPage showToast={showToast} soundEnabled={!!settings?.soundEnabled} />}
        {currentTab === 'week' && <WeekPage />}
        {currentTab === 'life' && <LifePage showToast={showToast} />}
        {currentTab === 'journal' && <JournalPage showToast={showToast} />}
        {currentTab === 'me' && <MePage showToast={showToast} />}
      </main>

      <footer className="mt-16 pt-6 border-t border-sand-200 text-center text-xs text-sand-800/60 space-y-1">
        <p className="font-serif italic text-sand-800/80">"Don't optimize your life. Take care of it."</p>
        <p className="text-[11px] text-sand-800/50">Your little corner of the internet. Your data stays on this device.</p>
      </footer>
    </div>
  );
}
