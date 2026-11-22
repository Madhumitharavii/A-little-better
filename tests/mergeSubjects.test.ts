import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import { getSubjects, getStudySessions, mergeDuplicateSubjects } from '@/db/repositories/studyRepository';
import type { LifeItem } from '@/db/schema';

describe('merging doubled study subjects', () => {
  beforeEach(async () => {
    await db.lifeItems.clear();
  });

  it('keeps the oldest copy, merges topics and moves sessions — and is safe to run again', async () => {
    await db.lifeItems.bulkAdd([
      { id: 'mac', type: 'subject', title: 'Japanese', icon: '🇯🇵', topics: [{ id: 'm1', name: 'Kanji', status: 'notStarted' }], createdAt: '2026-11-20T10:00:00.000Z', updatedAt: 'x' },
      { id: 'phone', type: 'subject', title: 'japanese', topics: [{ id: 'p1', name: 'Kanji', status: 'learning' }, { id: 'p2', name: 'Grammar', status: 'notStarted' }], weeklyGoal: { minutes: 120 }, createdAt: '2026-11-21T10:00:00.000Z', updatedAt: 'x' },
      { id: 's1', type: 'studySession', title: 'Japanese · Kanji', subjectId: 'phone', topicId: 'p1', date: '2026-11-21', minutes: 20, createdAt: 'x', updatedAt: 'x' },
      { id: 'other', type: 'subject', title: 'Python', topics: [], createdAt: '2026-11-20T10:00:00.000Z', updatedAt: 'x' },
    ] as unknown as LifeItem[]);

    expect(await mergeDuplicateSubjects()).toBe(1);
    const subjects = await getSubjects();
    expect(subjects.map((s) => s.id)).toEqual(['mac', 'other']);
    const jp = subjects[0];
    expect(jp.topics).toEqual([
      { id: 'm1', name: 'Kanji', status: 'learning' },
      { id: 'p2', name: 'Grammar', status: 'notStarted' },
    ]);
    expect(jp.weeklyGoal).toEqual({ minutes: 120 });
    expect((await getStudySessions())[0]).toMatchObject({ id: 's1', subjectId: 'mac', topicId: 'm1' });
    expect((await db.lifeItems.get('phone'))?.deletedAt).toBeTruthy();

    expect(await mergeDuplicateSubjects()).toBe(0);
  });
});
