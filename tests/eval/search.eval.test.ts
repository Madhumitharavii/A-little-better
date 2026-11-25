/**
 * "Search by meaning" on made-up notes, with the real on-device model:
 * a feeling search ("times I felt sad") should find the sad writing —
 * including one sad sentence inside a long, busy entry — and leave out
 * notes that just happen to look similar.  Run with:  npm run eval
 */
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { splitSentences, type SoftmaxModel } from '@/features/ai/ml';
import headJson from '@/features/ai/emotionHead.json';
import { queryEmotion, rankByMeaning } from '@/features/ai/searchRank';

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

const NOTES: [string, string][] = [
  ['news', 'Scholarship news came in. Heard from a friend that nobody from our batch got it. Sucks. I was sad but I didn’t cry much, which is a shocker. Anyway today I feel fine.'],
  ['actor', 'Getting my daily dose of my favourite actor'],
  ['writer', 'The writer just gets people'],
  ['villains', 'I too would fight seven villains if it is for her'],
  ['war', 'A love story nobody knew, because war doesn’t stop. This brutal, tender book broke and mended me, but I don’t feel so whole anymore.'],
  ['sobbing', 'I was a sobbing mess by the end of the movie'],
  ['fight', 'I would have loved it if it was just the fight scene on a loop for three hours, but I guess we’re not that lucky.'],
  ['beach', 'Such a fun day at the beach, we laughed so much'],
  ['grandma', 'Missing grandma so much today. The house feels empty.'],
  ['night', 'Went to class, had lunch with friends, did groceries. Then at night I just cried for an hour without knowing why.'],
];

async function search(query: string) {
  const entries = [];
  for (const [id, text] of NOTES) {
    const parts = splitSentences(text);
    const units = parts.length > 1 ? [text, ...parts] : [text];
    const vectors = await embed(units);
    entries.push({ item: id, units: units.map((t, i) => ({ text: t, vector: vectors[i] })) });
  }
  const [q] = await embed([query]);
  return rankByMeaning(q, entries, headJson as unknown as SoftmaxModel, queryEmotion(query));
}

describe('search by meaning', () => {
  it('finds sad writing for "times I felt sad", and not look-alikes', async () => {
    const hits = await search('times I felt sad');
    const ids = hits.map((h) => h.item);
    for (const sad of ['news', 'war', 'sobbing', 'night', 'grandma']) expect(ids).toContain(sad);
    for (const not of ['actor', 'writer', 'villains', 'beach', 'fight']) expect(ids).not.toContain(not);
    // The long entry is found by its sad sentence, which is pointed out.
    expect(hits.find((h) => h.item === 'night')?.sentence).toMatch(/cried/);
  }, 60_000);

  it('still works for searches that are not about a feeling', async () => {
    const hits = await search('a day out by the sea');
    expect(hits[0].item).toBe('beach');
  }, 60_000);
});
