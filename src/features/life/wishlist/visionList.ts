import type { BookItem, WishItem } from '@/db/schema';

/**
 * Turns a pasted list into vision-board goals. Pure, so it's tested.
 *
 *   Learning:              ← a line ending in ":" is a category for the lines below it
 *   - Learn to bake bread  ← bullets / numbers are stripped
 *   ✓ Plant a herb garden  ← "✓", "✔", "[x]" or "x " marks it as already achieved
 */
export interface VisionLine {
  title: string;
  category?: string;
  done: boolean;
}

export function parseVisionList(text: string): VisionLine[] {
  const out: VisionLine[] = [];
  let category: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    if (/^#+\s*/.test(line) || (line.endsWith(':') && line.length <= 40)) {
      category = line.replace(/^#+\s*/, '').replace(/:$/, '').trim() || undefined;
      continue;
    }
    line = line.replace(/^([-*•·]|\d+[.)])\s+/, '');
    let done = false;
    const mark = line.match(/^(\[[xX✓]\]|[✓✔✅]|[xX]\s)\s*/);
    if (mark) {
      done = true;
      line = line.slice(mark[0].length);
    }
    line = line.replace(/^\[\s?\]\s*/, '').trim();
    if (line) out.push({ title: line, category, done });
  }
  return out;
}

/** Goals not already on that year's board (same title, ignoring case and spaces), without repeats. */
export function newVisionLines(lines: VisionLine[], existing: WishItem[], year: number): VisionLine[] {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const have = new Set(existing.filter((w) => w.listType === 'annualVision' && (w.year ?? year) === year).map((w) => norm(w.title)));
  const seen = new Set<string>();
  return lines.filter((l) => {
    const k = norm(l.title);
    if (have.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** "Read 12 books" → 12 — a reading goal the app can track from Books. */
export function readingGoalTarget(title: string): number | null {
  const m = title.match(/\bread\b[^\d]{0,20}(\d{1,4})\s+books?\b/i) ?? title.match(/^(\d{1,4})\s+books?\b/i);
  return m ? Number(m[1]) : null;
}

/** Books finished in a given year. */
export function booksFinishedIn(books: BookItem[], year: number): number {
  return books.filter((b) => !b.deletedAt && b.status === 'finished' && b.dateFinished?.startsWith(String(year))).length;
}
