import { localDateKeyOf } from '@/db/dateUtils';
import type { DailyReflection, JournalEntry, LifeItem, StudySessionItem } from '@/db/schema';

/**
 * Turns what's been written in the app into "documents" the on-device
 * model can understand: journal entries, daily reflections, notes on
 * Life items, and study-session notes. Pure functions.
 */

export type DocSource = 'journal' | 'reflection' | 'life' | 'study';

export interface AiDocument {
  /** `${source}:${sourceId}` — also the embedding's id. */
  key: string;
  source: DocSource;
  sourceId: string;
  /** Local date key the writing belongs to. */
  date: string;
  /** Short heading for search results. */
  title: string;
  text: string;
}

const MIN_CHARS = 12;
const join = (...parts: (string | undefined | null)[]) => parts.filter((p) => p && p.trim()).join('. ').trim();
const keyOf = (iso: string) => localDateKeyOf(iso) ?? iso.slice(0, 10);

export function collectDocuments(input: {
  journal: JournalEntry[];
  reflections: DailyReflection[];
  life: LifeItem[];
  studySessions: StudySessionItem[];
}): AiDocument[] {
  const docs: AiDocument[] = [];
  const push = (source: DocSource, sourceId: string, date: string, title: string, text: string) => {
    if (text.length >= MIN_CHARS) docs.push({ key: `${source}:${sourceId}`, source, sourceId, date, title, text });
  };

  for (const j of input.journal) {
    if (j.deletedAt) continue;
    push('journal', j.id, j.date, j.title || 'Journal entry', join(j.title, j.body));
  }
  for (const r of input.reflections) {
    push(
      'reflection',
      r.id,
      r.date,
      'Daily reflection',
      join(
        r.gratitude && `Grateful for ${r.gratitude}`,
        r.smallWin && `Small win: ${r.smallWin}`,
        r.eveningGoodThing,
        r.eveningLeaveForTomorrow,
        r.eveningMood,
      ),
    );
  }
  for (const item of input.life) {
    if (item.deletedAt) continue;
    let text = '';
    let date = keyOf(item.createdAt);
    switch (item.type) {
      case 'book':
        text = join(item.notes, item.quote);
        date = item.dateFinished ?? item.dateStarted ?? date;
        break;
      case 'movie':
        text = join(item.review, item.notes);
        date = item.dateWatched ?? date;
        break;
      case 'series':
        text = join(item.notes);
        break;
      case 'artwork':
        text = join(item.notes, item.mood);
        date = item.dateCreated ?? date;
        break;
      case 'experience':
        text = join(item.description, item.favoriteMemory, item.notes);
        date = item.date ?? date;
        break;
      case 'wish':
        text = join(item.notes);
        break;
    }
    // The title is shown separately — left out of the text so it doesn't sway what the note is "about".
    if (text) push('life', item.id, date, item.title, text);
  }
  for (const s of input.studySessions) {
    if (s.deletedAt || !s.notes) continue;
    push('study', s.id, s.date, s.title, s.notes);
  }
  return docs;
}

/** FNV-1a hash of the text — tells us when an entry changed and needs re-embedding. */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
