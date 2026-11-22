import StatsSection from './StatsSection';
import RemindersSection from './RemindersSection';
import PeriodSection from './period/PeriodSection';
import PeopleSection from '@/features/people/PeopleSection';
import EmotionTrendCard from '@/features/ai/EmotionTrendCard';

interface MePageProps {
  showToast: (msg: string) => void;
}

/** Personal things I come back to. App settings live behind the ⚙️ button (see SettingsPage). */
export default function MePage({ showToast }: MePageProps) {
  return (
    <div className="space-y-6">
      <section className="bg-white p-5 sm:p-8 rounded-3xl border border-sand-200 shadow-sm space-y-6">
        <div className="border-b border-sand-100 pb-3">
          <h2 className="serif text-2xl font-semibold text-sand-900">Take Care of Me</h2>
          <p className="text-xs text-sand-800/60">My people, my rhythms, and life patterns.</p>
        </div>

        <div className="space-y-4 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-4 xl:items-start">
          <PeopleSection showToast={showToast} />
          <RemindersSection />
          <PeriodSection showToast={showToast} />
          <EmotionTrendCard />
        </div>

        <StatsSection />
      </section>
    </div>
  );
}
