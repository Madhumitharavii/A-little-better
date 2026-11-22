import { useEffect, useMemo, useState } from 'react';
import Modal, { ModalHeader } from '@/shared/components/Modal';
import { useLifeRows } from '@/db/lifeStore';
import type { BookItem, LifeItem, MovieItem } from '@/db/schema';
import { openLifeItem } from '@/app/navigation';
import { startableByMeaning, useAiEnabled, useAiState } from '@/features/ai/aiEngine';
import { buildPersonalIdeas, makeDeck, undecidedGoalTitles, type BoredIdea } from '../boredIdeas';
import type { ReflectionToolProps } from '../types';

const pickFrom = <T,>(pool: T[], not?: T): T => {
  if (pool.length < 2) return pool[0];
  let next: T;
  do next = pool[Math.floor(Math.random() * pool.length)];
  while (next === not);
  return next;
};

const describe = (item: LifeItem) => {
  if (item.type === 'movie') return `${item.title}${(item as MovieItem).year ? ` (${(item as MovieItem).year})` : ''}`;
  if (item.type === 'book') return `${item.title}${(item as BookItem).author ? ` · ${(item as BookItem).author}` : ''}`;
  return item.title;
};

/** Where to read a quick gist of a film or book (opens in the browser; nothing is sent from the app). */
const gistUrl = (item: LifeItem) => {
  if (item.type === 'movie') return (item as MovieItem).letterboxdUri || `https://letterboxd.com/search/${encodeURIComponent(item.title)}/`;
  if (item.type === 'book') return `https://www.goodreads.com/search?q=${encodeURIComponent(`${item.title} ${(item as BookItem).author ?? ''}`.trim())}`;
  return undefined;
};

/**
 * "I'm bored" — instead of a feed, something you already wanted to do:
 * a film from your watchlist, a book from Want to Read, a vision goal or
 * Someday item you could start today, or a small kind thing. Every idea
 * shows once before any repeats. A pure redirect — nothing is saved.
 */
export default function BoredTool({ onClose, showToast }: ReflectionToolProps) {
  const life = useLifeRows<LifeItem>();
  const aiOn = useAiEnabled();
  const ai = useAiState();
  const year = new Date().getFullYear();

  // Goals the word rules can't place — the on-device AI decides (when it's on).
  const [aiStartable, setAiStartable] = useState<Map<string, boolean> | null>(null);
  useEffect(() => {
    if (!life) return;
    if (!aiOn || !ai.ready) {
      setAiStartable(new Map());
      return;
    }
    let live = true;
    startableByMeaning(undecidedGoalTitles(life, year))
      .then((m) => live && setAiStartable(m))
      .catch(() => live && setAiStartable(new Map()));
    return () => {
      live = false;
    };
  }, [life === undefined, aiOn, ai.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Built once per opening, so ideas don't reshuffle while you're looking.
  const built = useMemo(() => {
    if (!life || !aiStartable) return null;
    const deck: BoredIdea[] = makeDeck(buildPersonalIdeas(life as LifeItem[], year, aiStartable));
    const firstPicks: Record<string, LifeItem> = {};
    for (const idea of deck) if (idea.pool) firstPicks[idea.key] = pickFrom(idea.pool);
    return { deck, firstPicks };
  }, [life === undefined, aiStartable]); // eslint-disable-line react-hooks/exhaustive-deps
  const [position, setPosition] = useState(0);
  const [rerolled, setRerolled] = useState<Record<string, LifeItem>>({});

  if (!built) {
    return (
      <Modal onClose={onClose}>
        <ModalHeader icon="✨" title="I'm Bored" onClose={onClose} />
        <p className="text-xs text-sand-800/60 py-6 text-center">Finding something you'll like…</p>
      </Modal>
    );
  }

  const { deck, firstPicks } = built;
  const current = deck[position % deck.length];
  const pick = current.pool ? rerolled[current.key] ?? firstPicks[current.key] : undefined;
  const url = pick ? gistUrl(pick) : undefined;

  const next = () => setPosition((p) => p + 1);
  const anotherPick = () => current.pool && setRerolled((p) => ({ ...p, [current.key]: pickFrom(current.pool!, pick) }));
  const letsDoIt = () => {
    onClose();
    if (pick) {
      openLifeItem(pick.id);
      showToast(`Enjoy ${pick.title} 🌿`);
    } else if (current.kind === 'goal' || current.kind === 'someday') {
      showToast(`A small start on "${current.title}" today 🌱`);
    } else {
      showToast(`Enjoy: ${current.title} 🌿`);
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon="✨" title="I'm Bored" onClose={onClose} />

      <p className="text-xs text-sand-800 leading-relaxed">
        You already have things you love doing. Here's one, instead of opening a feed:
      </p>

      <div className="p-6 bg-sand-100/70 border border-sand-200 rounded-3xl text-center space-y-3">
        <span className="text-4xl block">{current.icon}</span>
        <p className="serif text-xl text-sand-900 font-semibold leading-snug">{current.title}</p>
        {current.detail && <p className="text-xs text-sand-800/70 leading-relaxed">{current.detail}</p>}
        {pick && (
          <div className="bg-sand-50 border border-sand-200 rounded-2xl px-4 py-3 space-y-1.5">
            <p className="text-sm font-semibold text-sand-900 leading-snug">{describe(pick)}</p>
            <div className="flex justify-center gap-4 text-[11px]">
              <button onClick={anotherPick} className="text-sand-800/70 hover:text-sand-900 underline underline-offset-2">
                Pick another
              </button>
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="text-sand-800/70 hover:text-sand-900 underline underline-offset-2">
                  What's it about? ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={letsDoIt}
          className="flex-1 py-3 bg-terracotta-400 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-2xl transition-all shadow-sm"
        >
          {pick ? (pick.type === 'movie' ? 'Open this film ✨' : 'Open this book ✨') : "Let's do it ✨"}
        </button>
        <button onClick={next} className="px-4 py-3 bg-sand-100 hover:bg-sand-200 text-sand-900 text-xs font-semibold rounded-2xl transition-all">
          Something else 🎲
        </button>
      </div>
    </Modal>
  );
}
