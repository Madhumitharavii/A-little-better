import { describe, it, expect } from 'vitest';
import { parseGoodreadsCsv, planGoodreadsImport } from '@/features/life/books/goodreadsImport';
import { lifeItemActivityDates } from '@/db/lifeDates';
import type { BookItem } from '@/db/schema';

// Goodreads' real export header (2024–2026), with made-up books.
const HEADER =
  'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies';
const row = (o: Partial<Record<string, string>>) =>
  [
    o.id ?? '1', o.title ?? '', o.author ?? '', '', '', '="0000000000"', '="9780000000000"', o.rating ?? '0', '4.10', 'Pub', 'Paperback', '300', '2020', '2019',
    o.read ?? '', o.added ?? '2024/01/01', o.shelves ?? '', '', o.exclusive ?? 'read', o.review ?? '', '', o.private ?? '', o.count ?? '1', '0',
  ]
    .map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
    .join(',');

const CSV = '﻿' + [
  HEADER,
  row({ id: '1', title: 'The Name of the Wind (The Kingkiller Chronicle, #1)', author: 'Patrick Rothfuss', rating: '5', read: '2023/05/12', added: '2023/04/01', shelves: 'favorites, fantasy', count: '3', review: 'Loved it.<br/><br/>The <b>music</b> scenes &amp; Kvothe.', private: 'Lent to Nithu' }),
  row({ id: '2', title: 'Atomic Habits', author: 'James Clear', rating: '0', read: '', exclusive: 'currently-reading', shelves: 'currently-reading, self-help' }),
  row({ id: '3', title: 'Pachinko', author: 'Min Jin Lee', exclusive: 'to-read', added: '2025/02/03', shelves: 'to-read' }),
  row({ id: '4', title: 'Infinite Jest', author: 'David Foster Wallace', exclusive: 'read', shelves: 'dnf' }),
  row({ id: '5', title: 'Kafka on the Shore', author: 'Haruki Murakami', rating: '4', read: '', exclusive: 'read' }),
].join('\n');

function apply(lib: BookItem[], plan: ReturnType<typeof planGoodreadsImport>): BookItem[] {
  const out = lib.map((b) => {
    const u = plan.updates.find((x) => x.id === b.id);
    return u ? ({ ...b, ...u.patch } as BookItem) : b;
  });
  plan.creates.forEach((c, i) => out.push({ ...c, id: `n${i}`, createdAt: '2026-11-21T10:00:00Z', updatedAt: '2026-11-21T10:00:00Z' } as BookItem));
  return out;
}

describe('Goodreads import', () => {
  const rows = parseGoodreadsCsv(CSV);
  const byTitle = (t: string) => rows.find((r) => r.title.startsWith(t))!;

  it('brings in every shelf with the right status', () => {
    expect(rows).toHaveLength(5);
    expect(byTitle('The Name').status).toBe('finished');
    expect(byTitle('Atomic').status).toBe('inProgress');
    expect(byTitle('Pachinko').status).toBe('wantTo');
    expect(byTitle('Infinite').status).toBe('didNotFinish');
  });

  it('cleans reviews, keeps private notes, reads ratings, dates, rereads and shelves', () => {
    const b = byTitle('The Name');
    expect(b).toMatchObject({ rating: 5, dateRead: '2023-05-12', dateAdded: '2023-04-01', readCount: 3, favorite: true, shelves: ['fantasy'] });
    expect(b.notes).toBe('Loved it.\n\nThe music scenes & Kvothe.\n\nPrivate notes: Lent to Nithu');
    expect(byTitle('Atomic').rating).toBeUndefined();
    expect(byTitle('Atomic').shelves).toEqual(['self-help']);
  });

  it('plans new books, with rereads as earlier readings', () => {
    const plan = planGoodreadsImport(rows, []);
    expect(plan.summary).toMatchObject({ books: 5, newBooks: 5, finished: 2, reading: 1, wantTo: 1, didNotFinish: 1, favorites: 1, rereads: 1, shelves: ['fantasy', 'self-help'] });
    const lib = apply([], plan);
    const wind = lib.find((b) => b.title.startsWith('The Name'))!;
    expect(wind).toMatchObject({ status: 'finished', dateFinished: '2023-05-12', favorite: true, source: 'goodreads' });
    expect(wind.previousReadings).toHaveLength(2);
    expect(lib.find((b) => b.title === 'Pachinko')!.dateFinished).toBeUndefined();
  });

  it('is safe to re-run — a second import changes nothing', () => {
    const lib = apply([], planGoodreadsImport(rows, []));
    const again = planGoodreadsImport(rows, lib);
    expect(again.creates).toHaveLength(0);
    expect(again.updates).toHaveLength(0);
  });

  it('fills in books already in the app without overwriting anything', () => {
    const mine: BookItem[] = [
      { id: 'a', type: 'book', title: 'atomic habits', author: 'James Clear', status: 'wantTo', notes: 'My own note', createdAt: 'x', updatedAt: 'x' },
      { id: 'b', type: 'book', title: 'Kafka on the Shore', author: 'Haruki Murakami', status: 'finished', rating: 3, createdAt: 'x', updatedAt: 'x' },
    ];
    const lib = apply(mine, planGoodreadsImport(rows, mine));
    expect(lib.find((b) => b.id === 'a')).toMatchObject({ status: 'inProgress', notes: 'My own note', shelves: ['self-help'] });
    expect(lib.find((b) => b.id === 'b')!.rating).toBe(3); // mine wins
    expect(lib.filter((b) => b.title.toLowerCase() === 'atomic habits')).toHaveLength(1);
  });

  it('rejects a file that is not a Goodreads export', () => {
    expect(() => parseGoodreadsCsv('Name,Year\nX,2000')).toThrow(/Goodreads/);
  });
});

describe('imported books and "this week"', () => {
  const base = { id: 'x', title: 'X', createdAt: '2026-11-21T10:00:00Z', updatedAt: '2026-11-21T10:00:00Z' };
  it('uses the real reading dates, never the import day', () => {
    expect(lifeItemActivityDates({ ...base, type: 'book', source: 'goodreads', dateFinished: '2023-05-12' } as BookItem)).toEqual(['2023-05-12']);
    expect(lifeItemActivityDates({ ...base, type: 'book', source: 'goodreads', status: 'finished' } as BookItem)).toEqual([]);
    expect(lifeItemActivityDates({ ...base, type: 'book', status: 'wantTo' } as BookItem)).toEqual([]);
    expect(lifeItemActivityDates({ ...base, type: 'book', status: 'finished' } as BookItem)).toEqual(['2026-11-21']);
  });
});
