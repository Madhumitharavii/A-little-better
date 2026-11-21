import { describe, it, expect } from 'vitest';
import { goalProgress, weekBounds, daysLeftInWeek, describeProgress } from '@/features/study/goals';
import { allInsights, type AdvisorData } from '@/features/advisor/rules';
import type { LifeItem, StudySessionItem, SubjectItem } from '@/db/schema';

const subject = (title: string, weeklyGoal?: SubjectItem['weeklyGoal']): SubjectItem => ({
  id: title, type: 'subject', title, weeklyGoal, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
  topics: [{ id: 't', name: 'Katakana', status: 'learning' }],
});
const session = (subjectId: string, date: string, minutes: number): StudySessionItem => ({
  id: `${subjectId}${date}${minutes}`, type: 'studySession', title: subjectId, subjectId, date, minutes, createdAt: `${date}T10:00:00Z`, updatedAt: `${date}T10:00:00Z`,
});
const base = (today: string, partial: Partial<AdvisorData>): AdvisorData => ({ today, care: [], journal: [], reflections: [], life: [], people: [], toolEvents: [], subjects: [], studySessions: [], ...partial });

describe('weekly goals', () => {
  it('weeks run Monday to Sunday', () => {
    expect(weekBounds('2026-11-21')).toEqual({ start: '2026-11-16', end: '2026-11-22' }); // Saturday
    expect(weekBounds('2026-11-23')).toEqual({ start: '2026-11-23', end: '2026-11-29' }); // Monday
    expect(daysLeftInWeek('2026-11-23')).toBe(6);
    expect(daysLeftInWeek('2026-11-29')).toBe(0);
  });

  it('counts time and distinct days within the week only', () => {
    const japanese = subject('Japanese', { minutes: 120, days: 3 });
    const sessions = [session('Japanese', '2026-11-16', 30), session('Japanese', '2026-11-16', 20), session('Japanese', '2026-11-18', 40), session('Japanese', '2026-11-24', 90)];
    const p = goalProgress(japanese, sessions, '2026-11-16');
    expect(p).toMatchObject({ minutes: 90, days: 2, minutesMet: false, daysMet: false, met: false });
    expect(describeProgress(p)).toBe('1h 30m of 2h · 2 of 3 days');
  });

  it('a days-only goal is met by days alone', () => {
    const p = goalProgress(subject('Aptitude', { days: 2 }), [session('Aptitude', '2026-11-17', 10), session('Aptitude', '2026-11-19', 10)], '2026-11-16');
    expect(p.met).toBe(true);
  });
});

describe('goal advice', () => {
  const dreams: LifeItem[] = [
    { id: 'w1', type: 'wish', title: 'Visit Japan', listType: 'annualVision', createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:00:00Z' },
  ];

  it('on Monday, gently names last week\'s missed goals and links to the dream', () => {
    const insight = allInsights(
      base('2026-11-23', {
        life: dreams,
        subjects: [subject('Japanese', { minutes: 120 }), subject('Aptitude', { days: 3 })],
        studySessions: [session('Japanese', '2026-11-18', 40), session('Aptitude', '2026-11-19', 30)],
      }),
    ).find((i) => i.rule === 'goals-missed')!;
    expect(insight.message).toMatch(/Japanese and Aptitude/);
    expect(insight.message).toMatch(/okay|No pressure/);
    expect(insight.message).toContain('"Visit Japan"');
    expect(insight.because).toBe('Japanese: 40m of 2h; Aptitude: 1 of 3 days last week.');
  });

  it('on Monday, celebrates when every goal was met', () => {
    const insight = allInsights(
      base('2026-11-23', { subjects: [subject('Python', { minutes: 60 })], studySessions: [session('Python', '2026-11-20', 75)] }),
    ).find((i) => i.rule === 'goals-met');
    expect(insight?.kind).toBe('kudos');
  });

  it('late in the week, says exactly what is left', () => {
    const insight = allInsights(
      base('2026-11-27', { life: dreams, subjects: [subject('Japanese', { minutes: 120, days: 3 })], studySessions: [session('Japanese', '2026-11-24', 45)] }),
    ).find((i) => i.rule === 'goal-behind')!;
    expect(insight.message).toContain('1h 15m and 2 more days');
    expect(insight.message).toContain('3 days left including today');
    expect(insight.message).toContain('Visit Japan');
  });

  it('does not judge last week mid-week, or this week early on', () => {
    const data = base('2026-11-27', { subjects: [subject('Japanese', { minutes: 120 })], studySessions: [] });
    expect(allInsights(data).some((i) => i.rule === 'goals-missed')).toBe(false);
    const monday = base('2026-11-23', { subjects: [subject('Japanese', { minutes: 120 })], studySessions: [session('Japanese', '2026-11-17', 200)] });
    expect(allInsights(monday).some((i) => i.rule === 'goal-behind')).toBe(false);
  });
});
