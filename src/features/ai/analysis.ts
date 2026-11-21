import type { Theme } from '@/features/advisor/lexicon';
import type { AiDocument } from './documents';
import { chooseClusters, clusterKeywords, nameClusters, splitSentences, type Emotion, type Vector } from './ml';

/** Any emotion classifier: a vector in, an emotion (or null = neutral) out. */
export type EmotionClassifier = (vector: Vector) => Emotion | null;
import { startOfWeek, addDays } from '@/db/dateUtils';

/** Pure analysis on top of embeddings: journal themes and emotion counts. */

export interface JournalTheme {
  name: string;
  keywords: string[];
  /** Entries in this theme, newest first. */
  docs: AiDocument[];
  /** Entries per month for the last 6 months, oldest first, e.g. [{ month: '2026-06', count: 2 }, …]. */
  months: { month: string; count: number }[];
}

export const MIN_DOCS_FOR_THEMES = 6;

function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Groups writing into themes (k-means, k chosen by silhouette) and names each one. */
export function computeThemes(docs: AiDocument[], vectors: Vector[], themeNameVectors: Vector[], themeNames: string[], today: string): JournalTheme[] {
  if (docs.length < MIN_DOCS_FOR_THEMES) return [];
  const choice = chooseClusters(vectors);
  if (!choice) return [];
  const keywords = clusterKeywords(docs.map((d) => d.text), choice.labels, choice.k);
  const names = nameClusters(choice.centroids, themeNameVectors, themeNames);
  const months = lastMonths(today, 6);
  return Array.from({ length: choice.k }, (_, c) => {
    const members = docs.filter((_, i) => choice.labels[i] === c).sort((a, b) => b.date.localeCompare(a.date));
    return {
      name: names[c] ?? (keywords[c][0] ? keywords[c][0][0].toUpperCase() + keywords[c][0].slice(1) : `Theme ${c + 1}`),
      keywords: keywords[c],
      docs: members,
      months: months.map((month) => ({ month, count: members.filter((d) => d.date.startsWith(month)).length })),
    };
  })
    .filter((t) => t.docs.length > 0)
    .sort((a, b) => b.docs.length - a.docs.length);
}

/** How the model's emotions map onto the advisor's themes. */
const EMOTION_TO_THEME: Partial<Record<Emotion, Theme>> = {
  tiredness: 'tired',
  anxiety: 'stressed',
  sadness: 'low',
  anger: 'low',
  loneliness: 'lonely',
  joy: 'happy',
  calm: 'happy',
  gratitude: 'grateful',
};

/**
 * Emotion-based theme counts over recent journal entries and reflections
 * (one emotion per entry, neutral entries skipped) — used by the advisor
 * instead of its word list when on-device AI is on.
 */
export function emotionThemeCounts(docs: AiDocument[], vectors: Vector[], classify: EmotionClassifier, today: string, days = 14): Partial<Record<Theme, number>> {
  const cutoff = Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000;
  const counts: Partial<Record<Theme, number>> = {};
  docs.forEach((doc, i) => {
    if (doc.source !== 'journal' && doc.source !== 'reflection') return;
    if (Date.parse(`${doc.date}T00:00:00Z`) < cutoff) return;
    const emotion = classify(vectors[i]);
    const theme = emotion ? EMOTION_TO_THEME[emotion] : undefined;
    if (theme) counts[theme] = (counts[theme] ?? 0) + 1;
  });
  return counts;
}

/** The emotion of each document (null = neutral), keyed by document key. */
export function emotionsByDoc(docs: AiDocument[], vectors: Vector[], classify: EmotionClassifier): Record<string, Emotion | null> {
  return Object.fromEntries(docs.map((d, i) => [d.key, classify(vectors[i])]));
}

// ── week in three sentences ──

export interface WeekSentence {
  text: string;
  date: string;
  source: AiDocument['source'];
}

/** Sentences from the last 7 days of journal entries, reflections and study notes, oldest first. */
export function weekSentences(docs: AiDocument[], today: string): WeekSentence[] {
  const from = addDays(today, -6);
  return docs
    .filter((d) => (d.source === 'journal' || d.source === 'reflection' || d.source === 'study') && d.date >= from && d.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    // Journal text is "Title. Body" — summarise the body, not the title.
    .flatMap((d) => splitSentences(d.text.startsWith(`${d.title}. `) ? d.text.slice(d.title.length + 2) : d.text).map((text) => ({ text, date: d.date, source: d.source })));
}

// ── emotion trends ──

export interface EmotionWeek {
  /** Monday of the week. */
  weekStart: string;
  counts: Partial<Record<Emotion, number>>;
  entries: { key: string; title: string; date: string; emotion: Emotion | null }[];
}

/** Emotions in journal entries and reflections, week by week (Monday–Sunday), for the last `weeks` weeks. */
export function emotionTrend(docs: AiDocument[], emotions: Record<string, Emotion | null>, today: string, weeks = 8): EmotionWeek[] {
  const thisWeek = startOfWeek(today);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(thisWeek, -7 * (weeks - 1 - i));
    const weekEnd = addDays(weekStart, 6);
    const entries = docs
      .filter((d) => (d.source === 'journal' || d.source === 'reflection') && d.date >= weekStart && d.date <= weekEnd)
      .map((d) => ({ key: d.key, title: d.title, date: d.date, emotion: emotions[d.key] ?? null }))
      .sort((x, y) => x.date.localeCompare(y.date));
    const counts: Partial<Record<Emotion, number>> = {};
    for (const e of entries) if (e.emotion) counts[e.emotion] = (counts[e.emotion] ?? 0) + 1;
    return { weekStart, counts, entries };
  });
}
