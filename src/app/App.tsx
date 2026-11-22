import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TABS, type TabId } from './routes';
import { getSettings, saveSettings } from '@/db/repositories/settingsRepository';
import Toast from '@/shared/components/Toast';
import { useToast } from '@/shared/hooks/useToast';
import TodayPage from '@/features/today/TodayPage';
import JournalPage from '@/features/journal/JournalPage';
import MePage from '@/features/me/MePage';
import SettingsPage from '@/features/settings/SettingsPage';
import StudyTimerPill from '@/features/study/StudyTimerPill';
import NoticedButton from '@/features/advisor/NoticedButton';
import { useAiBackground } from '@/features/ai/aiEngine';
import LifePage from '@/features/life/LifePage';
import WeekPage from '@/features/week/WeekPage';
import { checkReminders } from '@/shared/utils/reminders';
import { getLocalDateKey } from '@/db/dateUtils';
import { runSync } from '@/lib/sync/syncEngine';
import { subscribePasswordRecovery } from '@/lib/sync/authService';
import { applyTheme, onSystemThemeChange } from '@/shared/utils/theme';
import { onOpenLifeItem } from './navigation';


export default function App() {
  // The five tabs, plus Settings (opened from the ⚙️ button, not a tab).
  const [currentTab, setCurrentTab] = useState<TabId | 'settings'>('today');
  // Where ← Back on Settings returns to.
  const [lastTab, setLastTab] = useState<TabId>('today');
  const { toastMessage, showToast } = useToast();
  // A Life item another screen asked to open (e.g. a film picked by "I'm bored").
  const [lifeItemToOpen, setLifeItemToOpen] = useState<string | null>(null);
  useEffect(
    () =>
      onOpenLifeItem((id) => {
        setLifeItemToOpen(id);
        setCurrentTab('life');
      }),
    [],
  );

  const settings = useLiveQuery(() => getSettings(), []);

  // On-device AI (opt-in): keeps embeddings and analysis fresh in the background.
  useAiBackground();

  // Light / dark / match device (Me → Appearance). Re-applied when the
  // device itself switches, for the "match device" choice.
  const themeChoice = settings?.theme;
  useEffect(() => {
    if (!settings) return;
    applyTheme(themeChoice);
    return onSystemThemeChange(() => applyTheme(themeChoice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeChoice, !!settings]);

  // Opening a password-reset email link lands on the app's home page;
  // jump straight to Settings, where the "Set a new password" form appears.
  useEffect(
    () =>
      subscribePasswordRecovery((pending) => {
        if (pending) setCurrentTab('settings');
      }),
    [],
  );

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

  const goTo = (tab: TabId) => {
    setCurrentTab(tab);
    setLastTab(tab);
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* Wide windows (Mac, tablet landscape): navigation in a sidebar on the left. */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-sand-200 px-5 py-7 gap-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-terracotta-400/10 flex items-center justify-center text-xl">🍃</div>
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold text-sand-900 tracking-tight leading-tight">A Little Better</p>
            <p className="text-[10px] text-sand-800/70 italic font-serif leading-snug">Don't optimize your life. Take care of it.</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 text-sm font-medium" aria-label="Sections">
          {TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => goTo(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`text-left px-3 py-2.5 rounded-xl transition-all ${
                  isActive ? 'bg-terracotta-100/70 text-terracotta-600 font-semibold' : 'text-sand-800/80 hover:bg-sand-100 hover:text-sand-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2">
          <NoticedButton />
          <StudyTimerPill onOpen={() => goTo('week')} />
        </div>

        <div className="mt-auto flex flex-col gap-1.5 text-xs">
          <button
            onClick={toggleSound}
            className="text-left text-terracotta-600 hover:text-terracotta-600/80 font-semibold px-3 py-2 rounded-xl bg-terracotta-100/70 transition-colors"
          >
            {settings?.soundEnabled ? '🔔 Chimes On' : '🔇 Quiet Mode'}
          </button>
          <button
            onClick={() => setCurrentTab(currentTab === 'settings' ? lastTab : 'settings')}
            aria-pressed={currentTab === 'settings'}
            className={`text-left px-3 py-2 rounded-xl transition-colors ${
              currentTab === 'settings' ? 'bg-sand-100 text-sand-900 font-semibold' : 'bg-slate-100 text-slate-800 hover:text-slate-900'
            }`}
          >
            <span aria-hidden="true">⚙️</span> Settings
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
    <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-16">
      {/* Phones and narrow windows: the header with tabs on top. */}
      <header className="pb-6 border-b border-sand-200 lg:hidden">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-terracotta-400/10 flex items-center justify-center text-terracotta-600 text-xl font-bold">
              🍃
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-sand-900 tracking-tight">
                A Little Better
              </h1>
              <p className="text-[11px] text-sand-800/70 font-medium italic font-serif">
                Don't optimize your life. Take care of it.
              </p>
            </div>
          </div>

          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-medium text-sand-800 flex-wrap">
            {TABS.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.implemented) {
                      setCurrentTab(tab.id);
                      setLastTab(tab.id);
                    } else {
                      showToast(`The '${tab.label}' sanctuary is being prepared.`);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl capitalize transition-all ${
                    isActive
                      ? 'bg-white text-terracotta-600 shadow-sm font-semibold'
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
          {/* Today's advice from any tab — with a dot when there's something new. */}
          <NoticedButton />

          <div className="flex items-center gap-1.5 flex-wrap">
            <StudyTimerPill
              onOpen={() => {
                setCurrentTab('week');
                setLastTab('week');
              }}
            />
            <button
              onClick={toggleSound}
              className="text-[11px] text-terracotta-600 hover:text-terracotta-600/80 font-semibold flex items-center gap-1 px-2 py-0.5 rounded-lg bg-terracotta-100/70 transition-colors"
            >
              <span>{settings?.soundEnabled ? '🔔 Chimes On' : '🔇 Quiet Mode'}</span>
            </button>
            <button
              onClick={() => setCurrentTab(currentTab === 'settings' ? lastTab : 'settings')}
              aria-pressed={currentTab === 'settings'}
              className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-lg transition-colors ${
                currentTab === 'settings'
                  ? 'bg-white shadow-sm text-sand-900 font-semibold'
                  : 'bg-slate-100 text-slate-800 hover:text-slate-900'
              }`}
            >
              <span aria-hidden="true">⚙️</span> Settings
            </button>
          </div>
        </div>
      </header>

      <Toast message={toastMessage} />

      <main className="mt-8 lg:mt-0">
        {currentTab === 'today' && <TodayPage showToast={showToast} soundEnabled={!!settings?.soundEnabled} />}
        {currentTab === 'week' && <WeekPage showToast={showToast} />}
        {currentTab === 'life' && <LifePage showToast={showToast} openItemId={lifeItemToOpen} onOpenedItem={() => setLifeItemToOpen(null)} />}
        {currentTab === 'journal' && <JournalPage showToast={showToast} />}
        {currentTab === 'me' && <MePage showToast={showToast} />}
        {currentTab === 'settings' && <SettingsPage showToast={showToast} onBack={() => setCurrentTab(lastTab)} />}
      </main>
    </div>
      </div>
    </div>
  );
}
