import type { ReactNode } from 'react';
import { useAiEnabled } from './aiEngine';
import MeaningSearch from './MeaningSearch';
import ThemesCard from './ThemesCard';

/**
 * The top of the Journal page: search by meaning with `beside` (letters to
 * future me) next to it on wide screens, then your themes across the full width.
 * Without on-device AI, a short pointer to turn it on takes the search's place.
 */
export default function AiJournalTools({ beside }: { beside?: ReactNode }) {
  const enabled = useAiEnabled();
  return (
    <div className="space-y-4">
      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4">
        <div className="lg:col-span-2">
          {enabled ? (
            <MeaningSearch />
          ) : (
            <p className="text-[11px] text-sand-800/60 bg-slate-100/60 border border-slate-500/20 rounded-2xl px-4 py-3">
              🧠 Turn on <strong>On-device AI</strong> in ⚙️ Settings to search your writing by meaning and see your themes — all worked out privately on this
              device.
            </p>
          )}
        </div>
        {beside}
      </div>
      {enabled && <ThemesCard />}
    </div>
  );
}
