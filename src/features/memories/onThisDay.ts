import type { BookItem, DailyReflection, ExperienceItem, JournalEntry, MovieItem } from '@/db/schema';
import type { SavedLine } from '@/features/ai/savedLines';

export interface MemoryInput {
  journal: readonly JournalEntry[];
  reflections: readonly DailyReflection[];
  life: readonly { type: string; deletedAt?: string | null }[];
  savedLines: readonly SavedLine[];
}

export interface Memory {
  key: string;
  icon: string;
  text: string;
}

export interface MemoryYear {
  year: number;
  /** How many years ago, from today. */
  ago: number;
  items: Memory[];
}

const snippet = (s: string, max = 140) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
};

/**
 * "On this day": what you did on today's date in earlier years — films
 * watched, books finished or started, experiences, what you wrote, small
 * wins, and lines you ♥'d. Newest year first.
 */
export function onThisDay(input: MemoryInput, today: string): MemoryYear[] {
  const md = today.slice(5);
  const thisYear = Number(today.slice(0, 4));
  const byYear = new Map<number, Memory[]>();
  const add = (date: string | undefined | null, m: Memory) => {
    if (!date || date.slice(5, 10) !== md) return;
    const y = Number(date.slice(0, 4));
    if (!(y < thisYear)) return;
    if (!byYear.has(y)) byYear.set(y, []);
    const list = byYear.get(y)!;
    if (!list.some((x) => x.key === m.key)) list.push(m);
  };

  for (const r of input.life) {
    if (r.deletedAt) continue;
    if (r.type === 'movie') {
      const m = r as MovieItem;
      if (m.status === 'watchlist') continue;
      for (const d of [m.dateWatched, ...(m.previousWatches ?? []).map((w) => w.dateWatched)]) {
        add(d, {
          key: `movie:${m.id}:${d}`,
          icon: '🎬',
          text: `Watched ${m.title}${m.year ? ` (${m.year})` : ''}`,
        });
      }
    } else if (r.type === 'book') {
      const b = r as BookItem;
      add(b.dateFinished, {
        key: `book-f:${b.id}`,
        icon: '📚',
        text: `Finished ${b.title}${b.author ? ` by ${b.author}` : ''}`,
      });
      add(b.dateStarted, {
        key: `book-s:${b.id}`,
        icon: '📖',
        text: `Started ${b.title}`,
      });
    } else if (r.type === 'experience') {
      const e = r as ExperienceItem;
      add(e.date, {
        key: `exp:${e.id}`,
        icon: '✨',
        text: e.location ? `${e.title} · ${e.location}` : e.title,
      });
    }
  }
  for (const j of input.journal) {
    if (j.deletedAt) continue;
    add(j.date, {
      key: `journal:${j.id}`,
      icon: '📝',
      text: `You wrote: “${snippet(j.title ? `${j.title} — ${j.body}` : j.body)}”`,
    });
  }
  for (const r of input.reflections) {
    if (r.smallWin?.trim())
      add(r.date, {
        key: `win:${r.id}`,
        icon: '🌱',
        text: `Small win: ${snippet(r.smallWin)}`,
      });
    if (r.gratitude?.trim())
      add(r.date, {
        key: `grat:${r.id}`,
        icon: '💛',
        text: `Grateful for: ${snippet(r.gratitude)}`,
      });
  }
  for (const l of input.savedLines)
    add(l.date, {
      key: `line:${l.text}`,
      icon: '♥',
      text: `“${snippet(l.text, 200)}”`,
    });

  return [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, items]) => ({ year, ago: thisYear - year, items }));
}
