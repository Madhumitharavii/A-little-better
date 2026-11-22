import type { BookItem, LifeItem, MovieItem, WishItem } from '@/db/schema';

/**
 * Ideas for the "I'm bored" button. Personal ideas come from what's
 * already in the app — a film from the watchlist, a book from Want to
 * Read, an unticked vision goal or Someday Maybe item that could be
 * started today — mixed with a few general ones. Pure, so it's tested.
 */

export interface BoredIdea {
  key: string;
  icon: string;
  title: string;
  detail?: string;
  /** A movie or book to open, picked at random from `pool`. */
  pool?: LifeItem[];
  kind: 'movie' | 'book' | 'goal' | 'someday' | 'general';
  /** For goals and Someday items: the item itself. */
  item?: LifeItem;
}

export const GENERAL_IDEAS: { icon: string; title: string }[] = [
  { icon: '🎨', title: 'Doodle or paint on paper' },
  { icon: '🧼', title: 'Take a long warm bath' },
  { icon: '🌿', title: 'Go for a light 10-minute walk' },
  { icon: '💬', title: 'Message a friend you miss' },
  { icon: '📞', title: 'Call someone you love' },
  { icon: '🧹', title: 'Reset one small thing on your desk' },
  { icon: '🎵', title: 'Listen to an album start to finish' },
  { icon: '🍎', title: 'Eat a piece of fresh fruit slowly' },
  { icon: '🧘', title: 'Stretch for five minutes' },
  { icon: '☕', title: 'Make a warm drink and sit by a window' },
];

// Things that can be begun right now, at home, in a few minutes…
const STARTABLE = /\b(learn|learning|start|try|practi[sc]e|read|write|journal|journaling|draw|paint|doodle|play|code|coding|study|cook|bake|meditate|stretch|solve|knit|sew|sing|dance|exercise|skincare|declutter|decorate|organi[sz]e|save|plan|wake|eat|drink|run|walk|swim|sudoku|chess|guitar|piano|harmonica|ukulele|handstand|yoga|language|asl)\b/i;
// …versus things tied to a date, a place, other people, or months of work.
const LATER = /\b(trip|travel|visit|holiday|vacation|concert|festival|holi|diwali|christmas|wedding|tattoo|piercing|job|offer|interview|grades|reach \d|\d+\s?kg|buy|move to|road trip|hike|camp|campfire|karting|marathon|graduate|promotion|once|rain|snow)\b/i;

/** true = can be started today, false = needs a date/plan, null = can't tell from the words. */
export function startableByWords(title: string): boolean | null {
  if (LATER.test(title)) return false;
  if (STARTABLE.test(title)) return true;
  return null;
}

/** "Read 12 books" → 12. */
export function readingGoalTarget(title: string): number | null {
  const m = title.match(/\bread\b[^\d]{0,20}(\d{1,4})\s+books?\b/i) ?? title.match(/^(\d{1,4})\s+books?\b/i);
  return m ? Number(m[1]) : null;
}

export function buildPersonalIdeas(life: LifeItem[], year: number, aiStartable: Map<string, boolean> = new Map()): BoredIdea[] {
  const live = life.filter((i) => !i.deletedAt);
  const watchlist = live.filter((i): i is MovieItem => i.type === 'movie' && i.status === 'watchlist');
  const toRead = live.filter((i): i is BookItem => i.type === 'book' && i.status === 'wantTo');
  const wishes = live.filter((i): i is WishItem => i.type === 'wish' && !i.done && !i.missed);
  const vision = wishes.filter((w) => w.listType === 'annualVision' && (w.year ?? year) === year);
  const someday = wishes.filter((w) => (w.listType ?? 'somedayMaybe') === 'somedayMaybe');
  const readThisYear = live.filter((i) => i.type === 'book' && i.status === 'finished' && i.dateFinished?.startsWith(String(year))).length;

  const ideas: BoredIdea[] = [];
  if (watchlist.length) {
    ideas.push({ key: 'movie', kind: 'movie', icon: '🍿', title: 'Watch something from your watchlist', detail: `${watchlist.length.toLocaleString()} films are waiting. Here's one:`, pool: watchlist });
  }
  const readingGoal = vision.find((w) => readingGoalTarget(w.title));
  if (toRead.length) {
    const target = readingGoal ? readingGoalTarget(readingGoal.title)! : null;
    ideas.push({
      key: 'book',
      kind: 'book',
      icon: '📖',
      title: target ? 'Start a book today' : 'Start a book from your Want to Read',
      detail: target ? `You're at ${readThisYear} of ${target} for "${readingGoal!.title}". How about this one?` : `${toRead.length.toLocaleString()} books on your list. How about this one?`,
      pool: toRead,
    });
  }
  const canStart = (w: WishItem) => startableByWords(w.title) ?? aiStartable.get(w.title) ?? false;
  for (const w of vision) {
    if (w === readingGoal || !canStart(w)) continue;
    ideas.push({ key: `goal:${w.id}`, kind: 'goal', icon: '🌱', title: w.title, detail: `It's on your vision board for ${year} and not ticked yet. Why not start it today? Even ten minutes counts.`, item: w });
  }
  for (const w of someday) {
    if (!canStart(w)) continue;
    ideas.push({ key: `someday:${w.id}`, kind: 'someday', icon: '☁️', title: w.title, detail: "From your Someday, Maybe list. Today could be someday.", item: w });
  }
  return ideas;
}

/** Vision / Someday goals the words couldn't classify — for the on-device AI to decide. */
export function undecidedGoalTitles(life: LifeItem[], year: number): string[] {
  return life
    .filter((i): i is WishItem => i.type === 'wish' && !i.deletedAt && !i.done && !i.missed && (i.listType !== 'annualVision' || (i.year ?? year) === year))
    .map((w) => w.title)
    .filter((t) => startableByWords(t) === null && !readingGoalTarget(t));
}

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The order ideas are shown in: every idea once before any repeats.
 * Watchlist and book ideas lead, then personal and general ideas
 * alternate (two personal, one general) so it never feels generic.
 */
export function makeDeck(personal: BoredIdea[], rand: () => number = Math.random): BoredIdea[] {
  const general: BoredIdea[] = shuffle(GENERAL_IDEAS, rand).map((g) => ({ key: `general:${g.title}`, kind: 'general', icon: g.icon, title: g.title }));
  const lead = shuffle(personal.filter((p) => p.kind === 'movie' || p.kind === 'book'), rand);
  const rest = shuffle(personal.filter((p) => p.kind !== 'movie' && p.kind !== 'book'), rand);
  const deck: BoredIdea[] = [...lead];
  while (rest.length || general.length) {
    if (rest.length) deck.push(rest.shift()!);
    if (rest.length) deck.push(rest.shift()!);
    if (general.length) deck.push(general.shift()!);
  }
  return deck;
}
