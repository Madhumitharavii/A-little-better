import { describe, it, expect } from 'vitest';
import { cosine, normalize, topK, kMeans, silhouette, chooseClusters, clusterKeywords, buildPrototypes, classifyEmotion, trainSoftmax, predictSoftmax, stratifiedFolds, classifyEmotionWithHead, nameClusters, seededRandom, splitSentences, textRank, mmrSelect, summarise, scoreTags, type Emotion } from '@/features/ai/ml';
import { emotionTrend, weekSentences } from '@/features/ai/analysis';
import { collectDocuments, textHash } from '@/features/ai/documents';

/** Points scattered around a few directions in 8-D space. */
function blobs(centres: number[][], perBlob: number, spread: number, seed = 1) {
  const rand = seededRandom(seed);
  const vectors: number[][] = [];
  const truth: number[] = [];
  centres.forEach((c, k) => {
    for (let i = 0; i < perBlob; i++) {
      vectors.push(normalize(c.map((x) => x + (rand() - 0.5) * spread)));
      truth.push(k);
    }
  });
  return { vectors, truth };
}
const axis = (i: number, d = 8) => Array.from({ length: d }, (_, j) => (j === i ? 1 : 0));

describe('vectors & search', () => {
  it('cosine similarity behaves', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
  it('topK returns the nearest items above the threshold, best first', () => {
    const items = [axis(0), axis(1), normalize([1, 1, 0, 0, 0, 0, 0, 0])].map((vector, i) => ({ item: `doc${i}`, vector }));
    const res = topK(axis(0), items, 2, 0.5);
    expect(res.map((r) => r.item)).toEqual(['doc0', 'doc2']);
  });
});

describe('clustering', () => {
  const { vectors, truth } = blobs([axis(0), axis(3), axis(6)], 8, 0.4);

  it('k-means recovers well-separated groups', () => {
    const { labels } = kMeans(vectors, 3, 7);
    // same-truth points share a label, different-truth points don't
    for (let i = 0; i < vectors.length; i++) for (let j = 0; j < vectors.length; j++) expect(labels[i] === labels[j]).toBe(truth[i] === truth[j]);
  });
  it('silhouette is high for the right k and lower for a wrong one', () => {
    expect(silhouette(vectors, kMeans(vectors, 3, 7).labels)).toBeGreaterThan(0.6);
    expect(silhouette(vectors, kMeans(vectors, 3, 7).labels)).toBeGreaterThan(silhouette(vectors, kMeans(vectors, 2, 7).labels));
  });
  it('chooses the number of themes automatically', () => {
    expect(chooseClusters(vectors)?.k).toBe(3);
    expect(chooseClusters(vectors.slice(0, 4))).toBeNull(); // too few entries
  });
  it('is reproducible with the same seed', () => {
    expect(kMeans(vectors, 3, 11).labels).toEqual(kMeans(vectors, 3, 11).labels);
  });
});

describe('naming themes', () => {
  it('c-TF-IDF keywords favour words shared within a theme', () => {
    const texts = ['exam revision tonight', 'exam stress and revision', 'called mom tonight', 'dinner with mom'];
    const kw = clusterKeywords(texts, [0, 0, 1, 1], 2, 2);
    expect(kw[0]).toEqual(expect.arrayContaining(['exam', 'revision']));
    expect(kw[1][0]).toBe('mom');
  });
  it('zero-shot names pick the closest label, each used once', () => {
    const names = nameClusters([axis(0), axis(1)], [axis(1), axis(0), axis(2)], ['Family', 'Studies', 'Travel']);
    expect(names).toEqual(['Studies', 'Family']);
  });
});

describe('emotion prototypes', () => {
  const examples = { joy: [axis(0)], calm: [axis(1)], gratitude: [axis(2)], sadness: [axis(3)], anxiety: [axis(4)], anger: [axis(5)], loneliness: [axis(6)], tiredness: [axis(7)] } as Record<Emotion, number[][]>;
  const protos = buildPrototypes(examples);
  it('labels a clear match and gives probabilities that sum to 1', () => {
    const r = classifyEmotion(normalize([0, 0, 0, 0, 1, 0.1, 0, 0]), protos);
    expect(r.emotion).toBe('anxiety');
    expect(Object.values(r.probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it('leaves neutral writing unlabelled', () => {
    expect(classifyEmotion(normalize(Array(8).fill(1)), protos).emotion).toBeNull();
  });
});

describe('documents', () => {
  it('collects journal, reflections, Life notes and study notes; skips empty and deleted', () => {
    const now = '2026-11-20T10:00:00Z';
    const docs = collectDocuments({
      journal: [
        { id: 'j1', date: '2026-11-20', title: 'Exam week', body: 'A bit stressed about the deadline.', createdAt: now, updatedAt: now },
        { id: 'j2', date: '2026-11-19', body: 'deleted entry text here', createdAt: now, updatedAt: now, deletedAt: now },
      ],
      reflections: [{ id: 'r1', date: '2026-11-20', gratitude: 'my friends', createdAt: now, updatedAt: now }],
      life: [
        { id: 'b1', type: 'book', title: 'Piranesi', notes: 'Strange, beautiful and kind.', createdAt: now, updatedAt: now },
        { id: 'b2', type: 'book', title: 'No notes', createdAt: now, updatedAt: now },
      ],
      studySessions: [{ id: 's1', type: 'studySession', title: 'Japanese · Kanji', subjectId: 'x', date: '2026-11-20', minutes: 20, notes: 'Mixed up 日 and 目', createdAt: now, updatedAt: now }],
    });
    expect(docs.map((d) => d.key)).toEqual(['journal:j1', 'reflection:r1', 'life:b1', 'study:s1']);
    expect(textHash('a')).not.toBe(textHash('b'));
  });
});

describe('summarising the week', () => {
  it('splits writing into sentences', () => {
    expect(splitSentences('Stressed about the thesis. Called Mom! Ok. Walked by the lake at sunset?')).toEqual(['Stressed about the thesis.', 'Called Mom!', 'Walked by the lake at sunset?'].filter((x) => x.length >= 12));
  });
  it('TextRank ranks the sentence most like the others highest', () => {
    const vs = [normalize([1, 0.1, 0]), normalize([1, 0.2, 0]), normalize([0.9, 0.1, 0.1]), normalize([0, 0, 1])];
    const r = textRank(vs);
    expect(r.indexOf(Math.max(...r))).not.toBe(3);
    expect(Math.min(...r)).toBe(r[3]);
  });
  it('MMR avoids picking near-duplicates', () => {
    const vs = [normalize([1, 0, 0]), normalize([1, 0.01, 0]), normalize([0, 1, 0])];
    expect(mmrSelect([1, 0.99, 0.6], vs, 2, 0.5).sort()).toEqual([0, 2]);
  });
  it('summarise returns picks in their original order', () => {
    const vs = [axis(0), axis(1), normalize([1, 1, 0, 0, 0, 0, 0, 0]), axis(2), normalize([0, 1, 1, 0, 0, 0, 0, 0])];
    const picks = summarise(vs, 3);
    expect(picks).toHaveLength(3);
    expect([...picks].sort((a, b) => a - b)).toEqual(picks);
  });
  it('collects only the last 7 days of journal, reflections and study notes, minus titles', () => {
    const doc = (key: string, source: 'journal' | 'life', date: string, title: string, text: string) => ({ key, source, sourceId: key, date, title, text });
    const s = weekSentences([doc('j1', 'journal', '2026-11-20', 'Exam week', 'Exam week. A bit stressed about the deadline.'), doc('j2', 'journal', '2026-11-01', 'Old', 'Old. An entry from weeks ago here.'), doc('l1', 'life', '2026-11-20', 'Book', 'Book. Lovely notes about it.')], '2026-11-21');
    expect(s.map((x) => x.text)).toEqual(['A bit stressed about the deadline.']);
  });
});

describe('emotion trend', () => {
  it('buckets entries into Monday–Sunday weeks', () => {
    const docs = [
      { key: 'journal:a', source: 'journal' as const, sourceId: 'a', date: '2026-11-17', title: 'A', text: 'x' },
      { key: 'journal:b', source: 'journal' as const, sourceId: 'b', date: '2026-11-21', title: 'B', text: 'y' },
      { key: 'journal:c', source: 'journal' as const, sourceId: 'c', date: '2026-11-12', title: 'C', text: 'z' },
    ];
    const weeks = emotionTrend(docs, { 'journal:a': 'anxiety', 'journal:b': 'anxiety', 'journal:c': null }, '2026-11-21', 2);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-11-09', '2026-11-16']);
    expect(weeks[1].counts).toEqual({ anxiety: 2 });
    expect(weeks[0].entries).toHaveLength(1);
  });
});

describe('tag suggestions', () => {
  it('prefers tags the person already uses, skips ones already added', () => {
    const learned = [{ tag: 'japanese', centroid: axis(0), count: 4 }];
    const starters = [{ tag: 'study', vector: normalize([1, 0.3, 0, 0, 0, 0, 0, 0]) }, { tag: 'family', vector: axis(1) }];
    expect(scoreTags(axis(0), learned, starters).map((t) => t.tag)).toEqual(['japanese', 'study']);
    expect(scoreTags(axis(0), learned, starters, ['japanese']).map((t) => t.tag)).toEqual(['study']);
  });
});

describe('softmax regression (trained head)', () => {
  // Three separable clusters in 2-D.
  const X = [[1, 0.1], [0.9, -0.1], [1, 0], [-1, 0.1], [-0.9, 0], [-1, -0.1], [0, 1], [0.1, 0.9], [-0.1, 1]];
  const y = [0, 0, 0, 1, 1, 1, 2, 2, 2];
  const model = trainSoftmax(X, y, ['joy', 'sadness', 'neutral'], { l2: 1e-3, epochs: 300 });
  it('learns separable classes and outputs probabilities', () => {
    X.forEach((x, i) => {
      const p = predictSoftmax(model, x);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      expect(p.indexOf(Math.max(...p))).toBe(y[i]);
    });
  });
  it('maps the neutral class (and low confidence) to null', () => {
    expect(classifyEmotionWithHead([0, 1], model).emotion).toBeNull();
    expect(classifyEmotionWithHead([1, 0], model).emotion).toBe('joy');
    expect(classifyEmotionWithHead([1, 0], model, 0.999999).emotion).toBeNull();
  });
  it('is deterministic', () => {
    expect(trainSoftmax(X, y, ['a', 'b', 'c'], { epochs: 50 }).W).toEqual(trainSoftmax(X, y, ['a', 'b', 'c'], { epochs: 50 }).W);
  });
  it('stratified folds spread every class across folds', () => {
    const folds = stratifiedFolds(y, 3);
    for (const c of [0, 1, 2]) expect(new Set(folds.filter((_, i) => y[i] === c))).toEqual(new Set([0, 1, 2]));
  });
});
