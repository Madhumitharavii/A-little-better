import { describe, it, expect } from 'vitest';
import { allInsights, type AdvisorData } from '@/features/advisor/rules';
import { chooseToday, dismissRule, emptyHistory } from '@/features/advisor/select';
import { themesIn } from '@/features/advisor/lexicon';
import type { CareEntry, LifeItem, Person, ToolEvent, JournalEntry } from '@/db/schema';

const TODAY = '2026-11-21';
const iso = (date: string, time = '12:00') => new Date(`${date}T${time}:00`).toISOString();
const daysAgo = (n: number) => {
  const d = new Date(`${TODAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

function data(partial: Partial<AdvisorData>): AdvisorData {
  return { today: TODAY, care: [], journal: [], reflections: [], life: [], people: [], toolEvents: [], subjects: [], studySessions: [], ...partial };
}

const scrollTap = (n: number, hour = '22:30'): ToolEvent => ({ id: `s${n}`, tool: 'scrolling', at: iso(daysAgo(n % 6), hour) });
const person = (name: string, last?: string): Person => ({ id: name, name, lastContactedAt: last, createdAt: iso(daysAgo(40)), updatedAt: iso(daysAgo(40)) });

describe('advice is built from real data', () => {
  it('names the show and the numbers when watching crowds out study time', () => {
    const series: LifeItem = {
      id: 'sh', type: 'series', title: 'The Bear', createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(1)),
      seasons: [{ id: 's1', number: 1, episodes: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, number: i + 1, watched: true, dateWatched: daysAgo(i % 5) })) }],
    };
    const [top] = allInsights(data({ life: [series] })).filter((i) => i.rule === 'screen-balance');
    expect(top.message).toMatch(/stud/i);
    expect(top.because).toContain('6 episodes');
    expect(top.because).toContain('"The Bear"');
    expect(top.because).toContain('0 minutes of study or focus');
  });

  it('suggests uninstalling after a lot of doom-scrolling, and mentions late nights', () => {
    const insight = allInsights(data({ toolEvents: Array.from({ length: 7 }, (_, i) => scrollTap(i)) })).find((i) => i.rule === 'scrolling')!;
    expect(insight.message).toMatch(/uninstall|delet/i);
    expect(insight.because).toMatch(/7 times this week, 7 of them late at night/);
  });

  it('names the person you have not connected with for longest', () => {
    const insight = allInsights(data({ people: [person('Sam', daysAgo(3)), person('Alex', daysAgo(25))] })).find((i) => i.rule === 'people-gap')!;
    expect(insight.message).toContain('Alex');
    expect(insight.because).toBe('You last connected with Alex 25 days ago.');
  });

  it('celebrates a finished book by title', () => {
    const book: LifeItem = { id: 'b', type: 'book', title: 'Piranesi', status: 'finished', dateFinished: daysAgo(2), createdAt: iso(daysAgo(30)), updatedAt: iso(daysAgo(2)) };
    const insight = allInsights(data({ life: [book] })).find((i) => i.rule === 'reading-kudos')!;
    expect(insight.kind).toBe('kudos');
    expect(insight.message).toContain('"Piranesi"');
  });

  it('says nothing when there is nothing real to say', () => {
    expect(allInsights(data({}))).toEqual([]);
  });

  it('meets very heavy writing with support, first, and no advice', () => {
    const journal: JournalEntry[] = [{ id: 'j', date: daysAgo(1), body: 'I feel hopeless lately', createdAt: iso(daysAgo(1)), updatedAt: iso(daysAgo(1)) }];
    const [first] = allInsights(data({ journal, toolEvents: Array.from({ length: 7 }, (_, i) => scrollTap(i)) }));
    expect(first.rule).toBe('journal-heavy');
    expect(first.message).toMatch(/someone you trust/);
  });
});

describe('with on-device AI', () => {
  const entry = (body: string): JournalEntry => ({ id: body, date: daysAgo(1), body, createdAt: iso(daysAgo(1)), updatedAt: iso(daysAgo(1)) });
  it("uses the model's emotion reading instead of the word list", () => {
    // The words alone don't say "stressed", but the model read two entries as anxious.
    const journal = [entry('Big day tomorrow, so much riding on it'), entry('Could not focus at all, mind racing')];
    const insight = allInsights(data({ journal, aiThemeCounts: { stressed: 2 } })).find((i) => i.rule === 'journal-stressed')!;
    expect(insight.because).toContain('(understood on this device)');
  });
  it('still screens very heavy writing with the word list', () => {
    const [first] = allInsights(data({ journal: [entry('I feel hopeless lately')], aiThemeCounts: { happy: 3 } }));
    expect(first.rule).toBe('journal-heavy');
  });
});

describe('reading the journal on-device', () => {
  it('understands "didn\'t cry" is not sadness', () => {
    expect(themesIn("I was sad but I didn't cry much").has('low')).toBe(true); // "sad" still counts
    expect(themesIn("I didn't cry much today").has('low')).toBe(false);
    expect(themesIn('Not tired at all, great day!').has('tired')).toBe(false);
    expect(themesIn('So exhausted after the exam').has('tired')).toBe(true);
  });
});

describe('not repeating', () => {
  const care: CareEntry[] = [];
  const advice = () => allInsights(data({ care, people: [person('Alex', daysAgo(25))], toolEvents: Array.from({ length: 4 }, (_, i) => scrollTap(i, '15:00')) }));

  it('keeps the same picks all day, then rests them for a few days', () => {
    const day1 = chooseToday(advice(), emptyHistory(), TODAY);
    expect(day1.picks.length).toBe(2);
    const later = chooseToday(advice(), day1.history, TODAY);
    expect(later.picks.map((p) => p.key)).toEqual(day1.picks.map((p) => p.key));

    const nextDay = chooseToday(advice(), day1.history, '2026-11-22');
    const overlap = nextDay.picks.filter((p) => day1.picks.some((q) => q.key === p.key));
    expect(overlap).toEqual([]);
  });

  it('brings advice back sooner if what it is based on changes', () => {
    const day1 = chooseToday(advice(), emptyHistory(), TODAY);
    const changed = advice().map((i) => (i.rule === 'scrolling' ? { ...i, fingerprint: 'more-scrolling' } : i));
    const nextDay = chooseToday(changed, day1.history, '2026-11-22');
    expect(nextDay.picks.some((p) => p.rule === 'scrolling')).toBe(true);
  });

  it('"Not helpful" quiets that kind of advice for a month', () => {
    const quiet = dismissRule(emptyHistory(), 'scrolling', TODAY);
    const soon = chooseToday(advice(), quiet, '2026-12-01');
    expect(soon.picks.some((p) => p.rule === 'scrolling')).toBe(false);
    const later = chooseToday(advice(), quiet, '2026-12-25');
    expect(later.picks.some((p) => p.rule === 'scrolling')).toBe(true);
  });
});
