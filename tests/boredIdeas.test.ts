import { describe, it, expect } from 'vitest';
import { buildPersonalIdeas, makeDeck, startableByWords, undecidedGoalTitles, GENERAL_IDEAS } from '@/features/toolbox/boredIdeas';
import { seededRandom } from '@/features/ai/ml';
import type { LifeItem } from '@/db/schema';

// Made-up library — no real data in tests.
const t = 'x';
const life = [
  { id: 'm1', type: 'movie', title: 'Film A', status: 'watchlist', createdAt: t, updatedAt: t },
  { id: 'm2', type: 'movie', title: 'Film B', status: 'watched', createdAt: t, updatedAt: t },
  { id: 'b1', type: 'book', title: 'Book A', status: 'wantTo', createdAt: t, updatedAt: t },
  { id: 'b2', type: 'book', title: 'Book B', status: 'finished', dateFinished: '2026-02-01', createdAt: t, updatedAt: t },
  { id: 'g1', type: 'wish', listType: 'annualVision', year: 2026, title: 'Read 12 books', createdAt: t, updatedAt: t },
  { id: 'g2', type: 'wish', listType: 'annualVision', year: 2026, title: 'Learn to bake bread', createdAt: t, updatedAt: t },
  { id: 'g3', type: 'wish', listType: 'annualVision', year: 2026, title: 'Go to a music festival', createdAt: t, updatedAt: t },
  { id: 'g4', type: 'wish', listType: 'annualVision', year: 2026, title: 'Learn to knit', done: true, createdAt: t, updatedAt: t },
  { id: 'g5', type: 'wish', listType: 'annualVision', year: 2026, title: 'Try calligraphy', missed: true, createdAt: t, updatedAt: t },
  { id: 'g6', type: 'wish', listType: 'annualVision', year: 2026, title: 'Make a scrapbook', createdAt: t, updatedAt: t },
  { id: 's1', type: 'wish', listType: 'somedayMaybe', title: 'Start a podcast', createdAt: t, updatedAt: t },
] as LifeItem[];

describe("I'm bored ideas", () => {
  it('tells startable goals from ones that need a date or a plan', () => {
    expect(startableByWords('Learn to bake bread')).toBe(true);
    expect(startableByWords('Go to a music festival')).toBe(false);
    expect(startableByWords('Book a solo trip')).toBe(false);
    expect(startableByWords('Make a scrapbook')).toBeNull();
  });

  it('builds ideas from the watchlist, want-to-read, the reading goal and startable goals', () => {
    const ideas = buildPersonalIdeas(life, 2026);
    expect(ideas.map((i) => i.key)).toEqual(['movie', 'book', 'goal:g2', 'someday:s1']);
    expect(ideas[0].pool!.map((m) => m.id)).toEqual(['m1']);
    expect(ideas[1].detail).toContain('1 of 12');
  });

  it('lets the on-device AI decide goals the words cannot', () => {
    expect(undecidedGoalTitles(life, 2026)).toEqual(['Make a scrapbook']);
    const ideas = buildPersonalIdeas(life, 2026, new Map([['Make a scrapbook', true]]));
    expect(ideas.map((i) => i.key)).toContain('goal:g6');
  });

  it('shows every idea once before anything repeats, personal first', () => {
    const personal = buildPersonalIdeas(life, 2026);
    const deck = makeDeck(personal, seededRandom(3));
    expect(deck).toHaveLength(personal.length + GENERAL_IDEAS.length);
    expect(new Set(deck.map((d) => d.key)).size).toBe(deck.length);
    expect(['movie', 'book']).toContain(deck[0].kind);
  });
});
