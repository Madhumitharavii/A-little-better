import { cosine, predictSoftmax, type Emotion, type SoftmaxModel, type Vector } from './ml';

/**
 * Ranking for "Search by meaning". Two things make it work on real
 * writing:
 *  - Every sentence is compared on its own (not just the whole entry), so
 *    one sad line in a long, busy journal entry is still found.
 *  - When the search is about a feeling ("times I felt sad"), plain
 *    similarity isn't enough — "I felt fine" and "I felt sad" look alike
 *    to the model. So the trained emotion classifier also scores how much
 *    each sentence actually sounds like that feeling, and that counts for
 *    half.
 * Pure functions; the vectors come from the on-device model.
 */

const FEELING_WORDS: Record<Emotion, RegExp> = {
  sadness: /\b(sad|sadness|cry|cried|crying|tears?|sob(bing|bed)?|heartbr\w*|upset|down|low|depress\w*|miserable|unhappy|griev\w*|grief|hurt|broken|blue|gloomy|devastat\w*)\b/i,
  anxiety: /\b(anxious|anxiety|worr\w*|nervous|stress\w*|panic\w*|scared|afraid|fear\w*|overwhelm\w*|tense|on edge)\b/i,
  anger: /\b(angry|anger|mad|furious|annoy\w*|frustrat\w*|irritat\w*|rage|pissed)\b/i,
  loneliness: /\b(lonely|loneliness|alone|isolated|left out|miss(ed|ing)? (someone|people|home))\b/i,
  tiredness: /\b(tired|exhaust\w*|drained|sleepy|burn(t|ed) out|burnout|fatigue\w*|worn out)\b/i,
  joy: /\b(happy|happiness|joy\w*|excited|fun|laugh\w*|great day|delighted|cheerful|elated)\b/i,
  calm: /\b(calm|peace\w*|relax\w*|content\w*|serene|at ease)\b/i,
  gratitude: /\b(grateful|gratitude|thankful|thank(s|ful)|blessed|appreciat\w*)\b/i,
};

/** The feeling a search is about, if it's clearly about one. */
export function queryEmotion(query: string): Emotion | null {
  const found = (Object.keys(FEELING_WORDS) as Emotion[]).filter((e) => FEELING_WORDS[e].test(query));
  return found.length === 1 ? found[0] : null;
}

export interface SearchUnit {
  text: string;
  vector: Vector;
}

export interface SearchEntry<T> {
  item: T;
  /** The whole entry first, then its sentences (when it has more than one). */
  units: SearchUnit[];
}

export interface SearchHit<T> {
  item: T;
  score: number;
  /** The sentence that matched best, when it's one sentence of a longer entry. */
  sentence?: string;
  strength: 'strong' | 'good' | 'related';
}

const MIN_SCORE = 0.27;
/** For plain searches, only results reasonably close to the best one (a feeling search keeps everything that sounds like it). */
const WITHIN_OF_BEST = 0.22;

export function rankByMeaning<T>(
  query: Vector,
  entries: SearchEntry<T>[],
  head: SoftmaxModel,
  emotion: Emotion | null,
  k = 12,
): SearchHit<T>[] {
  const ei = emotion ? head.labels.indexOf(emotion) : -1;
  const hits = entries.map(({ item, units }) => {
    let best = -Infinity;
    let bestAt = 0;
    units.forEach((u, i) => {
      const sim = cosine(query, u.vector);
      const s = ei >= 0 ? 0.5 * sim + 0.5 * predictSoftmax(head, u.vector)[ei] : sim;
      if (s > best) {
        best = s;
        bestAt = i;
      }
    });
    return { item, score: best, sentence: bestAt > 0 ? units[bestAt].text : undefined };
  });
  const top = Math.max(0, ...hits.map((h) => h.score));
  return hits
    .filter((h) => h.score >= MIN_SCORE && (emotion || h.score >= top - WITHIN_OF_BEST))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((h) => ({ ...h, strength: h.score >= 0.5 ? 'strong' : h.score >= 0.38 ? 'good' : 'related' }));
}
