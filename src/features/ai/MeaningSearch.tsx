import { useState } from 'react';
import { formatDisplayDate } from '@/shared/utils/formatDate';
import { searchByMeaning, useAiState } from './aiEngine';
import type { AiDocument } from './documents';
import type { Emotion } from './ml';
import type { SearchHit } from './searchRank';

const FEELING_WORD: Record<Emotion, string> = {
  sadness: 'sad',
  anxiety: 'anxious or stressed',
  anger: 'angry or frustrated',
  loneliness: 'lonely',
  tiredness: 'tired',
  joy: 'happy',
  calm: 'calm',
  gratitude: 'grateful',
};

const STRENGTH: Record<SearchHit<AiDocument>['strength'], { label: string; className: string }> = {
  strong: { label: 'Strong match', className: 'bg-sage-100 text-sage-700' },
  good: { label: 'Good match', className: 'bg-sand-100 text-sand-800' },
  related: { label: 'Related', className: 'bg-sand-50 text-sand-800/60' },
};

/** The matching sentence inside the entry's text, highlighted. */
function Snippet({ text, sentence }: { text: string; sentence?: string }) {
  const at = sentence ? text.indexOf(sentence) : -1;
  if (!sentence || at < 0) return <p className="text-[11px] text-sand-800/80 line-clamp-2">{text}</p>;
  const before = text.slice(Math.max(0, at - 80), at);
  const after = text.slice(at + sentence.length, at + sentence.length + 80);
  return (
    <p className="text-[11px] text-sand-800/80 leading-relaxed">
      {at > 80 && '…'}
      {before}
      <mark className="bg-terracotta-100 text-sand-900 rounded px-0.5">{sentence}</mark>
      {after}
      {at + sentence.length + 80 < text.length && '…'}
    </p>
  );
}

const SOURCE_LABEL: Record<AiDocument['source'], string> = {
  journal: '📝 Journal',
  reflection: '🌙 Reflection',
  life: '🌿 Life',
  study: '📚 Study',
};

/** Search everything written in the app by meaning — worked out on this device. */
export default function MeaningSearch() {
  const ai = useAiState();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit<AiDocument>[] | null>(null);
  const [feeling, setFeeling] = useState<Emotion | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const found = await searchByMeaning(query);
      setResults(found.hits);
      setFeeling(found.feeling);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-slate-100/70 p-5 sm:p-6 rounded-3xl border border-slate-500/20 shadow-sm space-y-3">
      <div>
        <h3 className="serif text-lg text-sand-900 font-semibold">🔎 Search by meaning</h3>
        <p className="text-[11px] text-sand-800/60">
          Find writing by what it's about, not exact words — across your journal, reflections, Life notes and study notes. Understood privately on this device.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          aria-label="Search by meaning"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'e.g. "times I felt anxious before exams"'}
          className="flex-1 min-w-0 p-2.5 bg-white border border-sand-200 rounded-xl text-xs text-sand-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !query.trim() || !ai.ready}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shrink-0"
        >
          {busy ? 'Thinking…' : 'Search'}
        </button>
      </form>
      {!ai.ready && <p className="text-[11px] text-sand-800/60">Getting ready — reading your entries on this device…</p>}
      {results &&
        (results.length === 0 ? (
          <p className="text-[11px] text-sand-800/60">Nothing close in meaning yet.</p>
        ) : (
          <ul className="space-y-2">
            {feeling && <li className="text-[11px] text-sand-800/60">Showing writing that sounds {FEELING_WORD[feeling]} — the closest first.</li>}
            {results.map(({ item, sentence, strength }) => (
              <li key={item.key} className="p-3 bg-white border border-sand-200 rounded-2xl space-y-1">
                <div className="flex items-center justify-between gap-2 text-[10px] text-sand-800/60">
                  <span>
                    {SOURCE_LABEL[item.source]} · {formatDisplayDate(item.date)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${STRENGTH[strength].className}`}>{STRENGTH[strength].label}</span>
                </div>
                <p className="text-xs font-semibold text-sand-900">{item.title}</p>
                <Snippet text={item.text} sentence={sentence} />
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
