import { useState } from 'react';
import type { Insight } from './rules';

const KIND_STYLE: Record<Insight['kind'], string> = {
  kudos: 'bg-sage-100 border-sage-300',
  nudge: 'bg-sand-50 border-sand-200',
  care: 'bg-terracotta-100/60 border-terracotta-400/30',
};

/** The advice itself (or a gentle empty state), with Because lines and Thanks / Not helpful. */
export default function AdviceList({
  picks,
  hasAnyData,
  onNotHelpful,
}: {
  picks: Insight[];
  hasAnyData: boolean;
  onNotHelpful: (insight: Insight) => void;
}) {
  const [thanked, setThanked] = useState<string | null>(null);

  if (picks.length === 0) {
    return (
      <p className="text-xs text-sand-800/60 bg-sand-50 border border-sand-200 rounded-2xl px-4 py-3">
        {hasAnyData
          ? "Nothing new to suggest today — you're doing just fine. Check back tomorrow."
          : "As you log your books, shows, art, experiences, study, journal and people, I'll start noticing patterns and offering gentle advice here."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {picks.map((insight) => (
        <li key={insight.key} className={`p-4 rounded-2xl border space-y-2 ${KIND_STYLE[insight.kind]}`}>
          <p className="text-sm text-sand-900 flex gap-2.5">
            <span aria-hidden="true" className="shrink-0">
              {insight.icon}
            </span>
            <span>{insight.message}</span>
          </p>
          <p className="text-[11px] text-sand-800/60 pl-7">Because: {insight.because}</p>
          <div className="flex gap-2 pl-7">
            {thanked === insight.key ? (
              <span className="text-[11px] text-sage-700 font-medium">Glad it helped 🌿</span>
            ) : (
              <button onClick={() => setThanked(insight.key)} className="text-[11px] font-semibold text-sand-800/70 hover:text-sand-900">
                Thanks
              </button>
            )}
            <span className="text-sand-800/30" aria-hidden="true">
              ·
            </span>
            <button onClick={() => onNotHelpful(insight)} className="text-[11px] font-semibold text-sand-800/50 hover:text-sand-900">
              Not helpful
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
