/**
 * The machine-learning maths behind on-device AI, written from scratch
 * (no ML library): similarity search, spherical k-means with k-means++
 * initialisation, silhouette-based model selection, class-based TF-IDF
 * theme naming, and a prototype (nearest-centroid) emotion classifier.
 *
 * Inputs are sentence embeddings from all-MiniLM-L6-v2: 384-dimension,
 * L2-normalised vectors, so cosine similarity is just a dot product.
 * Everything here is pure and deterministic (seeded), so it's testable.
 */

export type Vector = number[];

// ── vectors ─────────────────────────────────────────────────────────

export function dot(a: Vector, b: Vector): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function normalize(v: Vector): Vector {
  const n = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / n);
}

/** Cosine similarity (inputs need not be normalised). */
export function cosine(a: Vector, b: Vector): number {
  const d = Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b));
  return d === 0 ? 0 : dot(a, b) / d;
}

export function mean(vectors: Vector[]): Vector {
  const out = new Array(vectors[0].length).fill(0);
  for (const v of vectors) for (let i = 0; i < v.length; i++) out[i] += v[i];
  return out.map((x) => x / vectors.length);
}

// ── semantic search ─────────────────────────────────────────────────

export interface Scored<T> {
  item: T;
  score: number;
}

/** The `k` items most similar in meaning to `query`, above `minScore`. */
export function topK<T>(query: Vector, items: { item: T; vector: Vector }[], k: number, minScore = 0): Scored<T>[] {
  return items
    .map(({ item, vector }) => ({ item, score: cosine(query, vector) }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// ── clustering ──────────────────────────────────────────────────────

/** Small seeded PRNG (mulberry32) so clustering is reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cosineDistance = (a: Vector, b: Vector) => 1 - cosine(a, b);

export interface KMeansResult {
  labels: number[];
  centroids: Vector[];
  /** Sum of distances from each point to its centroid (lower is tighter). */
  inertia: number;
}

/**
 * Spherical k-means (cosine distance, unit-length centroids) with
 * k-means++ initialisation: first centre at random, then each next centre
 * chosen with probability proportional to squared distance from the
 * nearest existing centre.
 */
export function kMeans(vectors: Vector[], k: number, seed = 42, maxIterations = 50): KMeansResult {
  const rand = seededRandom(seed);
  const n = vectors.length;
  const centroids: Vector[] = [normalize(vectors[Math.floor(rand() * n)])];
  while (centroids.length < k) {
    const d2 = vectors.map((v) => Math.min(...centroids.map((c) => cosineDistance(v, c))) ** 2);
    const total = d2.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (; idx < n - 1; idx++) {
      r -= d2[idx];
      if (r <= 0) break;
    }
    centroids.push(normalize(vectors[idx]));
  }

  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < maxIterations; iter++) {
    const next = vectors.map((v) => {
      let best = 0;
      let bestD = Infinity;
      centroids.forEach((c, j) => {
        const d = cosineDistance(v, c);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      return best;
    });
    const changed = next.some((l, i) => l !== labels[i]);
    labels = next;
    for (let j = 0; j < k; j++) {
      const members = vectors.filter((_, i) => labels[i] === j);
      // An emptied cluster keeps its previous centre.
      if (members.length) centroids[j] = normalize(mean(members));
    }
    if (!changed && iter > 0) break;
  }
  const inertia = vectors.reduce((s, v, i) => s + cosineDistance(v, centroids[labels[i]]), 0);
  return { labels, centroids, inertia };
}

/**
 * Mean silhouette coefficient (cosine distance), in [-1, 1]. For each
 * point: (b − a) / max(a, b), where a = mean distance to its own cluster
 * and b = mean distance to the nearest other cluster. Higher means
 * clusters are tighter and better separated.
 */
export function silhouette(vectors: Vector[], labels: number[], dist?: Float64Array): number {
  const n = vectors.length;
  const clusters = [...new Set(labels)];
  if (clusters.length < 2) return 0;
  const d = dist ?? distanceMatrix(vectors);
  // Members of each cluster, worked out once (not per point).
  const members = new Map<number, number[]>();
  labels.forEach((l, j) => members.set(l, [...(members.get(l) ?? []), j]));
  let total = 0;
  for (let i = 0; i < n; i++) {
    const own = labels[i];
    const ownMembers = members.get(own)!;
    if (ownMembers.length <= 1) continue; // singleton contributes 0
    let sumOwn = 0;
    for (const j of ownMembers) if (j !== i) sumOwn += d[i * n + j];
    const a = sumOwn / (ownMembers.length - 1);
    let b = Infinity;
    for (const [c, ms] of members) {
      if (c === own) continue;
      let sum = 0;
      for (const j of ms) sum += d[i * n + j];
      b = Math.min(b, sum / ms.length);
    }
    total += (b - a) / Math.max(a, b);
  }
  return total / n;
}

/** All pairwise cosine distances, computed once (symmetric, so each pair only once). */
export function distanceMatrix(vectors: Vector[]): Float64Array {
  const n = vectors.length;
  const d = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = cosineDistance(vectors[i], vectors[j]);
      d[i * n + j] = v;
      d[j * n + i] = v;
    }
  }
  return d;
}

export interface ClusterChoice extends KMeansResult {
  k: number;
  silhouette: number;
}

/**
 * Picks the number of themes automatically: tries k from kMin to kMax
 * (never more than n/3, so each theme has a few entries) and keeps the k
 * with the best silhouette score.
 */
export function chooseClusters(vectors: Vector[], kMin = 2, kMax = 6, seed = 42): ClusterChoice | null {
  const limit = Math.min(kMax, Math.floor(vectors.length / 3));
  if (limit < kMin) return null;
  let best: ClusterChoice | null = null;
  const dist = distanceMatrix(vectors); // shared by every k
  for (let k = kMin; k <= limit; k++) {
    const result = kMeans(vectors, k, seed);
    const score = silhouette(vectors, result.labels, dist);
    if (!best || score > best.silhouette) best = { ...result, k, silhouette: score };
  }
  return best;
}

// ── naming themes (class-based TF-IDF) ──────────────────────────────

const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by can
  could did do does doing down during each few for from further had has have having he her here hers herself him himself his
  how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves
  out over own same she should so some such than that the their theirs them themselves then there these they this those through
  to too under until up very was we were what when where which while who whom why will with would you your yours yourself
  yourselves im ive dont didnt cant wasnt isnt really got get gets getting go going went one also much many still even today
  day felt feel feeling like little bit lot things thing something way time make made know think thought want wanted need`.split(/\s+/),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * The most characteristic words of each cluster, by class-based TF-IDF:
 * a word scores highly when many entries in the cluster use it and few
 * other clusters do.
 */
export function clusterKeywords(texts: string[], labels: number[], k: number, perCluster = 3): string[][] {
  // Document frequency of each word inside each cluster (each entry counts once).
  const df: Map<string, number>[] = Array.from({ length: k }, () => new Map());
  const sizes = new Array(k).fill(0);
  texts.forEach((t, i) => {
    sizes[labels[i]] += 1;
    for (const w of new Set(tokenize(t))) df[labels[i]].set(w, (df[labels[i]].get(w) ?? 0) + 1);
  });
  // In how many clusters does each word appear at all?
  const spread = new Map<string, number>();
  for (const m of df) for (const w of m.keys()) spread.set(w, (spread.get(w) ?? 0) + 1);
  return df.map((m, c) =>
    [...m.entries()]
      .map(([w, n]) => ({ w, n, score: (n / Math.max(1, sizes[c])) * Math.log(1 + k / (spread.get(w) ?? 1)) }))
      // Words shared by several entries in the theme first, then by score.
      .sort((a, b) => Math.min(b.n, 2) - Math.min(a.n, 2) || b.score - a.score)
      .slice(0, perCluster)
      .map((x) => x.w),
  );
}

// ── emotions (prototype classifier) ─────────────────────────────────

export type Emotion = 'joy' | 'calm' | 'gratitude' | 'sadness' | 'anxiety' | 'anger' | 'loneliness' | 'tiredness';

/**
 * Example sentences per emotion. Each emotion's prototype is the mean
 * embedding of its examples; an entry is labelled with the nearest
 * prototype — a few-shot classifier needing no training data from the user.
 */
export const EMOTION_EXAMPLES: Record<Emotion, string[]> = {
  joy: ['I had such a happy, fun day.', 'I was so excited and kept smiling.', 'Today was wonderful and I laughed a lot.', 'I feel proud and joyful about what happened.'],
  calm: ['I feel calm and at peace.', 'It was a slow, quiet, relaxing day.', 'I felt content and settled.', 'Everything felt gentle and easy today.'],
  gratitude: ['I am so grateful for my friends and family.', 'I feel thankful for the little things.', 'I appreciate everyone who helped me.', 'I feel lucky and blessed today.'],
  sadness: ['I feel sad and down today.', 'I cried and felt hurt.', 'I was disappointed and upset.', 'Everything felt heavy and gloomy.'],
  anxiety: ['I am anxious and worried about the exam.', 'I feel stressed and overwhelmed by deadlines.', 'I keep overthinking and feel nervous.', 'There is so much pressure and I feel panicky.'],
  anger: ['I am so angry and frustrated.', 'That really annoyed me and I lost my temper.', 'I feel irritated and resentful.', 'I was furious about how I was treated.'],
  loneliness: ['I feel lonely and left out.', 'I miss my friends and feel isolated.', 'Nobody really understands me lately.', 'I felt alone even around people.'],
  tiredness: ['I am exhausted and have no energy.', 'I feel drained and burnt out.', 'I could not sleep and feel tired.', 'I am so sleepy and worn out today.'],
};

export interface EmotionPrototypes {
  emotions: Emotion[];
  centroids: Vector[];
}

/** Builds one unit-length prototype per emotion from its example embeddings. */
export function buildPrototypes(exampleVectors: Record<Emotion, Vector[]>): EmotionPrototypes {
  const emotions = Object.keys(exampleVectors) as Emotion[];
  return { emotions, centroids: emotions.map((e) => normalize(mean(exampleVectors[e]))) };
}

export interface EmotionResult {
  /** The best match, or null when nothing matches clearly (a neutral entry). */
  emotion: Emotion | null;
  /** Softmax probabilities over emotions. */
  probabilities: Record<Emotion, number>;
}

/**
 * Nearest-prototype classification with a softmax over cosine similarities
 * (temperature τ). Returns null when the best similarity is weak or the
 * winner isn't clearly ahead — so neutral writing isn't forced into a mood.
 */
export function classifyEmotion(vector: Vector, protos: EmotionPrototypes, temperature = 0.05, minSimilarity = 0.25, minMargin = 0.02): EmotionResult {
  const sims = protos.centroids.map((c) => cosine(vector, c));
  const maxSim = Math.max(...sims);
  const exps = sims.map((s) => Math.exp((s - maxSim) / temperature));
  const z = exps.reduce((a, b) => a + b, 0);
  const probabilities = Object.fromEntries(protos.emotions.map((e, i) => [e, exps[i] / z])) as Record<Emotion, number>;
  const sorted = [...sims].sort((a, b) => b - a);
  const clear = maxSim >= minSimilarity && sorted[0] - (sorted[1] ?? -1) >= minMargin;
  return { emotion: clear ? protos.emotions[sims.indexOf(maxSim)] : null, probabilities };
}

// ── emotions (trained classifier head) ──────────────────────────────

/**
 * Multinomial logistic regression (softmax regression) on frozen sentence
 * embeddings, written from scratch: cross-entropy loss + L2 penalty,
 * full-batch gradient descent with Adam. Deterministic (weights start at 0).
 */
export interface SoftmaxModel {
  labels: string[];
  /** One weight row per label. */
  W: number[][];
  b: number[];
}

export function softmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const e = logits.map((x) => Math.exp(x - m));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
}

export function predictSoftmax(model: SoftmaxModel, x: Vector): number[] {
  return softmax(model.W.map((w, c) => dot(w, x) + model.b[c]));
}

export function trainSoftmax(
  X: Vector[],
  y: number[],
  labels: string[],
  { l2 = 1e-3, epochs = 400, lr = 0.05 }: { l2?: number; epochs?: number; lr?: number } = {},
): SoftmaxModel {
  const C = labels.length;
  const D = X[0].length;
  const N = X.length;
  const W = Array.from({ length: C }, () => new Array<number>(D).fill(0));
  const b = new Array<number>(C).fill(0);
  // Adam state
  const mW = W.map((r) => r.map(() => 0));
  const vW = W.map((r) => r.map(() => 0));
  const mB = b.map(() => 0);
  const vB = b.map(() => 0);
  const [b1, b2, eps] = [0.9, 0.999, 1e-8];

  for (let t = 1; t <= epochs; t++) {
    const gW = W.map((r) => r.map((w) => l2 * w));
    const gB = new Array<number>(C).fill(0);
    for (let n = 0; n < N; n++) {
      const p = predictSoftmax({ labels, W, b }, X[n]);
      for (let c = 0; c < C; c++) {
        const err = (p[c] - (y[n] === c ? 1 : 0)) / N;
        if (err === 0) continue;
        const row = gW[c];
        const x = X[n];
        for (let d = 0; d < D; d++) row[d] += err * x[d];
        gB[c] += err;
      }
    }
    const c1 = 1 - b1 ** t;
    const c2 = 1 - b2 ** t;
    for (let c = 0; c < C; c++) {
      for (let d = 0; d < D; d++) {
        mW[c][d] = b1 * mW[c][d] + (1 - b1) * gW[c][d];
        vW[c][d] = b2 * vW[c][d] + (1 - b2) * gW[c][d] ** 2;
        W[c][d] -= (lr * (mW[c][d] / c1)) / (Math.sqrt(vW[c][d] / c2) + eps);
      }
      mB[c] = b1 * mB[c] + (1 - b1) * gB[c];
      vB[c] = b2 * vB[c] + (1 - b2) * gB[c] ** 2;
      b[c] -= (lr * (mB[c] / c1)) / (Math.sqrt(vB[c] / c2) + eps);
    }
  }
  return { labels, W, b };
}

/** Stratified k-fold split (deterministic): returns a fold index per sample. */
export function stratifiedFolds(y: number[], k: number, seed = 7): number[] {
  const rand = seededRandom(seed);
  const folds = new Array<number>(y.length).fill(0);
  const byClass = new Map<number, number[]>();
  y.forEach((c, i) => byClass.set(c, [...(byClass.get(c) ?? []), i]));
  for (const idx of byClass.values()) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    idx.forEach((sample, i) => (folds[sample] = i % k));
  }
  return folds;
}

/**
 * Emotion from the trained head. The head has an explicit "neutral" class;
 * an entry is also treated as neutral when the model isn't confident.
 */
export function classifyEmotionWithHead(vector: Vector, head: SoftmaxModel, minConfidence = 0.3): EmotionResult {
  const p = predictSoftmax(head, vector);
  const best = p.indexOf(Math.max(...p));
  const label = head.labels[best];
  const emotions = head.labels.filter((l) => l !== 'neutral') as Emotion[];
  const probabilities = Object.fromEntries(emotions.map((e) => [e, p[head.labels.indexOf(e)]])) as Record<Emotion, number>;
  return { emotion: label === 'neutral' || p[best] < minConfidence ? null : (label as Emotion), probabilities };
}

// ── naming themes (zero-shot, by meaning) ───────────────────────────

/**
 * Candidate theme names. Each cluster is named after the candidate whose
 * embedding is closest to the cluster's centroid — zero-shot labelling,
 * no training needed. (Its c-TF-IDF keywords are shown alongside.)
 */
export const THEME_NAMES: string[] = [
  'Studies & exams',
  'Languages & learning',
  'Research & lab work',
  'Work & career',
  'Family',
  'Friends & social life',
  'Love & relationships',
  'Health & exercise',
  'Nature & the outdoors',
  'Food & cooking',
  'Rest & sleep',
  'Stress & worries',
  'Sadness & hard days',
  'Joy & small wins',
  'Gratitude',
  'Creativity & art',
  'Books & stories',
  'Movies & shows',
  'Travel & adventures',
  'Money & plans',
  'Self-reflection & growth',
];

/** For each centroid, the closest name (or null if none is a reasonable match). */
export function nameClusters(centroids: Vector[], nameVectors: Vector[], names: string[], minSimilarity = 0.2): (string | null)[] {
  const used = new Set<number>();
  return centroids.map((c) => {
    const ranked = nameVectors.map((v, i) => ({ i, s: cosine(c, v) })).sort((a, b) => b.s - a.s);
    // Prefer a name no other theme has taken yet.
    const pick = ranked.find((r) => !used.has(r.i) && r.s >= minSimilarity);
    if (!pick) return null;
    used.add(pick.i);
    return names[pick.i];
  });
}

// ── extractive summarisation ────────────────────────────────────────

/** Splits writing into sentences (keeps ones long enough to mean something). */
export function splitSentences(text: string, minChars = 12): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= minChars);
}

/**
 * TextRank centrality: PageRank over the sentence-similarity graph (edge
 * weight = cosine similarity, negatives dropped). Sentences that are
 * similar to many others score highest — they capture what the writing
 * is mostly about.
 */
export function textRank(vectors: Vector[], damping = 0.85, iterations = 50): number[] {
  const n = vectors.length;
  if (n === 0) return [];
  const w = vectors.map((a, i) => vectors.map((b, j) => (i === j ? 0 : Math.max(0, cosine(a, b)))));
  const outSum = w.map((row) => row.reduce((s, x) => s + x, 0) || 1);
  let score = new Array(n).fill(1 / n);
  for (let it = 0; it < iterations; it++) {
    score = score.map((_, i) => (1 - damping) / n + damping * w.reduce((s, row, j) => s + (row[i] / outSum[j]) * score[j], 0));
  }
  return score;
}

/**
 * Maximal Marginal Relevance: picks `k` items that score highly but
 * aren't near-duplicates of each other (λ balances relevance vs. variety).
 */
export function mmrSelect(scores: number[], vectors: Vector[], k: number, lambda = 0.7): number[] {
  const max = Math.max(...scores, 1e-9);
  const rel = scores.map((s) => s / max);
  const chosen: number[] = [];
  const candidates = new Set(scores.map((_, i) => i));
  while (chosen.length < k && candidates.size) {
    let best = -1;
    let bestValue = -Infinity;
    for (const i of candidates) {
      const redundancy = chosen.length ? Math.max(...chosen.map((j) => cosine(vectors[i], vectors[j]))) : 0;
      const value = lambda * rel[i] - (1 - lambda) * redundancy;
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    }
    chosen.push(best);
    candidates.delete(best);
  }
  return chosen;
}

/**
 * Summarises sentences into the `k` most representative, varied ones
 * (returned in original order). Very short sentences are gently
 * down-weighted — they tend to say little on their own.
 */
export function summarise(vectors: Vector[], k = 3, lengths?: number[]): number[] {
  if (vectors.length <= k) return vectors.map((_, i) => i);
  const rank = textRank(vectors).map((r, i) => r * (lengths ? 0.4 + 0.6 * Math.min(1, lengths[i] / 70) : 1));
  return mmrSelect(rank, vectors, k, 0.5).sort((a, b) => a - b);
}

// ── tag suggestions ─────────────────────────────────────────────────

/** General tags suggested zero-shot (by meaning) when the user hasn't built up their own yet. */
export const STARTER_TAGS: Record<string, string> = {
  study: 'studying, exams, revision and assignments',
  work: 'work, career, office and jobs',
  research: 'research, lab experiments and papers',
  family: 'family, parents, siblings and home',
  friends: 'friends, hanging out and social life',
  love: 'love, partner and relationships',
  health: 'health, exercise, workouts and the body',
  nature: 'nature, walks, sky, trees and the outdoors',
  food: 'food, cooking, meals and eating out',
  rest: 'rest, sleep, tiredness and recovering',
  stress: 'stress, worry, anxiety and pressure',
  joy: 'joy, happiness, fun and small wins',
  gratitude: 'gratitude and feeling thankful',
  art: 'art, drawing, painting and making things',
  reading: 'reading books and stories',
  travel: 'travel, trips and adventures',
  money: 'money, spending, saving and plans',
};

/**
 * Scores candidate tags for a piece of writing. Tags the user already
 * uses are represented by the mean embedding of their entries (a
 * nearest-centroid classifier learned from their own tagging); starter
 * tags by the embedding of their description (zero-shot). Learned tags
 * get a small boost so personal habits win over generic suggestions.
 */
export function scoreTags(
  text: Vector,
  learned: { tag: string; centroid: Vector; count: number }[],
  starters: { tag: string; vector: Vector }[],
  exclude: string[] = [],
  k = 3,
  minScore = 0.3,
): { tag: string; score: number; learned: boolean }[] {
  const skip = new Set(exclude.map((t) => t.toLowerCase()));
  const scored = new Map<string, { tag: string; score: number; learned: boolean }>();
  for (const l of learned) {
    const score = cosine(text, l.centroid) + Math.min(0.08, 0.02 * l.count);
    scored.set(l.tag.toLowerCase(), { tag: l.tag, score, learned: true });
  }
  for (const s of starters) {
    if (scored.has(s.tag)) continue;
    scored.set(s.tag, { tag: s.tag, score: cosine(text, s.vector), learned: false });
  }
  return [...scored.values()]
    .filter((t) => !skip.has(t.tag.toLowerCase()) && t.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
