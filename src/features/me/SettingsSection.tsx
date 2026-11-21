import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, saveSettings } from '@/db/repositories/settingsRepository';
import type { AppSettings } from '@/db/schema';

const THEME_OPTIONS: Array<{ value: AppSettings['theme']; label: string }> = [
  { value: 'light', label: '☀️ Light' },
  { value: 'dark', label: '🌙 Dark' },
  { value: 'system', label: 'Match device' },
];

export default function SettingsSection() {
  const settings = useLiveQuery(() => getSettings(), []);

  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-100/70 rounded-2xl border border-slate-500/20 space-y-2.5">
        <div>
          <p className="font-semibold text-sand-900 text-xs">Appearance</p>
          <p className="text-[11px] text-sand-800/60">Light, dark, or follow your device's setting.</p>
        </div>
        <div role="radiogroup" aria-label="Appearance" className="flex bg-sand-100 p-1 rounded-xl text-[11px] font-medium">
          {THEME_OPTIONS.map((option) => {
            const selected = settings?.theme === option.value;
            return (
              <button
                key={option.value}
                role="radio"
                aria-checked={selected}
                onClick={() => settings && !selected && saveSettings({ theme: option.value })}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  selected ? 'bg-white shadow-sm font-semibold text-sand-900' : 'text-sand-800/70'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 bg-sage-100/50 rounded-2xl border border-sage-300/70 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-sand-900 text-xs">Sound Chimes</p>
          <p className="text-[11px] text-sand-800/60">Gentle sound feedback on completion (off by default)</p>
        </div>
        <button
          onClick={() => settings && saveSettings({ soundEnabled: !settings.soundEnabled })}
          className={`px-3 py-2 rounded-xl font-semibold text-xs shrink-0 transition-colors ${
            settings?.soundEnabled ? 'bg-sage-500 text-white' : 'bg-sand-200 text-sand-800'
          }`}
        >
          {settings?.soundEnabled ? 'Enabled' : 'Off'}
        </button>
      </div>
    </div>
  );
}
