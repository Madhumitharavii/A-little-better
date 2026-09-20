import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, saveSettings } from '@/db/repositories/settingsRepository';
import { getNotificationPermission, requestNotificationPermission } from '@/shared/utils/reminders';

export default function RemindersSection() {
  const settings = useLiveQuery(() => getSettings(), []);
  const [permission, setPermission] = useState(getNotificationPermission());

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleEnablePermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  if (!settings) return null;

  return (
    <div className="p-3 bg-sand-50 rounded-2xl border border-sand-200 space-y-3">
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
    </div>
  );
}
