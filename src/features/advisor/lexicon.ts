/**
 * A tiny on-device "reader" for journal entries and reflections.
 *
 * No AI model and nothing leaves the device: it just looks for words
 * that point to a few themes, so the advisor can say things like
 * "you've written about feeling tired a few times this week".
 */

export type Theme = 'tired' | 'stressed' | 'low' | 'lonely' | 'happy' | 'grateful' | 'study' | 'heavy';

const THEME_WORDS: Record<Theme, string[]> = {
  tired: ['tired', 'exhausted', 'sleepy', 'drained', 'no energy', 'worn out', 'fatigue', "couldn't sleep", 'insomnia', 'burnt out', 'burned out'],
  stressed: ['stress', 'stressed', 'anxious', 'anxiety', 'overwhelmed', 'pressure', 'panic', 'nervous', 'worried', 'worry', 'tense', 'deadline'],
  low: ['sad', 'cried', 'crying', 'cry', 'upset', 'unhappy', 'disappointed', 'sucks', 'awful', 'terrible', 'hurt', 'miserable'],
  lonely: ['lonely', 'alone', 'isolated', 'left out', 'miss them', 'missing them', 'no friends'],
  happy: ['happy', 'joy', 'excited', 'fun', 'great day', 'amazing', 'wonderful', 'laughed', 'proud', 'loved it', 'grateful', 'good day'],
  grateful: ['thankful', 'grateful', 'blessed', 'appreciate', 'lucky'],
  study: ['study', 'studying', 'exam', 'exams', 'assignment', 'thesis', 'lecture', 'class', 'course', 'research', 'project', 'semester', 'paper'],
  // Words that suggest someone is carrying something very heavy. The
  // advisor answers these only with gentle support — never advice.
  heavy: ['hopeless', "can't go on", 'cant go on', 'give up on everything', 'want to disappear', 'no point', 'worthless', 'hurt myself', 'end it all'],
};

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ')} `;
}

const NEGATIONS = [" not ", "n't ", " never ", " no ", " without "];

/** True when `word` appears in `hay` without a "not / didn't / never…" just before it. */
function mentions(hay: string, word: string): boolean {
  const needle = ` ${normalise(word).trim()} `;
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const before = hay.slice(Math.max(0, at - 14), at + 1);
    if (!NEGATIONS.some((neg) => before.includes(neg))) return true;
    from = at + 1;
  }
}

/** Which themes a piece of writing touches (each theme counted once per text). */
export function themesIn(text: string): Set<Theme> {
  const hay = normalise(text);
  const found = new Set<Theme>();
  for (const theme of Object.keys(THEME_WORDS) as Theme[]) {
    if (THEME_WORDS[theme].some((word) => mentions(hay, word))) found.add(theme);
  }
  return found;
}

/** How many separate entries mention each theme. */
export function countThemes(texts: string[]): Record<Theme, number> {
  const counts = { tired: 0, stressed: 0, low: 0, lonely: 0, happy: 0, grateful: 0, study: 0, heavy: 0 } as Record<Theme, number>;
  for (const text of texts) for (const theme of themesIn(text)) counts[theme] += 1;
  return counts;
}
