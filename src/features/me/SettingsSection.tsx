import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, saveSettings } from '@/db/repositories/settingsRepository';

export default function SettingsSection() {
  const settings = useLiveQuery(() => getSettings(), []);

  return (
    <div className="p-3 bg-sand-50 rounded-2xl border border-sand-200 flex items-center justify-between gap-3">
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
  );
}
