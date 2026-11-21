import { lifeItemActivityDates } from '@/db/lifeDates';
import type {
  CareEntry,
  DailyReflection,
  JournalEntry,
  LifeItem,
  Person,
  ToolEvent,
  BookItem,
  MovieItem,
  SeriesItem,
  ArtworkItem,
  ExperienceItem,
  WishItem,
  SubjectItem,
  StudySessionItem,
} from '@/db/schema';
import { countThemes } from './lexicon';
import { goalProgress, weekBounds, daysLeftInWeek, describeProgress } from '@/features/study/goals';
import { addDays } from '@/db/dateUtils';

/**
 * The advisor's rules. Each looks at what's actually been logged and
 * either returns one specific piece of advice — naming real titles,
 * people, counts and dates, with a "Because…" line showing exactly what
 * it noticed — or nothing. Pure functions: no network, no storage.
 */

export interface AdvisorData {
  /** Local date key, e.g. "2026-11-21". */
  today: string;
  care: CareEntry[];
  journal: JournalEntry[];
  reflections: DailyReflection[];
  life: LifeItem[];
  people: Person[];
  toolEvents: ToolEvent[];
  /** Study subjects (with topics) and sessions — logged on the Week page. */
  subjects: SubjectItem[];
  studySessions: StudySessionItem[];
  /**
   * When on-device AI is on: emotion-based theme counts for recent
   * journal entries and reflections (from the sentence-embedding model),
   * used instead of the word list. The word list still screens for
   * very heavy writing either way.
   */
  aiThemeCounts?: Partial<Record<import('./lexicon').Theme, number>> | null;
}

export type InsightKind = 'kudos' | 'nudge' | 'care';

export interface Insight {
  /** Which rule, plus what it's about (e.g. "people-gap:Alex") — used so the same advice doesn't come back too soon. */
  key: string;
  rule: string;
  kind: InsightKind;
  /** Higher shows first. */
  priority: number;
  icon: string;
  message: string;
  /** What was noticed, in plain words — so the advice can be trusted. */
  because: string;
  /** Changes when the underlying data meaningfully changes (lets advice return sooner if things change). */
  fingerprint: string;
}

// ── date helpers (local date keys) ─────────────────────────────────

const DAY = 86_400_000;
const dayNum = (key: string) => Date.parse(`${key.slice(0, 10)}T00:00:00Z`) / DAY;
const daysBetween = (fromKey: string, toKey: string) => Math.round(dayNum(toKey) - dayNum(fromKey));
const keyOf = (iso: string | undefined) => (iso ? iso.slice(0, 10) : undefined);
/** True if `key` falls within the `days` days ending today (today included). */
const within = (key: string | undefined, today: string, days: number) => {
  if (!key) return false;
  const diff = daysBetween(key, today);
  return diff >= 0 && diff < days;
};
const between = (key: string | undefined, today: string, fromDaysAgo: number, toDaysAgo: number) => {
  if (!key) return false;
  const diff = daysBetween(key, today);
  return diff >= fromDaysAgo && diff < toDaysAgo;
};

/** Picks one of several wordings, varying by day so the same advice never reads identically twice in a row. */
function pick<T>(options: T[], today: string, salt: string): T {
  let h = 0;
  for (const ch of today + salt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const quoteList = (titles: string[], max = 2) => {
  const shown = titles.slice(0, max).map((t) => `"${t}"`);
  const rest = titles.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(' and ');
};

// ── derived facts ──────────────────────────────────────────────────

function careDays(care: CareEntry[], item: CareEntry['itemKey'], today: string, fromDaysAgo: number, toDaysAgo: number) {
  return new Set(care.filter((c) => c.itemKey === item && c.status === 'done' && between(c.date, today, fromDaysAgo, toDaysAgo)).map((c) => c.date)).size;
}

function careMinutes(care: CareEntry[], item: 'reading' | 'focus', today: string, days: number) {
  return care.filter((c) => c.itemKey === item && within(c.date, today, days)).reduce((sum, c) => sum + (c.valueMinutes ?? 0), 0);
}

function studyMinutes(sessions: StudySessionItem[], today: string, days: number, subjectId?: string) {
  return sessions.filter((s) => (!subjectId || s.subjectId === subjectId) && within(s.date, today, days)).reduce((sum, s) => sum + s.minutes, 0);
}

const fmt = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`);

function episodesWatched(series: SeriesItem[], today: string, days: number) {
  const perShow: { title: string; count: number }[] = [];
  for (const show of series) {
    let count = 0;
    for (const season of show.seasons ?? []) for (const ep of season.episodes) if (ep.watched && within(ep.dateWatched, today, days)) count += 1;
    if (count > 0) perShow.push({ title: show.title, count });
  }
  return perShow.sort((a, b) => b.count - a.count);
}

function lastDate(keys: (string | undefined)[]) {
  return keys.filter(Boolean).sort().pop() as string | undefined;
}

// ── the rules ──────────────────────────────────────────────────────

type Rule = (d: AdvisorData) => Insight | null;

/** Lots of watching, little focused work → suggest some study / focus time. */
const screenBalance: Rule = (d) => {
  const movies = d.life.filter((i): i is MovieItem => i.type === 'movie' && lifeItemActivityDates(i).some((date) => within(date, d.today, 7)));
  const shows = episodesWatched(d.life.filter((i): i is SeriesItem => i.type === 'series'), d.today, 7);
  const episodeCount = shows.reduce((s, x) => s + x.count, 0);
  const watched = movies.length + episodeCount;
  const focus = careMinutes(d.care, 'focus', d.today, 7) + studyMinutes(d.studySessions, d.today, 7);
  if (watched < 4 || focus >= 60) return null;
  const titles = [...shows.map((s) => s.title), ...movies.map((m) => m.title)];
  const what = [movies.length ? plural(movies.length, 'movie') : '', episodeCount ? plural(episodeCount, 'episode') : ''].filter(Boolean).join(' and ');
  return {
    key: 'screen-balance',
    rule: 'screen-balance',
    kind: 'nudge',
    priority: 70 + Math.min(watched, 15),
    icon: '📚',
    message: pick(
      [
        `You've had a lot of screen stories lately. Maybe it's a good day for some studying — even 20 minutes with the Focus timer.`,
        `Lots of watching this week, and very little focused time. How about one study session today before the next episode?`,
        `Your stories are clearly keeping you company. Balance it out with a short focus session on your studies today?`,
      ],
      d.today,
      'screen',
    ),
    because: `This week: ${what} (${quoteList(titles)}), and ${focus} ${focus === 1 ? 'minute' : 'minutes'} of study or focus.`,
    fingerprint: `${watched}:${Math.floor(focus / 15)}`,
  };
};

/** One show binged hard. */
const bingeOne: Rule = (d) => {
  const top = episodesWatched(d.life.filter((i): i is SeriesItem => i.type === 'series'), d.today, 7)[0];
  if (!top || top.count < 8) return null;
  return {
    key: `binge:${top.title}`,
    rule: 'binge',
    kind: 'nudge',
    priority: 60 + Math.min(top.count, 20),
    icon: '📺',
    message: pick(
      [
        `"${top.title}" has really pulled you in! Enjoy it — and maybe set an episode limit for tonight, then do something with your hands.`,
        `You're flying through "${top.title}". Try pausing after the next episode and stepping outside for a few minutes.`,
      ],
      d.today,
      'binge',
    ),
    because: `${plural(top.count, 'episode')} of "${top.title}" in the last 7 days.`,
    fingerprint: `${Math.floor(top.count / 4)}`,
  };
};

/** Frequent "I'm scrolling" taps → suggest uninstalling / moving the app. */
const scrolling: Rule = (d) => {
  const taps = d.toolEvents.filter((e) => e.tool === 'scrolling' && within(keyOf(e.at), d.today, 7));
  if (taps.length < 3) return null;
  const evenings = taps.filter((e) => new Date(e.at).getHours() >= 21).length;
  return {
    key: 'scrolling',
    rule: 'scrolling',
    kind: 'nudge',
    priority: 75 + taps.length,
    icon: '📱',
    message:
      taps.length >= 6
        ? pick(
            [
              `Scrolling keeps finding you. Maybe it's time to uninstall the app that pulls you in most — or at least move it off your home screen.`,
              `That's a lot of scrolling moments. Try deleting the app for a week; you can always bring it back if you truly miss it.`,
            ],
            d.today,
            'scroll-hi',
          )
        : pick(
            [
              `You've caught yourself scrolling a few times. Try putting your phone in another room for one hour today.`,
              `A few scrolling moments this week. What if the first 30 minutes after waking were phone-free tomorrow?`,
            ],
            d.today,
            'scroll',
          ),
    because: `You tapped "I'm scrolling" ${plural(taps.length, 'time')} this week${evenings >= 2 ? `, ${evenings} of them late at night` : ''}.`,
    fingerprint: `${Math.floor(taps.length / 3)}`,
  };
};

/** Frequent boredom → suggest something from Someday, Maybe, or an experience. */
const boredom: Rule = (d) => {
  const taps = d.toolEvents.filter((e) => e.tool === 'bored' && within(keyOf(e.at), d.today, 7));
  if (taps.length < 3) return null;
  const someday = d.life.filter((i): i is WishItem => i.type === 'wish' && (i.listType ?? 'somedayMaybe') === 'somedayMaybe' && !i.done);
  const idea = someday.length ? pick(someday, d.today, 'bored-idea').title : null;
  return {
    key: 'boredom',
    rule: 'boredom',
    kind: 'nudge',
    priority: 65 + taps.length,
    icon: '🎈',
    message: idea
      ? `Boredom keeps visiting. It might be your cue — how about trying "${idea}" from your Someday, Maybe list?`
      : `Boredom keeps visiting. It might be your cue to try something new — a new café, a walk somewhere different, a class.`,
    because: `You tapped "I'm bored" ${plural(taps.length, 'time')} this week.`,
    fingerprint: `${Math.floor(taps.length / 3)}:${idea ?? ''}`,
  };
};

/** A while since an experience. */
const experienceGap: Rule = (d) => {
  const experiences = d.life.filter((i): i is ExperienceItem => i.type === 'experience');
  const last = lastDate(experiences.map((e) => e.date ?? keyOf(e.createdAt)));
  const gap = last ? daysBetween(last, d.today) : null;
  if (gap !== null && gap < 21) return null;
  if (gap === null && d.life.length < 3) return null; // too early to say
  const someday = d.life.filter((i): i is WishItem => i.type === 'wish' && !i.done);
  const idea = someday.length ? pick(someday, d.today, 'exp-idea').title : null;
  const lastTitle = last ? experiences.find((e) => (e.date ?? keyOf(e.createdAt)) === last)?.title : undefined;
  return {
    key: 'experience-gap',
    rule: 'experience-gap',
    kind: 'nudge',
    priority: 55 + Math.min(gap ?? 30, 40) / 2,
    icon: '🌿',
    message: idea
      ? `Why not have a little experience this week? "${idea}" is waiting on your list.`
      : pick(
          [
            `Why don't you have an experience today? Somewhere new, even a short walk to a place you've never been.`,
            `Time for a small adventure — a new place, a new food, something you'll want to remember.`,
          ],
          d.today,
          'exp',
        ),
    because: gap === null ? `No experiences logged yet.` : `Your last experience${lastTitle ? `, "${lastTitle}",` : ''} was ${plural(gap, 'day')} ago.`,
    fingerprint: `${Math.floor((gap ?? 99) / 14)}`,
  };
};

/** A while since making art (only if art is something you do). */
const artworkGap: Rule = (d) => {
  const art = d.life.filter((i): i is ArtworkItem => i.type === 'artwork');
  if (art.length === 0) return null;
  const last = lastDate(art.map((a) => a.dateCreated ?? keyOf(a.createdAt)))!;
  const gap = daysBetween(last, d.today);
  if (gap < 21) return null;
  return {
    key: 'artwork-gap',
    rule: 'artwork-gap',
    kind: 'nudge',
    priority: 50 + Math.min(gap, 40) / 2,
    icon: '🎨',
    message: pick(
      [`Why don't you make some art today? Even a ten-minute doodle counts.`, `Your hands might enjoy creating again — a quick sketch, some colour, anything.`],
      d.today,
      'art',
    ),
    because: `Your last artwork was ${plural(gap, 'day')} ago (${art.length} in total).`,
    fingerprint: `${Math.floor(gap / 14)}`,
  };
};

/** Someone you care about you haven't connected with in a while. */
const peopleGap: Rule = (d) => {
  const candidates = d.people
    .filter((p) => !p.deletedAt)
    .map((p) => {
      const since = p.lastContactedAt ? daysBetween(p.lastContactedAt, d.today) : daysBetween(keyOf(p.createdAt)!, d.today) + 1000;
      return { person: p, since };
    })
    .filter((x) => (x.person.lastContactedAt ? x.since >= 14 : daysBetween(keyOf(x.person.createdAt)!, d.today) >= 3))
    .sort((a, b) => b.since - a.since);
  if (candidates.length === 0) return null;
  const { person, since } = candidates[0];
  const never = !person.lastContactedAt;
  return {
    key: `people-gap:${person.id}`,
    rule: 'people-gap',
    kind: 'nudge',
    priority: 68 + Math.min(never ? 20 : since / 2, 25),
    icon: '💛',
    message: pick(
      [
        `Why don't you reach out to ${person.name} today? A short "thinking of you" is plenty.`,
        `${person.name} might love to hear from you. Send a message, a photo, or a voice note.`,
        `How about calling ${person.name} this week?`,
      ],
      d.today,
      `people:${person.id}`,
    ),
    because: never ? `No connection with ${person.name} logged yet.` : `You last connected with ${person.name} ${plural(since, 'day')} ago.`,
    fingerprint: `${person.lastContactedAt ?? 'never'}`,
  };
};

/** Reading going well — kudos with real titles. */
const readingKudos: Rule = (d) => {
  const days = careDays(d.care, 'reading', d.today, 0, 7);
  const finished = d.life.filter((i): i is BookItem => i.type === 'book' && i.status === 'finished' && within(i.dateFinished, d.today, 14));
  if (days < 4 && finished.length === 0) return null;
  const minutes = careMinutes(d.care, 'reading', d.today, 7);
  return {
    key: 'reading-kudos',
    rule: 'reading-kudos',
    kind: 'kudos',
    priority: 45 + days * 2 + finished.length * 5,
    icon: '📖',
    message: finished.length
      ? pick(
          [`Kudos on finishing ${quoteList(finished.map((b) => b.title))}! What did it leave you with? A line in your journal would be lovely.`, `You finished ${quoteList(finished.map((b) => b.title))} — that's worth celebrating.`],
          d.today,
          'read-fin',
        )
      : pick([`Kudos — reading is clearly becoming part of your days.`, `Your reading habit is glowing this week. Keep that gentle rhythm.`], d.today, 'read'),
    because: [days ? `Read on ${plural(days, 'day')} this week${minutes ? ` (${minutes} min)` : ''}` : '', finished.length ? `finished ${plural(finished.length, 'book')} recently` : ''].filter(Boolean).join('; ') + '.',
    fingerprint: `${days}:${finished.map((b) => b.id).join(',')}`,
  };
};

/** Reading dropped off after being a habit. */
const readingDip: Rule = (d) => {
  const now = careDays(d.care, 'reading', d.today, 0, 7);
  const before = careDays(d.care, 'reading', d.today, 7, 35);
  if (now > 0 || before < 6) return null;
  const current = d.life.find((i): i is BookItem => i.type === 'book' && i.status === 'inProgress');
  return {
    key: 'reading-dip',
    rule: 'reading-dip',
    kind: 'nudge',
    priority: 52,
    icon: '📖',
    message: current
      ? `You haven't opened "${current.title}" this week. Ten pages tonight could be a nice way back in.`
      : `Reading has gone quiet this week. A few pages before bed could be a nice way back in.`,
    because: `Read on ${plural(before, 'day')} in the four weeks before, none this week.`,
    fingerprint: `${before}`,
  };
};

/** Focused work going well. */
const focusKudos: Rule = (d) => {
  const minutes = careMinutes(d.care, 'focus', d.today, 7);
  if (minutes < 120) return null;
  return {
    key: 'focus-kudos',
    rule: 'focus-kudos',
    kind: 'kudos',
    priority: 48 + Math.min(minutes / 30, 20),
    icon: '🎯',
    message: pick([`Kudos on your focus this week — that steady effort adds up.`, `You've put real, focused time in this week. Be proud of that, and rest well too.`], d.today, 'focus'),
    because: `${minutes} focus minutes in the last 7 days.`,
    fingerprint: `${Math.floor(minutes / 60)}`,
  };
};

/** Daily basics slipping compared to last week. */
const basicsDip: Rule = (d) => {
  const items: CareEntry['itemKey'][] = ['bathed', 'ateFruit', 'movement'];
  const names: Record<string, string> = { bathed: 'bath/shower', ateFruit: 'fresh fruit', movement: 'movement' };
  const drops = items
    .map((item) => ({ item, now: careDays(d.care, item, d.today, 0, 7), before: careDays(d.care, item, d.today, 7, 14) }))
    .filter((x) => x.before >= 4 && x.now <= x.before - 3);
  if (drops.length === 0) return null;
  const skipTired = d.care.filter((c) => c.status === 'skipped' && within(c.date, d.today, 7) && /tired|exhaust|energy|sleep/i.test(c.skipReason ?? '')).length;
  const worst = drops[0];
  return {
    key: `basics-dip:${worst.item}`,
    rule: 'basics-dip',
    kind: 'care',
    priority: 62,
    icon: '🌱',
    message: skipTired >= 2
      ? `You've been running low on energy. Be extra gentle with yourself — an early night might help more than anything else.`
      : `Your daily basics have slipped a little this week. No guilt — just pick the easiest one for today, like ${names[worst.item]}.`,
    because: `${names[worst.item]} on ${plural(worst.now, 'day')} this week, down from ${worst.before} last week${skipTired >= 2 ? `; "tired" came up ${skipTired} times when skipping` : ''}.`,
    fingerprint: drops.map((x) => `${x.item}${x.now}`).join(','),
  };
};

/** Movement doing well. */
const movementKudos: Rule = (d) => {
  const days = careDays(d.care, 'movement', d.today, 0, 7);
  if (days < 4) return null;
  return {
    key: 'movement-kudos',
    rule: 'movement-kudos',
    kind: 'kudos',
    priority: 40 + days,
    icon: '🧘',
    message: pick([`Kudos on moving your body so often this week. It shows you care for yourself.`, `Your body thanks you for all that movement this week.`], d.today, 'move'),
    because: `Gentle movement on ${plural(days, 'day')} this week.`,
    fingerprint: `${days}`,
  };
};

/** What the journal and reflections have been saying (read on-device). */
const journalThemes: Rule = (d) => {
  const texts = [
    ...d.journal.filter((j) => !j.deletedAt && within(j.date, d.today, 14)).map((j) => `${j.title ?? ''} ${j.body} ${j.mood ?? ''}`),
    ...d.reflections
      .filter((r) => within(r.date, d.today, 14))
      .map((r) => [r.gratitude, r.smallWin, r.eveningGoodThing, r.eveningLeaveForTomorrow, r.eveningMood].filter(Boolean).join(' ')),
  ].filter((t) => t.trim());
  if (texts.length === 0) return null;
  const t = countThemes(texts);
  // With on-device AI on, the model's reading of each entry's emotion
  // replaces the word list for everyday feelings (it understands phrasing,
  // not just words). Very heavy writing is always screened by the word list.
  const fromModel = !!d.aiThemeCounts;
  if (d.aiThemeCounts) {
    for (const theme of ['tired', 'stressed', 'low', 'lonely', 'happy', 'grateful'] as const) t[theme] = d.aiThemeCounts[theme] ?? 0;
  }
  const how = fromModel ? ' (understood on this device)' : '';

  if (t.heavy > 0) {
    return {
      key: 'journal-heavy',
      rule: 'journal-heavy',
      kind: 'care',
      priority: 100,
      icon: '🤍',
      message: `It sounds like you've been carrying something heavy. You don't have to hold it alone — please reach out to someone you trust today, or a counsellor or helpline near you.`,
      because: `Some of what you've written recently sounded really hard.`,
      fingerprint: `${t.heavy}`,
    };
  }
  const options: [keyof typeof t, Omit<Insight, 'key' | 'rule' | 'fingerprint' | 'because'> & { word: string }][] = [
    ['tired', { kind: 'care', priority: 66, icon: '😴', word: 'feeling tired', message: `Your body may be asking for rest. Tonight, try putting the phone away early and sleeping a little sooner.` }],
    ['stressed', { kind: 'care', priority: 66, icon: '🌊', word: 'stress or worry', message: `There's been some stress lately. When it builds up, the Overthinking tool can help untangle facts from fears.` }],
    ['low', { kind: 'care', priority: 64, icon: '🫂', word: 'feeling low', message: `Some days have felt heavy. Be soft with yourself — and maybe share how you feel with someone you love.` }],
    ['lonely', { kind: 'care', priority: 64, icon: '💛', word: 'feeling alone', message: `You've felt a bit alone lately. Reaching out to one person from My People today could help.` }],
  ];
  for (const [theme, o] of options) {
    if (t[theme] >= 2) {
      return {
        key: `journal-${theme}`,
        rule: `journal-${theme}`,
        kind: o.kind,
        priority: o.priority + t[theme],
        icon: o.icon,
        message: o.message,
        because: `You've written about ${o.word} in ${plural(t[theme], 'entry', 'entries')} over the last two weeks${how}.`,
        fingerprint: `${t[theme]}`,
      };
    }
  }
  if (t.happy + t.grateful >= 2) {
    return {
      key: 'journal-happy',
      rule: 'journal-happy',
      kind: 'kudos',
      priority: 44 + t.happy + t.grateful,
      icon: '☀️',
      message: pick([`There's been real joy in your writing lately. Notice what's bringing it — and do more of that.`, `Your words have been bright recently. Hold on to whatever is making you happy.`], d.today, 'happy'),
      because: `Happy or grateful moments in ${plural(t.happy + t.grateful, 'entry', 'entries')} over the last two weeks${how}.`,
      fingerprint: `${t.happy + t.grateful}`,
    };
  }
  return null;
};

/** Journaling rhythm. */
const journalRhythm: Rule = (d) => {
  const entries = d.journal.filter((j) => !j.deletedAt);
  const week = entries.filter((j) => within(j.date, d.today, 7)).length;
  if (week >= 3) {
    return {
      key: 'journal-kudos',
      rule: 'journal-kudos',
      kind: 'kudos',
      priority: 42 + week,
      icon: '📝',
      message: `Kudos for writing so often this week — you're really listening to yourself.`,
      because: `${plural(week, 'journal entry', 'journal entries')} in the last 7 days.`,
      fingerprint: `${week}`,
    };
  }
  const last = lastDate(entries.map((j) => j.date));
  if (last && entries.length >= 3 && daysBetween(last, d.today) >= 21) {
    const gap = daysBetween(last, d.today);
    return {
      key: 'journal-gap',
      rule: 'journal-gap',
      kind: 'nudge',
      priority: 46,
      icon: '📝',
      message: `It's been a while since you wrote. Even two lines about today could feel good.`,
      because: `Your last journal entry was ${plural(gap, 'day')} ago.`,
      fingerprint: `${Math.floor(gap / 14)}`,
    };
  }
  return null;
};

/** This year's vision — progress and gentle reminders. */
const annualVision: Rule = (d) => {
  const year = Number(d.today.slice(0, 4));
  const vision = d.life.filter((i): i is WishItem => i.type === 'wish' && i.listType === 'annualVision' && (i.year ?? year) === year && !i.missed);
  if (vision.length === 0) return null;
  const done = vision.filter((v) => v.done);
  const open = vision.filter((v) => !v.done);
  const recent = done.filter((v) => within(v.dateCompleted, d.today, 14));
  if (recent.length > 0) {
    return {
      key: `vision-kudos:${recent[0].id}`,
      rule: 'vision-kudos',
      kind: 'kudos',
      priority: 80,
      icon: '🎯',
      message: `Kudos — you made "${recent[0].title}" happen! That was on your vision for this year.`,
      because: `${done.length} of ${vision.length} vision items done for ${year}.`,
      fingerprint: recent.map((v) => v.id).join(','),
    };
  }
  if (open.length === 0) return null;
  const month = Number(d.today.slice(5, 7));
  const monthsLeft = 12 - month;
  const next = pick(open, d.today, 'vision');
  return {
    key: `vision-open:${next.id}`,
    rule: 'vision-open',
    kind: 'nudge',
    priority: 50 + (12 - monthsLeft) * 2,
    icon: '🎯',
    message:
      monthsLeft <= 2
        ? `The year is almost over. Is there one small step you could take toward "${next.title}" this week?`
        : `One small step toward "${next.title}" this week would bring your vision a little closer.`,
    because: `${done.length} of ${vision.length} vision items done for ${year}${monthsLeft <= 2 ? `, ${plural(monthsLeft + 1, 'month')} left` : ''}.`,
    fingerprint: `${done.length}:${next.id}`,
  };
};

/** A balanced, full week — celebrate it. */
const balancedWeek: Rule = (d) => {
  const kinds = new Set<string>();
  for (const i of d.life) {
    if (i.type !== 'wish' && lifeItemActivityDates(i).some((date) => within(date, d.today, 7))) kinds.add(i.type);
  }
  if (careMinutes(d.care, 'focus', d.today, 7) >= 60) kinds.add('focus');
  if (d.journal.some((j) => within(j.date, d.today, 7))) kinds.add('journal');
  if (d.people.some((p) => within(p.lastContactedAt, d.today, 7))) kinds.add('people');
  if (kinds.size < 4) return null;
  return {
    key: 'balanced-week',
    rule: 'balanced-week',
    kind: 'kudos',
    priority: 58,
    icon: '🌈',
    message: `What a full, balanced week — a bit of everything that matters to you. Keep this rhythm.`,
    because: `This week you had: ${[...kinds].join(', ')}.`,
    fingerprint: [...kinds].sort().join(','),
  };
};

// ── weekly study goals ──

/**
 * Words that tie a subject to dreams on the Life lists (Someday, Maybe /
 * Annual Vision) — so advice can say "you wanted to visit Japan…".
 * Matched as whole words in the wish's title or category.
 */
const RELATED_WORDS: Record<string, string[]> = {
  japanese: ['japan', 'japanese', 'tokyo', 'kyoto', 'osaka', 'jlpt', 'anime', 'manga'],
  aptitude: ['placement', 'placements', 'job', 'interview', 'interviews', 'gate', 'cat', 'gre', 'gmat', 'exam', 'exams', 'campus'],
  python: ['python', 'developer', 'programmer', 'coding', 'software', 'job', 'internship', 'project', 'app'],
  'machine learning': ['ml', 'ai', 'machine learning', 'data scientist', 'data science', 'research', 'internship', 'kaggle', 'phd'],
};

const words = (text: string) => ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `;

/** A wish (not yet done) that this subject would help with, if any. */
function relatedDream(subject: SubjectItem, life: LifeItem[]): WishItem | undefined {
  const key = subject.title.toLowerCase();
  const vocab = new Set([key, ...(RELATED_WORDS[key] ?? []), ...(subject.goal ? subject.goal.toLowerCase().split(/\s+/).filter((w) => w.length > 3) : [])]);
  const wishes = life.filter((i): i is WishItem => i.type === 'wish' && !i.done && !i.missed);
  // Annual Vision first — it's this year's intention.
  wishes.sort((a, b) => (a.listType === 'annualVision' ? -1 : 0) - (b.listType === 'annualVision' ? -1 : 0));
  return wishes.find((w) => {
    const hay = words(`${w.title} ${w.category ?? ''}`);
    return [...vocab].some((v) => hay.includes(` ${v} `));
  });
}

function dreamLine(subject: SubjectItem, life: LifeItem[]): string {
  const dream = relatedDream(subject, life);
  if (!dream) return '';
  const where = dream.listType === 'annualVision' ? 'your vision for this year' : 'your Someday, Maybe list';
  return ` You wanted to "${dream.title}" (it's on ${where}) — a little ${subject.title} brings that closer.`;
}

/** Subjects that had a goal during a given week (added before that week ended). */
const goalSubjects = (d: AdvisorData, weekEnd: string) => d.subjects.filter((s) => (s.weeklyGoal?.minutes || s.weeklyGoal?.days) && keyOf(s.createdAt)! <= weekEnd);

/** Early in the week: how last week's goals went. Gentle when missed, celebratory when met. */
const lastWeekGoals: Rule = (d) => {
  const left = daysLeftInWeek(d.today); // 6 = Monday … 0 = Sunday
  if (left < 4) return null; // only Monday–Wednesday
  const lastStart = addDays(weekBounds(d.today).start, -7);
  const subjects = goalSubjects(d, addDays(lastStart, 6));
  if (subjects.length === 0) return null;
  const results = subjects.map((s) => ({ s, p: goalProgress(s, d.studySessions, lastStart) }));
  const missed = results.filter((r) => !r.p.met);
  if (missed.length === 0) {
    return {
      key: `goals-met:${lastStart}`,
      rule: 'goals-met',
      kind: 'kudos',
      priority: 82,
      icon: '🎯',
      message: `Kudos — you met every weekly study goal last week${subjects.length > 1 ? ` (${subjects.map((s) => s.title).join(', ')})` : ` for ${subjects[0].title}`}. That's real commitment.`,
      because: results.map((r) => `${r.s.title}: ${describeProgress(r.p)}`).join('; ') + '.',
      fingerprint: lastStart,
    };
  }
  const names = missed.map((r) => r.s.title);
  const listed = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return {
    key: `goals-missed:${lastStart}`,
    rule: 'goals-missed',
    kind: 'nudge',
    priority: 84,
    icon: '🌱',
    message:
      pick(
        [
          `I noticed last week's goal${names.length > 1 ? 's' : ''} for ${listed} didn't quite happen. That's okay — this is a new week. Maybe aim for a little more this time.`,
          `${listed} fell a bit short of last week's goal. No pressure — just try to give ${names.length > 1 ? 'them' : 'it'} a little more time this week.`,
        ],
        d.today,
        'goals-missed',
      ) + dreamLine(missed[0].s, d.life),
    because: missed.map((r) => `${r.s.title}: ${describeProgress(r.p)}`).join('; ') + ' last week.',
    fingerprint: lastStart,
  };
};

/** Later in the week: what's left to reach this week's goals. */
const thisWeekGoal: Rule = (d) => {
  const left = daysLeftInWeek(d.today);
  if (left > 3) return null; // only Thursday–Sunday
  const { start, end } = weekBounds(d.today);
  const behind = goalSubjects(d, end)
    .map((s) => ({ s, p: goalProgress(s, d.studySessions, start) }))
    .filter((r) => !r.p.met)
    // furthest behind first
    .sort((a, b) => ratio(a.p) - ratio(b.p))[0];
  if (!behind) return null;
  const { s, p } = behind;
  const needMinutes = p.minutesGoal ? Math.max(0, p.minutesGoal - p.minutes) : 0;
  const needDays = p.daysGoal ? Math.max(0, p.daysGoal - p.days) : 0;
  const need = [needMinutes ? fmt(needMinutes) : '', needDays ? plural(needDays, 'more day') : ''].filter(Boolean).join(' and ');
  const daysText = left === 0 ? 'today is the last day of the week' : `${plural(left + 1, 'day')} left including today`;
  return {
    key: `goal-behind:${s.id}:${start}`,
    rule: 'goal-behind',
    kind: 'nudge',
    priority: 76 + (3 - left) * 2,
    icon: s.icon || '📚',
    message: `You're ${need} away from your ${s.title} goal this week — ${daysText}. You've got this.` + dreamLine(s, d.life),
    because: `${s.title} this week: ${describeProgress(p)}.`,
    fingerprint: `${p.minutes}:${p.days}`,
  };
};

function ratio(p: ReturnType<typeof goalProgress>): number {
  const parts = [p.minutesGoal ? p.minutes / p.minutesGoal : 1, p.daysGoal ? p.days / p.daysGoal : 1];
  return Math.min(...parts);
}

/** Reached a goal this week — celebrate it straight away. */
const goalReached: Rule = (d) => {
  const { start, end } = weekBounds(d.today);
  const reached = goalSubjects(d, end).find((s) => goalProgress(s, d.studySessions, start).met);
  if (!reached) return null;
  const p = goalProgress(reached, d.studySessions, start);
  return {
    key: `goal-reached:${reached.id}:${start}`,
    rule: 'goal-reached',
    kind: 'kudos',
    priority: 70,
    icon: '🎯',
    message: `You reached your ${reached.title} goal for this week! Anything more is a bonus — or a well-earned rest.`,
    because: `${reached.title} this week: ${describeProgress(p)}.`,
    fingerprint: start,
  };
};

/** Good study week — kudos naming the subject and the time. */
const studyKudos: Rule = (d) => {
  const total = studyMinutes(d.studySessions, d.today, 7);
  if (total < 180) return null;
  const top = d.subjects
    .map((s) => ({ s, m: studyMinutes(d.studySessions, d.today, 7, s.id) }))
    .sort((a, b) => b.m - a.m)[0];
  return {
    key: 'study-kudos',
    rule: 'study-kudos',
    kind: 'kudos',
    priority: 60 + Math.min(total / 60, 20),
    icon: '🎓',
    message: pick(
      [
        `Kudos — you gave ${fmt(total)} to your studies this week${top?.m ? `, most of it to ${top.s.title}` : ''}. That's real dedication.`,
        `${fmt(total)} of study this week! ${top?.m ? `${top.s.title} is clearly getting your heart.` : ''} Rest well too.`,
      ],
      d.today,
      'study-kudos',
    ),
    because: `${fmt(total)} studied in the last 7 days${top?.m ? ` (${top.s.title}: ${fmt(top.m)})` : ''}.`,
    fingerprint: `${Math.floor(total / 60)}`,
  };
};

/** A subject that's gone quiet — suggest the topic to pick back up. */
const subjectGap: Rule = (d) => {
  const quiet = d.subjects
    .map((s) => {
      const last = lastDate(d.studySessions.filter((x) => x.subjectId === s.id).map((x) => x.date));
      return { s, last, gap: last ? daysBetween(last, d.today) : null };
    })
    .filter((x) => x.gap !== null && x.gap >= 7)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];
  if (!quiet) return null;
  const topic = quiet.s.topics.find((t) => t.status === 'learning') ?? quiet.s.topics.find((t) => t.status === 'notStarted');
  return {
    key: `subject-gap:${quiet.s.id}`,
    rule: 'subject-gap',
    kind: 'nudge',
    priority: 72 + Math.min(quiet.gap ?? 0, 20) / 2,
    icon: quiet.s.icon || '📚',
    message: topic
      ? `${quiet.s.title} hasn't had your time in a while. Even 15 minutes of ${topic.name} today keeps it alive.`
      : `${quiet.s.title} hasn't had your time in a while. A short session today would keep it warm.`,
    because: `Last ${quiet.s.title} session was ${plural(quiet.gap ?? 0, 'day')} ago.`,
    fingerprint: `${quiet.last}`,
  };
};

/** A subject added but never started. */
const subjectNotStarted: Rule = (d) => {
  const waiting = d.subjects.find(
    (s) => !d.studySessions.some((x) => x.subjectId === s.id) && daysBetween(keyOf(s.createdAt)!, d.today) >= 3,
  );
  if (!waiting) return null;
  const first = waiting.topics[0];
  return {
    key: `subject-start:${waiting.id}`,
    rule: 'subject-start',
    kind: 'nudge',
    priority: 57,
    icon: waiting.icon || '📚',
    message: first
      ? `Ready to begin ${waiting.title}? "${first.name}" could be a gentle first step — start the study timer for just 15 minutes.`
      : `Ready to begin ${waiting.title}? Start the study timer for just 15 minutes and see how it feels.`,
    because: `${waiting.title} was added ${plural(daysBetween(keyOf(waiting.createdAt)!, d.today), 'day')} ago and hasn't had a session yet.`,
    fingerprint: waiting.id,
  };
};

/** A goal date coming up. */
const studyGoalSoon: Rule = (d) => {
  const soon = d.subjects
    .filter((s) => s.goalDate && daysBetween(d.today, s.goalDate) >= 0 && daysBetween(d.today, s.goalDate) <= 45)
    .sort((a, b) => a.goalDate!.localeCompare(b.goalDate!))[0];
  if (!soon) return null;
  const left = daysBetween(d.today, soon.goalDate!);
  const notConfident = soon.topics.filter((t) => t.status !== 'confident');
  return {
    key: `study-goal:${soon.id}`,
    rule: 'study-goal',
    kind: 'nudge',
    priority: 74 + (45 - left) / 3,
    icon: '🗓️',
    message: notConfident.length
      ? `${plural(left, 'day')} until your ${soon.goal ?? soon.title} goal. Focus on ${quoteList(notConfident.map((t) => t.name))} next.`
      : `${plural(left, 'day')} until your ${soon.goal ?? soon.title} goal, and every topic is marked confident. Keep it fresh with a review.`,
    because: `${soon.title}: ${soon.topics.length - notConfident.length} of ${soon.topics.length} topics confident.`,
    fingerprint: `${Math.floor(left / 7)}:${notConfident.length}`,
  };
};

export const RULES: Rule[] = [
  lastWeekGoals,
  thisWeekGoal,
  goalReached,
  studyGoalSoon,
  subjectGap,
  subjectNotStarted,
  studyKudos,
  journalThemes,
  scrolling,
  screenBalance,
  bingeOne,
  boredom,
  peopleGap,
  experienceGap,
  artworkGap,
  readingKudos,
  readingDip,
  focusKudos,
  basicsDip,
  movementKudos,
  journalRhythm,
  annualVision,
  balancedWeek,
];

/** Every piece of advice that currently applies, best first. */
export function allInsights(data: AdvisorData): Insight[] {
  return RULES.map((rule) => rule(data))
    .filter((x): x is Insight => x !== null)
    .sort((a, b) => b.priority - a.priority);
}
