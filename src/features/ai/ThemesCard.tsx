import { useState } from 'react';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { useAiState } from './aiEngine';
import { MIN_DOCS_FOR_THEMES } from './analysis';

const MONTH = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });

/** Themes the on-device model finds in the journal and reflections (k-means on sentence embeddings). */
export default function ThemesCard() {
  const ai = useAiState();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="bg-sage-100/50 p-5 sm:p-6 rounded-3xl border border-sage-300/70 shadow-sm space-y-3">
      <div>
        <h3 className="serif text-lg text-sand-900 font-semibold">🧵 Your themes</h3>
        <p className="text-[11px] text-sand-800/60">What your writing keeps coming back to — grouped by meaning, on this device.</p>
      </div>
      {!ai.ready ? (
        <p className="text-[11px] text-sand-800/60">Getting ready…</p>
      ) : ai.themes.length === 0 ? (
        <p className="text-[11px] text-sand-800/60">
          Themes appear once there are at least {MIN_DOCS_FOR_THEMES} journal entries or reflections to compare.
        </p>
      ) : (
        <ul className="space-y-2">
          {ai.themes.map((theme) => {
            const max = Math.max(1, ...theme.months.map((m) => m.count));
            const isOpen = open === theme.name;
            return (
              <li key={theme.name} className="p-3 bg-white border border-sand-200 rounded-2xl space-y-2">
                <button onClick={() => setOpen(isOpen ? null : theme.name)} aria-expanded={isOpen} className="w-full text-left space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-sand-900">{theme.name}</p>
                      {theme.keywords.length > 0 && <p className="text-[10px] text-sand-800/60 truncate">{theme.keywords.join(' · ')}</p>}
                    </div>
                    <span className="text-[11px] text-sand-800/70 shrink-0">
                      {theme.docs.length} {theme.docs.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-8" aria-label={`Entries per month: ${theme.months.map((m) => `${MONTH(m.month)} ${m.count}`).join(', ')}`}>
                    {theme.months.map((m) => (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full bg-sage-300 rounded-sm" style={{ height: `${Math.max(2, (m.count / max) * 24)}px`, opacity: m.count ? 1 : 0.3 }} />
                        <span className="text-[8px] text-sand-800/50">{MONTH(m.month)}</span>
                      </div>
                    ))}
                  </div>
                </button>
                {isOpen && (
                  <ul className="space-y-1 border-t border-sand-100 pt-2">
                    {theme.docs.slice(0, 6).map((d) => (
                      <li key={d.key} className="text-[11px] text-sand-800/80">
                        <span className="text-sand-800/50">{formatDisplayDate(d.date)} · </span>
                        {d.title !== 'Journal entry' && d.title !== 'Daily reflection' ? <strong className="font-semibold">{d.title}: </strong> : null}
                        {d.text.slice(0, 90)}
                        {d.text.length > 90 ? '…' : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
