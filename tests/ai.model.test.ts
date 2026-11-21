/**
 * Runs the REAL on-device model (all-MiniLM-L6-v2, the same files the app
 * serves from public/models) to check that meaning search, emotions and
 * themes actually work — not just the maths around them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import headJson from '@/features/ai/emotionHead.json';
import { classifyEmotionWithHead, type SoftmaxModel, EMOTION_EXAMPLES, THEME_NAMES, STARTER_TAGS, buildPrototypes, classifyEmotion, topK, splitSentences, summarise, scoreTags, type Emotion, type EmotionPrototypes } from '@/features/ai/ml';
import { computeThemes } from '@/features/ai/analysis';
import type { AiDocument } from '@/features/ai/documents';

let model: FeatureExtractionPipeline;
let protos: EmotionPrototypes;
const embed = async (texts: string[]) => {
  const out = await model(texts, { pooling: 'mean', normalize: true });
  const data = out.data as Float32Array;
  const dims = out.dims[1] as number;
  return texts.map((_, i) => Array.from(data.subarray(i * dims, (i + 1) * dims)));
};

beforeAll(async () => {
  env.allowRemoteModels = false;
  env.localModelPath = path.resolve('public/models') + '/';
  model = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })) as FeatureExtractionPipeline;
  const byEmotion = {} as Record<Emotion, number[][]>;
  for (const e of Object.keys(EMOTION_EXAMPLES) as Emotion[]) byEmotion[e] = await embed(EMOTION_EXAMPLES[e]);
  protos = buildPrototypes(byEmotion);
}, 120_000);

describe('on-device model', () => {
  it('produces 384-dimension unit vectors', async () => {
    const [v] = await embed(['hello']);
    expect(v).toHaveLength(384);
    expect(Math.hypot(...v)).toBeCloseTo(1, 3);
  });

  it('search by meaning finds the right entry without shared words', async () => {
    const entries = ['Nervous before the test tomorrow, kept revising', 'Had pizza and watched a film with friends', 'Long walk by the lake at sunset'];
    const vectors = await embed(entries);
    const [q] = await embed(['times I felt anxious about exams']);
    const [best] = topK(q, entries.map((item, i) => ({ item, vector: vectors[i] })), 1);
    expect(best.item).toBe(entries[0]);
  });

  it('reads emotions from phrasing (including "didn\'t cry") — trained head', async () => {
    const cases: [string, Emotion | null][] = [
      ["Got to know none of us got it. Sucks. I was sad but I didn't cry much which is a shocker.", 'sadness'],
      ['A bit stressed about the deadline, but the study plan is working.', 'anxiety'],
      ["So tired, I couldn't sleep at all last night.", 'tiredness'],
      ['Nobody texted me back all weekend.', 'loneliness'],
      ['So thankful my friends surprised me with cake.', 'gratitude'],
      ['Went to the lab and ran the experiment, then had lunch.', null],
    ];
    const vectors = await embed(cases.map((c) => c[0]));
    const head = headJson as unknown as SoftmaxModel & { minConfidence: number };
    cases.forEach(([text, expected], i) => expect(classifyEmotionWithHead(vectors[i], head, head.minConfidence).emotion, text).toBe(expected));
  });

  it('groups writing into sensibly named themes', async () => {
    const texts = [
      'Exam tomorrow, revising all night', 'Thesis deadline stress again', 'Studied kanji for an hour', 'Japanese grammar is finally clicking',
      'Called Mom and talked for ages', 'Dinner with my sister was lovely', 'Family video call made me happy', 'Hiked up the hill with friends',
    ];
    const docs: AiDocument[] = texts.map((text, i) => ({ key: `journal:${i}`, source: 'journal', sourceId: String(i), date: '2026-11-1' + (i % 9), title: 'Journal entry', text }));
    const themes = computeThemes(docs, await embed(texts), await embed(THEME_NAMES), THEME_NAMES, '2026-11-21');
    expect(themes.length).toBeGreaterThanOrEqual(2);
    const study = themes.find((t) => t.docs.some((d) => d.text.startsWith('Exam')))!;
    expect(study.docs.every((d) => !d.text.includes('Mom'))).toBe(true);
    expect(study.name).toMatch(/Stud|Languages|Research/);
  });

  it('sums up a week in its most representative, varied sentences', async () => {
    const week = 'Monday was rough, I was really stressed about the thesis deadline. I stayed up revising. Tuesday I studied kanji for an hour and it finally clicked. Called Mom in the evening, it made me feel calmer. Wednesday the lab experiment failed again and I felt drained. I could not sleep well. Thursday I went for a walk by the lake at sunset.';
    const sentences = splitSentences(week);
    const picks = summarise(await embed(sentences), 3, sentences.map((s) => s.length)).map((i) => sentences[i]);
    expect(picks).toHaveLength(3);
    expect(picks.some((p) => /deadline/.test(p))).toBe(true);
    expect(picks).not.toContain('I stayed up revising.');
  });

  it('suggests fitting tags for new writing', async () => {
    const names = Object.keys(STARTER_TAGS);
    const vs = await embed(Object.values(STARTER_TAGS));
    const starters = names.map((tag, i) => ({ tag, vector: vs[i] }));
    const top = async (t: string) => scoreTags((await embed([t]))[0], [], starters)[0]?.tag;
    expect(await top('So tired, could not sleep at all')).toBe('rest');
    expect(await top('Paid rent and tried to budget better')).toBe('money');
    expect(await top('Walked by the lake at sunset')).toBe('nature');
  });
});
