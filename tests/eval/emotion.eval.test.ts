/**
 * Evaluation of the on-device emotion classifier on a held-out labelled
 * set (tests/eval/emotionDataset.ts), compared with the original
 * keyword (word-list) baseline. Prints accuracy, macro-F1, per-class
 * precision/recall and a confusion matrix; fails if the model doesn't
 * clearly beat the baseline.  Run with:  npm run eval
 */
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { EMOTION_EXAMPLES, buildPrototypes, classifyEmotion, classifyEmotionWithHead, type Emotion, type SoftmaxModel } from '@/features/ai/ml';
import headJson from '@/features/ai/emotionHead.json';
import { themesIn, type Theme } from '@/features/advisor/lexicon';
import { EMOTION_EVAL } from './emotionDataset';

type Label = Emotion | 'neutral';
const LABELS: Label[] = ['joy', 'calm', 'gratitude', 'sadness', 'anxiety', 'anger', 'loneliness', 'tiredness', 'neutral'];

/** The word-list baseline, mapped onto the same labels (it has no notion of calm or anger). */
const THEME_TO_EMOTION: Partial<Record<Theme, Emotion>> = { tired: 'tiredness', stressed: 'anxiety', low: 'sadness', lonely: 'loneliness', happy: 'joy', grateful: 'gratitude' };
function baseline(text: string): Label {
  const themes = themesIn(text);
  for (const t of ['grateful', 'lonely', 'tired', 'stressed', 'low', 'happy'] as Theme[]) if (themes.has(t)) return THEME_TO_EMOTION[t]!;
  return 'neutral';
}

function metrics(truth: Label[], pred: Label[]) {
  const matrix = LABELS.map((t) => LABELS.map((p) => truth.filter((x, i) => x === t && pred[i] === p).length));
  const perClass = LABELS.map((l, i) => {
    const tp = matrix[i][i];
    const predicted = matrix.reduce((s, row) => s + row[i], 0);
    const actual = matrix[i].reduce((a, b) => a + b, 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = actual ? tp / actual : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { label: l, precision, recall, f1 };
  });
  const accuracy = truth.filter((t, i) => t === pred[i]).length / truth.length;
  const macroF1 = perClass.reduce((s, c) => s + c.f1, 0) / perClass.length;
  return { accuracy, macroF1, perClass, matrix };
}

let model: FeatureExtractionPipeline;
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
}, 120_000);

describe('emotion classifier evaluation', () => {
  it('beats the word-list baseline on held-out diary sentences', async () => {
    const byEmotion = {} as Record<Emotion, number[][]>;
    for (const e of Object.keys(EMOTION_EXAMPLES) as Emotion[]) byEmotion[e] = await embed(EMOTION_EXAMPLES[e]);
    const protos = buildPrototypes(byEmotion);
    const vectors = await embed(EMOTION_EVAL.map((x) => x.text));

    const truth: Label[] = EMOTION_EVAL.map((x) => x.label ?? 'neutral');
    const proto = metrics(truth, vectors.map((v) => classifyEmotion(v, protos).emotion ?? 'neutral'));
    const head = headJson as unknown as SoftmaxModel & { minConfidence: number };
    const model_ = metrics(truth, vectors.map((v) => classifyEmotionWithHead(v, head, head.minConfidence).emotion ?? 'neutral'));
    const base = metrics(truth, EMOTION_EVAL.map((x) => baseline(x.text)));

    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    const lines = [
      `n = ${truth.length} (10 per class, 9 classes)`,
      '',
      '| | Accuracy | Macro-F1 |',
      '|---|---|---|',
      `| Word-list baseline | ${pct(base.accuracy)} | ${base.macroF1.toFixed(3)} |`,
      `| Prototype classifier (v1, 4 examples per emotion) | ${pct(proto.accuracy)} | ${proto.macroF1.toFixed(3)} |`,
      `| Trained classifier head (v2, softmax regression) | ${pct(model_.accuracy)} | ${model_.macroF1.toFixed(3)} |`,
      '',
      '| Class | Precision | Recall | F1 |',
      '|---|---|---|---|',
      ...model_.perClass.map((c) => `| ${c.label} | ${c.precision.toFixed(2)} | ${c.recall.toFixed(2)} | ${c.f1.toFixed(2)} |`),
      '',
      'Confusion matrix (rows = true, columns = predicted):',
      '',
      `| | ${LABELS.join(' | ')} |`,
      `|---|${LABELS.map(() => '---').join('|')}|`,
      ...model_.matrix.map((row, i) => `| **${LABELS[i]}** | ${row.join(' | ')} |`),
    ];
    console.log(lines.join('\n'));

    expect(model_.accuracy).toBeGreaterThan(base.accuracy + 0.15);
    expect(model_.macroF1).toBeGreaterThan(proto.macroF1);
  });
});
