import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLifeRows, useLifeRows } from '@/db/lifeStore';
import { db } from '@/db/db';
import { getLocalDateKey } from '@/db/dateUtils';
import type { DailyReflection, JournalEntry, LifeItem, StudySessionItem } from '@/db/schema';
import type { Theme } from '@/features/advisor/lexicon';
import { embed, shutDownModel, subscribeModelStatus, warmUpModel, type ModelStatus } from './embedder';
import { collectDocuments, textHash, type AiDocument } from './documents';
import { computeThemes, emotionThemeCounts, emotionsByDoc, emotionTrend, weekSentences, type EmotionWeek, type JournalTheme, type WeekSentence } from './analysis';
import { classifyEmotionWithHead, dot, mean, normalize, scoreTags, STARTER_TAGS, summarise, THEME_NAMES, topK, type Emotion, type Scored, type SoftmaxModel, type Vector } from './ml';
import emotionHeadJson from './emotionHead.json';
import { writePref } from '@/db/repositories/syncedPrefs';

const emotionHead = emotionHeadJson as unknown as SoftmaxModel & { minConfidence: number };

/**
 * On-device AI engine: keeps an embedding for every piece of writing,
 * then derives journal themes, recent emotions (for the advisor) and
 * meaning-based search. Opt-in per device (Settings → On-device AI).
 * Nothing here ever leaves the device.
 */

// ── on/off (per device — the model download is per device too) ──

const ENABLED_KEY = 'alb.ai.enabled';
const enabledListeners = new Set<(on: boolean) => void>();

export function isAiEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Turns on-device AI on or off here — and, through sync, on your other devices too. */
export function setAiEnabled(on: boolean): void {
  applyAiEnabled(on);
  void writePref('aiEnabled', on);
}

/** Applies the switch on this device only (used when the change came from another device). */
export function applyAiEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // Not remembered for next time — still applies now.
  }
  if (!on) {
    shutDownModel();
    setState({ ready: false, themes: [], emotionCounts: null, emotions: {}, docCount: 0, weekSummary: null, emotionWeeks: [] });
  }
  for (const l of enabledListeners) l(on);
}

export function useAiEnabled(): boolean {
  const [on, setOn] = useState(isAiEnabled);
  useEffect(() => {
    enabledListeners.add(setOn);
    return () => {
      enabledListeners.delete(setOn);
    };
  }, []);
  return on;
}

// ── derived state ──

export interface AiState {
  /** Embeddings are up to date and the analysis below is available. */
  ready: boolean;
  /** Pieces of writing understood so far. */
  docCount: number;
  themes: JournalTheme[];
  /** Emotion-based counts for the advisor (null until ready). */
  emotionCounts: Partial<Record<Theme, number>> | null;
  /** Detected emotion per document key (null = neutral). */
  emotions: Record<string, Emotion | null>;
  /** The week's writing in its most representative sentences (null if too little writing). */
  weekSummary: { sentences: WeekSentence[]; fromCount: number } | null;
  /** Emotions week by week, for the trend chart. */
  emotionWeeks: EmotionWeek[];
  /** Set while (re-)reading entries. */
  indexing?: { done: number; total: number };
}

let state: AiState = { ready: false, docCount: 0, themes: [], emotionCounts: null, emotions: {}, weekSummary: null, emotionWeeks: [] };
const stateListeners = new Set<(s: AiState) => void>();
function setState(patch: Partial<AiState>) {
  state = { ...state, ...patch };
  for (const l of stateListeners) l(state);
}

export function useAiState(): AiState {
  const [s, set] = useState(state);
  useEffect(() => {
    stateListeners.add(set);
    set(state);
    return () => {
      stateListeners.delete(set);
    };
  }, []);
  return s;
}

export function useModelStatus(): ModelStatus {
  const [s, set] = useState<ModelStatus>({ state: 'off' });
  useEffect(() => subscribeModelStatus(set), []);
  return s;
}

// ── indexing ──

let docs: AiDocument[] = [];
let docVectors: Vector[] = [];
/** Starter-tag description embeddings (for tag suggestions). */
let starterTagVectors: { tag: string; vector: Vector }[] = [];
const MIN_SENTENCES_FOR_SUMMARY = 4;
let running: Promise<void> | null = null;
let rerun = false;
const BATCH = 16;

/** Embeddings for fixed reference sentences (emotion examples, theme names), cached on the device. */
async function anchorVectors(texts: string[]): Promise<Vector[]> {
  const ids = texts.map((t) => `anchor:${textHash(t)}`);
  const cached = await db.embeddings.bulkGet(ids);
  const missing = texts.filter((_, i) => !cached[i]);
  if (missing.length) {
    const vectors: Vector[] = [];
    for (let i = 0; i < missing.length; i += BATCH) vectors.push(...(await embed(missing.slice(i, i + BATCH))));
    const now = new Date().toISOString();
    await db.embeddings.bulkPut(missing.map((t, i) => ({ id: `anchor:${textHash(t)}`, source: 'anchor' as const, sourceId: textHash(t), hash: textHash(t), vector: vectors[i], updatedAt: now })));
  }
  const all = await db.embeddings.bulkGet(ids);
  return all.map((r) => r!.vector);
}

/** Embeddings for this week's sentences, cached by text; older sentence embeddings are pruned. */
async function sentenceVectors(texts: string[]): Promise<Vector[]> {
  const ids = texts.map((t) => `sentence:${textHash(t)}`);
  const cached = await db.embeddings.bulkGet(ids);
  const missing = [...new Set(texts.filter((_, i) => !cached[i]))];
  const now = new Date().toISOString();
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const vectors = await embed(batch);
    await db.embeddings.bulkPut(batch.map((t, j) => ({ id: `sentence:${textHash(t)}`, source: 'sentence' as const, sourceId: textHash(t), hash: textHash(t), vector: vectors[j], updatedAt: now })));
  }
  const keep = new Set(ids);
  const old = (await db.embeddings.where('source').equals('sentence').primaryKeys()).filter((id) => !keep.has(id as string));
  if (old.length) await db.embeddings.bulkDelete(old as string[]);
  const all = await db.embeddings.bulkGet(ids);
  return all.map((r) => r!.vector);
}

/** Themes only change when journal/reflection text does — cached on a fingerprint of that text. */
let themeCache: { key: string; themes: JournalTheme[] } | null = null;
function themesFor(writing: AiDocument[], vectors: Vector[], nameVectors: Vector[], today: string): JournalTheme[] {
  const key = `${today.slice(0, 7)}|` + writing.map((d) => `${d.key}:${textHash(d.text)}`).join(',');
  if (themeCache?.key === key) return themeCache.themes;
  const themes = computeThemes(writing, vectors, nameVectors, THEME_NAMES, today);
  themeCache = { key, themes };
  return themes;
}

async function refreshOnce(): Promise<void> {
  // Life rows from the shared copy when it's loaded (no extra full read of the table).
  const [journal, reflections, lifeRows] = await Promise.all([
    db.journalEntries.toArray(),
    db.dailyReflections.toArray(),
    getLifeRows() ?? db.lifeItems.toArray(),
  ]);
  const rows = lifeRows as unknown as Array<{ type: string }>;
  docs = collectDocuments({
    journal: journal as JournalEntry[],
    reflections: reflections as DailyReflection[],
    life: rows.filter((r) => r.type !== 'subject' && r.type !== 'studySession' && r.type !== 'letter') as unknown as LifeItem[],
    studySessions: rows.filter((r) => r.type === 'studySession') as unknown as StudySessionItem[],
  });

  // Embed only what's new or changed.
  const existing = new Map((await db.embeddings.where('source').noneOf(['anchor', 'sentence']).toArray()).map((e) => [e.id, e]));
  const todo = docs.filter((d) => existing.get(d.key)?.hash !== textHash(d.text));
  for (let i = 0; i < todo.length; i += BATCH) {
    setState({ indexing: { done: i, total: todo.length } });
    const batch = todo.slice(i, i + BATCH);
    const vectors = await embed(batch.map((d) => d.text));
    const now = new Date().toISOString();
    await db.embeddings.bulkPut(batch.map((d, j) => ({ id: d.key, source: d.source, sourceId: d.sourceId, hash: textHash(d.text), vector: vectors[j], updatedAt: now })));
  }
  // Forget fingerprints of things that were deleted.
  const live = new Set(docs.map((d) => d.key));
  const stale = [...existing.keys()].filter((id) => !live.has(id));
  if (stale.length) await db.embeddings.bulkDelete(stale);

  const stored = new Map((await db.embeddings.bulkGet(docs.map((d) => d.key))).map((e, i) => [docs[i].key, e?.vector]));
  docs = docs.filter((d) => stored.get(d.key));
  docVectors = docs.map((d) => stored.get(d.key)!);

  // Emotions: the trained classifier head (scripts/emotion/train.ts).
  const classify = (v: Vector) => classifyEmotionWithHead(v, emotionHead, emotionHead.minConfidence).emotion;
  // Candidate theme names and starter tags (zero-shot).
  const nameVectors = await anchorVectors(THEME_NAMES);
  const tagNames = Object.keys(STARTER_TAGS);
  const tagVectors = await anchorVectors(Object.values(STARTER_TAGS));
  starterTagVectors = tagNames.map((tag, i) => ({ tag, vector: tagVectors[i] }));

  const today = getLocalDateKey();
  const writingIdx = docs.map((d, i) => (d.source === 'journal' || d.source === 'reflection' ? i : -1)).filter((i) => i >= 0);
  const writing = writingIdx.map((i) => docs[i]);
  const writingVectors = writingIdx.map((i) => docVectors[i]);

  // The week in a few sentences (TextRank + MMR over sentence embeddings).
  const sentences = weekSentences(docs, today);
  let weekSummary: AiState['weekSummary'] = null;
  if (sentences.length >= MIN_SENTENCES_FOR_SUMMARY) {
    const vectors = await sentenceVectors(sentences.map((x) => x.text));
    const picks = summarise(vectors, 3, sentences.map((x) => x.text.length));
    weekSummary = { sentences: picks.map((i) => sentences[i]), fromCount: sentences.length };
  } else {
    await sentenceVectors([]);
  }

  const emotions = emotionsByDoc(writing, writingVectors, classify);
  setState({
    ready: true,
    indexing: undefined,
    docCount: docs.length,
    themes: themesFor(writing, writingVectors, nameVectors, today),
    emotionCounts: emotionThemeCounts(writing, writingVectors, classify, today),
    emotions,
    weekSummary,
    emotionWeeks: emotionTrend(writing, emotions, today),
  });
}

/** Brings embeddings and analysis up to date (coalesces overlapping calls). */
export async function refreshAi(): Promise<void> {
  if (!isAiEnabled()) return;
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        rerun = false;
        await refreshOnce();
      } while (rerun);
    } catch {
      setState({ indexing: undefined });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Search everything written in the app by meaning. */
export async function searchByMeaning(query: string, k = 12): Promise<Scored<AiDocument>[]> {
  const q = query.trim();
  if (!q || docs.length === 0) return [];
  const [vector] = await embed([q]);
  return topK(vector, docs.map((d, i) => ({ item: d, vector: docVectors[i] })), k, 0.28);
}

// ── "could I start this today?" (for the I'm-bored ideas) ──

/** Examples of things you can begin right now… */
export const STARTABLE_EXAMPLES = [
  'Begin a small habit at home today',
  'Practise a skill for ten minutes',
  'Make or create something with my hands',
  'Do a little exercise this morning',
  'Work on getting better at something every day',
];
/** …and of things that need a date, a place, other people or months of work. */
export const LATER_EXAMPLES = [
  'Book a trip to another city',
  'Go to a festival or celebration on a certain date',
  'Get an appointment at a salon or studio',
  'Achieve a big result after months of effort',
  'Plan an outing with a group of friends',
];
/** How much closer to "start now" than to "later" a goal must be — borderline ones aren't suggested. */
export const STARTABLE_MARGIN = 0.03;

/**
 * Zero-shot: for each goal, compares its embedding with the nearest
 * "start now" and nearest "later" example. Only used for goals the
 * word rules can't classify. Empty when on-device AI is off or not ready.
 */
export async function startableByMeaning(titles: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (!titles.length || !state.ready) return out;
  const [now, later, goals] = await Promise.all([anchorVectors(STARTABLE_EXAMPLES), anchorVectors(LATER_EXAMPLES), anchorVectors(titles)]);
  titles.forEach((t, i) => {
    const s = Math.max(...now.map((v) => dot(goals[i], v)));
    const l = Math.max(...later.map((v) => dot(goals[i], v)));
    out.set(t, s - l > STARTABLE_MARGIN);
  });
  return out;
}

/**
 * Suggests up to 3 tags for a piece of writing: tags the person already
 * uses (learned from their tagged entries) and general starter tags.
 */
export async function suggestTags(text: string, currentTags: string[]): Promise<string[]> {
  if (text.trim().length < 20 || !state.ready) return [];
  const [vector] = await embed([text]);
  const journal = (await db.journalEntries.toArray()).filter((j) => !j.deletedAt && j.tags?.length);
  const byTag = new Map<string, Vector[]>();
  for (const j of journal) {
    const i = docs.findIndex((d) => d.key === `journal:${j.id}`);
    if (i < 0) continue;
    for (const tag of j.tags!) byTag.set(tag, [...(byTag.get(tag) ?? []), docVectors[i]]);
  }
  const learned = [...byTag.entries()].map(([tag, vs]) => ({ tag, centroid: normalize(mean(vs)), count: vs.length }));
  return scoreTags(vector, learned, starterTagVectors, currentTags).map((t) => t.tag);
}

/**
 * Mount once (in App): when on-device AI is on, loads the model and keeps
 * the analysis fresh as entries are added or edited (debounced).
 */
export function useAiBackground(): void {
  const enabled = useAiEnabled();
  // A cheap signature of all writing — changes whenever an entry is added, edited or removed.
  const stamp = (rows: readonly object[]) => {
    let max = '';
    for (const x of rows as { updatedAt?: unknown }[]) if (typeof x.updatedAt === "string" && x.updatedAt > max) max = x.updatedAt;
    return max;
  };
  const writing = useLiveQuery(async () => {
    if (!enabled) return '';
    const [j, r] = await Promise.all([db.journalEntries.toArray(), db.dailyReflections.toArray()]);
    return `${j.length}:${stamp(j)}|${r.length}:${stamp(r)}`;
  }, [enabled]);
  // Life rows from the shared copy — ignoring taps and synced preferences, which aren't writing.
  const lifeRows = useLifeRows();
  const lifeStamp = useMemo(() => {
    if (!enabled || !lifeRows) return '';
    const relevant = lifeRows.filter((x) => x.type !== 'toolEvent' && x.type !== 'pref' && x.type !== 'letter');
    return `${relevant.length}:${stamp(relevant)}`;
  }, [enabled, lifeRows]);
  const signature = writing === undefined || lifeRows === undefined ? undefined : `${writing}|${lifeStamp}`;

  useEffect(() => {
    if (!enabled) return;
    warmUpModel();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || signature === undefined) return;
    const t = window.setTimeout(() => void refreshAi(), 1500);
    return () => window.clearTimeout(t);
  }, [enabled, signature]);
}
