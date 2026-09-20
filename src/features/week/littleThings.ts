import type { WeekData } from './useWeekData';

export interface LittleThing {
  icon: string;
  text: string;
}

const QUIET_WEEK_FALLBACK: LittleThing = {
  icon: '🍃',
  text: "A quiet week — sometimes that's exactly what's needed.",
};

/**
 * Small, playful observations built from what was actually logged
 * this week — never a summary of what wasn't done, never a count
 * framed as a target missed.
 */
export function deriveLittleThings(week: WeekData): LittleThing[] {
  const things: LittleThing[] = [];

  if (week.daysShowedUp > 0) {
    things.push({
      icon: '🌱',
      text: `You showed up ${week.daysShowedUp} time${week.daysShowedUp === 1 ? '' : 's'} this week.`,
    });
  }
  if (week.journalEntriesThisWeek.length > 0) {
    things.push({ icon: '📝', text: 'You wrote yourself a note or two.' });
  }
  if (week.booksThisWeek.length > 0) {
    things.push({ icon: '📖', text: `You spent some time with "${week.booksThisWeek[0].title}".` });
  }
  if (week.moviesAndSeriesThisWeek.length > 0) {
    things.push({ icon: '🎬', text: `You watched ${week.moviesAndSeriesThisWeek[0].title}.` });
  }
  if (week.artworkThisWeek.length > 0) {
    things.push({ icon: '🎨', text: 'You made something with your hands.' });
  }
  if (week.experiencesThisWeek.length > 0) {
    things.push({ icon: '🌿', text: `You lived a little: ${week.experiencesThisWeek[0].title}.` });
  }

  return things.length > 0 ? things.slice(0, 5) : [QUIET_WEEK_FALLBACK];
}
