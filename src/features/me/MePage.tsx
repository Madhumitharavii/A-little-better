import SettingsSection from './SettingsSection';
import BackupSection from './BackupSection';
import StatsSection from './StatsSection';
import RemindersSection from './RemindersSection';
import PeriodSection from './period/PeriodSection';
import AccountSection from './AccountSection';

interface MePageProps {
  showToast: (msg: string) => void;
}

export default function MePage({ showToast }: MePageProps) {
  return (
    <div className="space-y-6">
      <section className="bg-white p-5 sm:p-8 rounded-3xl border border-sand-200 shadow-sm space-y-6">
        <div className="border-b border-sand-100 pb-3">
          <h2 className="serif text-2xl font-semibold text-sand-900">Take Care of Me</h2>
          <p className="text-xs text-sand-800/60">Preferences, private local data, and life patterns.</p>
        </div>

        <div className="space-y-4">
          <SettingsSection />
          <RemindersSection />
          <PeriodSection showToast={showToast} />
          <BackupSection showToast={showToast} />
          <AccountSection showToast={showToast} />
        </div>

        <StatsSection />
      </section>
    </div>
  );
}
