import { useState } from 'react';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { useAiState } from './aiEngine';
import { MIN_DOCS_FOR_THEMES } from './analysis';
import type { JournalTheme } from './analysis';

const MONTH_LETTER = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });

/** A little picture for each theme name the model can give (see THEME_NAMES in ml.ts). */
const THEME_EMOJI: Record<string, string> = {
  'Studies & exams': '📚',
  'Languages & learning': '🗣️',
  'Research & lab work': '🔬',
  'Work & career': '💼',
  Family: '🏡',
  'Friends & social life': '🫶',
  'Love & relationships': '💞',
  'Health & exercise': '🌿',
  'Nature & the outdoors': '🌳',
  'Food & cooking': '🍲',
  'Rest & sleep': '😴',
  'Stress & worries': '🌧️',
  'Sadness & hard days': '🫧',
  'Joy & small wins': '🌼',
  Gratitude: '🙏',
  'Creativity & art': '🎨',
  'Books & stories': '📖',
  'Movies & shows': '🎬',
  'Travel & adventures': '🧭',
  'Money & plans': '🪙',
  'Self-reflection & growth': '🌱',
};

/** Soft colours, one per card in turn. `bead` colours the thread via currentColor. */
const TINTS = [
  { card: 'bg-sage-100/70 border-sage-300/70', bead: 'text-sage-500', pill: 'bg-sand-50/70 text-sage-700' },
  { card: 'bg-terracotta-100/60 border-terracotta-400/30', bead: 'text-terracotta-400', pill: 'bg-sand-50/70 text-terracotta-600' },
  { card: 'bg-slate-100 border-slate-500/20', bead: 'text-slate-500', pill: 'bg-sand-50/70 text-slate-800' },
];

/** The months as beads on a thread: the more you wrote about it that month, the bigger the bead. */
function Thread({ theme, bead }: { theme: JournalTheme; bead: string }) {
  const max = Math.max(1, ...theme.months.map((m) => m.count));
  return (
    <div aria-label={`By month: ${theme.months.map((m) => `${MONTH_LETTER(m.month)} ${m.count}`).join(', ')}`} className={bead}>
      <div className="relative h-7">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 240 28" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 14 Q20 6 40 14 T80 14 T120 14 T160 14 T200 14 T240 14" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        </svg>
        <div className="relative grid grid-cols-6 h-full">
          {theme.months.map((m) => {
            const size = m.count ? 8 + Math.round((m.count / max) * 12) : 5;
            return (
              <div key={m.month} className="flex items-center justify-center">
                <span className="rounded-full bg-current" style={{ width: size, height: size, opacity: m.count ? 1 : 0.3 }} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-6 text-center">
        {theme.months.map((m) => (
          <span key={m.month} className={`text-[9px] ${m.count ? 'text-sand-800/70 font-semibold' : 'text-sand-800/40'}`}>
            {MONTH_LETTER(m.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Themes the on-device model finds in the journal and reflections (k-means on sentence embeddings). */
export default function ThemesCard() {
  const ai = useAiState();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="bg-white p-5 sm:p-6 rounded-3xl border border-sand-200 shadow-sm space-y-4">
      <div>
        <h3 className="serif text-lg text-sand-900 font-semibold">🧵 Your themes</h3>
        <p className="text-[11px] text-sand-800/60">What your writing keeps coming back to — gathered quietly, on this device.</p>
      </div>
      {!ai.ready ? (
        <p className="text-[11px] text-sand-800/60">Getting ready…</p>
      ) : ai.themes.length === 0 ? (
        <p className="text-[11px] text-sand-800/60">
          Themes appear once there are at least {MIN_DOCS_FOR_THEMES} journal entries or reflections to compare.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
          {ai.themes.map((theme, i) => {
            const tint = TINTS[i % TINTS.length];
            const isOpen = open === theme.name;
            const times = theme.docs.length;
            return (
              <li key={theme.name} className={`p-4 rounded-3xl border ${tint.card} space-y-3`}>
                <button onClick={() => setOpen(isOpen ? null : theme.name)} aria-expanded={isOpen} className="w-full text-left space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 shrink-0 rounded-2xl bg-sand-50/70 flex items-center justify-center text-2xl" aria-hidden="true">
                      {THEME_EMOJI[theme.name] ?? '🧵'}
                    </span>
                    <div className="min-w-0">
                      <p className="serif text-base font-semibold text-sand-900 leading-tight">{theme.name}</p>
                      <p className="text-[11px] text-sand-800/60">
                        came up {times === 1 ? 'once' : times === 2 ? 'twice' : `${times} times`}
                      </p>
                    </div>
                  </div>
                  {theme.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {theme.keywords.map((k) => (
                        <span key={k} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tint.pill}`}>
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                  <Thread theme={theme} bead={tint.bead} />
                  <p className="text-[10px] text-sand-800/50">{isOpen ? 'Hide the moments ⌃' : 'See the moments ⌄'}</p>
                </button>
                {isOpen && (
                  <ul className="space-y-1.5 border-t border-sand-800/10 pt-2">
                    {theme.docs.slice(0, 6).map((d) => (
                      <li key={d.key} className="text-[11px] text-sand-800/80 leading-relaxed">
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
