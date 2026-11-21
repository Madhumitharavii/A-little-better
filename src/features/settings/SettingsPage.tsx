import SettingsSection from '@/features/me/SettingsSection';
import AccountSection from '@/features/me/AccountSection';
import BackupSection from '@/features/me/BackupSection';
import OnDeviceAiSection from '@/features/ai/OnDeviceAiSection';

interface SettingsPageProps {
  showToast: (msg: string) => void;
  onBack: () => void;
}

/**
 * How the app itself behaves — opened from the ⚙️ button in the
 * header rather than a tab, since it's visited now and then, not daily.
 * Personal things (people, reminders, cycle, patterns) live on Me.
 */
export default function SettingsPage({ showToast, onBack }: SettingsPageProps) {
  return (
    <div className="space-y-6">
      <section className="bg-white p-5 sm:p-8 rounded-3xl border border-sand-200 shadow-sm space-y-6">
        <div className="border-b border-sand-100 pb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="serif text-2xl font-semibold text-sand-900">Settings</h2>
            <p className="text-xs text-sand-800/60">Appearance, on-device AI, sync, and your data.</p>
          </div>
          <button
            onClick={onBack}
            className="px-2.5 py-1.5 bg-sand-100 hover:bg-sand-200 text-sand-800 rounded-lg font-semibold text-[11px] shrink-0"
          >
            ← Back
          </button>
        </div>

        <div className="space-y-4">
          <SettingsSection />
          <OnDeviceAiSection />
          <AccountSection showToast={showToast} />
          <BackupSection showToast={showToast} />
        </div>
      </section>
    </div>
  );
}
