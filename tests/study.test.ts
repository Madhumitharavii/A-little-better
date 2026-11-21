import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import {
  addStarterSubjects,
  getSubjects,
  getStudySessions,
  logStudySession,
  removeSubject,
  moveTopic,
  updateTopic,
} from '@/db/repositories/studyRepository';
import { getLifeItems, getLifeCounts, searchLifeItems, getRecentlyAdded } from '@/db/repositories/lifeRepository';
import { elapsedSeconds, formatClock } from '@/features/study/studyTimer';
import { allInsights, type AdvisorData } from '@/features/advisor/rules';
import type { SubjectItem, StudySessionItem } from '@/db/schema';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('study log', () => {
  it('starter subjects are added once, in order, with topics', async () => {
    await addStarterSubjects();
    await addStarterSubjects(); // tapping twice doesn't duplicate
    const subjects = await getSubjects();
    expect(subjects.map((s) => s.title)).toEqual(['Japanese', 'Aptitude', 'Python', 'Machine Learning']);
    expect(subjects[0].topics.map((t) => t.name)).toContain('Katakana');
  });

  it('logging a session saves date + minutes and moves the topic to "Learning"', async () => {
    await addStarterSubjects();
    const [japanese] = await getSubjects();
    const katakana = japanese.topics.find((t) => t.name === 'Katakana')!;
    await logStudySession({ subject: japanese, topicId: katakana.id, minutes: 42, date: '2026-11-21', note: 'ア to ン' });
    const [session] = await getStudySessions();
    expect(session).toMatchObject({ subjectId: japanese.id, topicId: katakana.id, minutes: 42, date: '2026-11-21', title: 'Japanese · Katakana', notes: 'ア to ン' });
    expect((await getSubjects())[0].topics.find((t) => t.id === katakana.id)?.status).toBe('learning');
  });

  it('topics can be renamed, re-statused and reordered', async () => {
    await addStarterSubjects();
    const [japanese] = await getSubjects();
    const [first, second] = japanese.topics;
    await updateTopic(japanese.id, first.id, { name: 'Hiragana (all 46)', status: 'confident' });
    await moveTopic(japanese.id, second.id, -1);
    const topics = (await getSubjects())[0].topics;
    expect(topics[0].id).toBe(second.id);
    expect(topics[1]).toMatchObject({ name: 'Hiragana (all 46)', status: 'confident' });
  });

  it('removing a subject removes its sessions too (soft delete, so it syncs)', async () => {
    await addStarterSubjects();
    const [japanese] = await getSubjects();
    await logStudySession({ subject: japanese, minutes: 10 });
    await removeSubject(japanese.id);
    expect((await getSubjects()).map((s) => s.title)).not.toContain('Japanese');
    expect(await getStudySessions()).toEqual([]);
    expect((await db.lifeItems.get(japanese.id))?.deletedAt).toBeTruthy();
  });

  it('study never shows up on the Life page', async () => {
    await addStarterSubjects();
    const [japanese] = await getSubjects();
    await logStudySession({ subject: japanese, minutes: 10 });
    expect(await getLifeItems()).toEqual([]);
    expect(await searchLifeItems('japanese')).toEqual([]);
    expect(await getRecentlyAdded()).toEqual([]);
    expect(Object.values(await getLifeCounts()).every((n) => n === 0)).toBe(true);
  });
});

describe('study timer', () => {
  it('measures from the start time, so closing the app does not lose time', () => {
    const startedAt = new Date('2026-11-21T10:00:00Z').toISOString();
    expect(elapsedSeconds({ subjectId: 'x', startedAt }, Date.parse('2026-11-21T11:23:05Z'))).toBe(5 * 60 + 23 * 60 + 60 * 60 - 5 * 60 + 5);
    expect(formatClock(83 * 60 + 5)).toBe('1:23:05');
    expect(formatClock(9 * 60 + 7)).toBe('9:07');
  });
});

describe('study advice', () => {
  const TODAY = '2026-11-21';
  const base = (partial: Partial<AdvisorData>): AdvisorData => ({ today: TODAY, care: [], journal: [], reflections: [], life: [], people: [], toolEvents: [], subjects: [], studySessions: [], ...partial });
  const subject = (title: string, created = '2026-10-01'): SubjectItem => ({
    id: title, type: 'subject', title, createdAt: `${created}T10:00:00Z`, updatedAt: `${created}T10:00:00Z`,
    topics: [{ id: `${title}-t1`, name: 'Katakana', status: 'learning' }, { id: `${title}-t2`, name: 'Kanji', status: 'notStarted' }],
  });
  const session = (subjectId: string, date: string, minutes: number): StudySessionItem => ({ id: `${subjectId}${date}${minutes}`, type: 'studySession', title: subjectId, subjectId, date, minutes, createdAt: `${date}T10:00:00Z`, updatedAt: `${date}T10:00:00Z` });

  it('names a subject that has gone quiet and the topic to pick up', () => {
    const insight = allInsights(base({ subjects: [subject('Japanese')], studySessions: [session('Japanese', '2026-11-11', 30)] })).find((i) => i.rule === 'subject-gap')!;
    expect(insight.message).toContain('Japanese');
    expect(insight.message).toContain('Katakana');
    expect(insight.because).toBe('Last Japanese session was 10 days ago.');
  });

  it('celebrates a strong study week with the real time', () => {
    const sessions = [session('Python', '2026-11-20', 120), session('Python', '2026-11-19', 90)];
    const insight = allInsights(base({ subjects: [subject('Python')], studySessions: sessions })).find((i) => i.rule === 'study-kudos')!;
    expect(insight.because).toContain('3h 30m');
    expect(insight.message).toContain('Python');
  });

  it('counts study time when balancing screen time', () => {
    const series = {
      id: 'sh', type: 'series' as const, title: 'Show', createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z',
      seasons: [{ id: 's', number: 1, episodes: [1, 2, 3, 4, 5].map((n) => ({ id: `e${n}`, number: n, watched: true, dateWatched: '2026-11-20' })) }],
    };
    const studied = allInsights(base({ life: [series], subjects: [subject('Japanese')], studySessions: [session('Japanese', '2026-11-20', 90)] }));
    expect(studied.some((i) => i.rule === 'screen-balance')).toBe(false);
  });
});
