import { useAiEnabled } from './aiEngine';
import MeaningSearch from './MeaningSearch';
import ThemesCard from './ThemesCard';

/** On-device AI tools shown on the Journal page (or a short pointer to turn them on). */
export default function AiJournalTools() {
  const enabled = useAiEnabled();
  if (!enabled) {
    return (
      <p className="text-[11px] text-sand-800/60 bg-slate-100/60 border border-slate-500/20 rounded-2xl px-4 py-3">
        🧠 Turn on <strong>On-device AI</strong> in ⚙️ Settings to search your writing by meaning and see your themes — all worked out privately on this device.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <MeaningSearch />
      <ThemesCard />
    </div>
  );
}
