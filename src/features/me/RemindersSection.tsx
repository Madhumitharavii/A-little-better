import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, saveSettings } from '@/db/repositories/settingsRepository';
import { getNotificationPermission, requestNotificationPermission } from '@/shared/utils/reminders';
import { readWaterPrefs, saveWaterPrefs, WATER_DEFAULTS, type WaterPrefs } from '@/lib/water';
import { MEAL_DEFAULTS, readMealPrefs, saveMealPrefs, type MealPrefs } from '@/lib/mealReminders';

const WATER_EVERY = [30, 45, 60, 90, 120];

export default function RemindersSection() {
  const settings = useLiveQuery(() => getSettings(), []);
  const [permission, setPermission] = useState(getNotificationPermission());
  const [water, setWater] = useState<WaterPrefs>(WATER_DEFAULTS);
  const [meals, setMeals] = useState<MealPrefs>(MEAL_DEFAULTS);
  useEffect(() => {
    void readWaterPrefs().then(setWater);
    void readMealPrefs().then(setMeals);
  }, []);
  const toggleMeals = () => {
    const next = { ...meals, enabled: !meals.enabled };
    setMeals(next);
    void saveMealPrefs(next);
  };
  const changeWater = (patch: Partial<WaterPrefs>) => {
    const next = { ...water, ...patch };
    setWater(next);
    void saveWaterPrefs(next);
  };

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleEnablePermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  if (!settings) return null;

  return (
    <div className="p-3 bg-slate-100/70 rounded-2xl border border-slate-500/20 space-y-3">
      <div>
        <p className="font-semibold text-sand-900 text-xs">🔔 Reminders</p>
        <p className="text-[11px] text-sand-800/60">
          Best-effort, local only — these check in when you open the app, not a guaranteed wake-up alarm. For a
          reliable alarm, your phone's built-in clock is still the safer bet for now.
        </p>
      </div>

      {permission !== 'granted' && permission !== 'unsupported' && (
        <button
          onClick={handleEnablePermission}
          className="w-full py-2 bg-sand-200 hover:bg-sand-300 text-sand-900 rounded-xl font-semibold text-xs"
        >
          Allow notifications for reminders
        </button>
      )}
      {permission === 'unsupported' && (
        <p className="text-[11px] text-sand-800/50">Notifications aren't supported in this browser — reminders will still appear as an in-app message instead.</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-sand-900">🌙 Wind-down reminder</p>
          <p className="text-[10px] text-sand-800/60">A nudge to start easing toward sleep.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            aria-label="Wind-down reminder time"
            type="time"
            value={settings.nightReminderTime ?? '22:30'}
            onChange={(e) => saveSettings({ nightReminderTime: e.target.value })}
            disabled={!settings.nightReminderEnabled}
            className="text-xs p-1.5 bg-white border border-sand-200 rounded-lg disabled:opacity-50"
          />
          <button
            onClick={() => saveSettings({ nightReminderEnabled: !settings.nightReminderEnabled })}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
              settings.nightReminderEnabled ? 'bg-sage-500 text-white' : 'bg-sand-200 text-sand-800'
            }`}
          >
            {settings.nightReminderEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-sand-900">☀️ Get-up reminder</p>
          <p className="text-[10px] text-sand-800/60">For when snoozing keeps winning.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            aria-label="Get-up reminder time"
            type="time"
            value={settings.morningReminderTime ?? '07:00'}
            onChange={(e) => saveSettings({ morningReminderTime: e.target.value })}
            disabled={!settings.morningReminderEnabled}
            className="text-xs p-1.5 bg-white border border-sand-200 rounded-lg disabled:opacity-50"
          />
          <button
            onClick={() => saveSettings({ morningReminderEnabled: !settings.morningReminderEnabled })}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
              settings.morningReminderEnabled ? 'bg-sage-500 text-white' : 'bg-sand-200 text-sand-800'
            }`}
          >
            {settings.morningReminderEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-sand-900">💧 Drink water</p>
            <p className="text-[10px] text-sand-800/60">When you open the app, then every so often while it’s open.</p>
          </div>
          <button
            onClick={() => changeWater({ enabled: !water.enabled })}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${water.enabled ? 'bg-sage-500 text-white' : 'bg-sand-200 text-sand-800'}`}
          >
            {water.enabled ? 'On' : 'Off'}
          </button>
        </div>
        {water.enabled && (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-sand-800/80">
            <span>Every</span>
            <select
              aria-label="How often to remind you to drink water"
              value={water.everyMinutes}
              onChange={(e) => changeWater({ everyMinutes: Number(e.target.value) })}
              className="text-xs p-1.5 bg-white border border-sand-200 rounded-lg"
            >
              {WATER_EVERY.map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : m === 60 ? '1 hour' : `${m / 60} hours`}
                </option>
              ))}
            </select>
            <span>between</span>
            <input
              aria-label="Water reminders from"
              type="time"
              value={water.from}
              onChange={(e) => e.target.value && changeWater({ from: e.target.value })}
              className="text-xs p-1.5 bg-white border border-sand-200 rounded-lg"
            />
            <span>and</span>
            <input
              aria-label="Water reminders until"
              type="time"
              value={water.until}
              onChange={(e) => e.target.value && changeWater({ until: e.target.value })}
              className="text-xs p-1.5 bg-white border border-sand-200 rounded-lg"
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-sand-900">🍳 Meals</p>
          <p className="text-[10px] text-sand-800/60">
            If breakfast isn’t marked by 9:30, lunch by 2, dinner by 8:30 — and an evening nudge when breakfast keeps getting skipped.
          </p>
        </div>
        <button
          onClick={toggleMeals}
          className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${meals.enabled ? 'bg-sage-500 text-white' : 'bg-sand-200 text-sand-800'}`}
        >
          {meals.enabled ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}
