import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/db';
import { getLifeItems, getLifeCounts } from '@/db/repositories/lifeRepository';
import type { LifeItem } from '@/db/schema';

describe('reading Life items', () => {
  beforeEach(async () => {
    await db.lifeItems.clear();
  });

  it('finds goals even with other kinds of rows and an odd row in the table', async () => {
    const t = '2026-11-22T10:00:00.000Z';
    await db.lifeItems.bulkAdd([
      { id: 'w1', type: 'wish', listType: 'annualVision', title: 'See the sea', year: 2026, createdAt: t, updatedAt: t },
      { id: 'w2', type: 'wish', listType: 'annualVision', title: 'Odd row', year: 2026, dateCompleted: 20261122, createdAt: t, updatedAt: t },
      { id: 'w3', type: 'wish', listType: 'somedayMaybe', title: 'No dates at all', updatedAt: t },
      { id: 'p1', type: 'pref', title: 'aiEnabled', key: 'aiEnabled', value: true, createdAt: t, updatedAt: t },
      { id: 'e1', type: 'toolEvent', title: 'bored', tool: 'bored', at: t, createdAt: t, updatedAt: t },
      { id: 'w4', type: 'wish', title: 'Deleted', createdAt: t, updatedAt: t, deletedAt: t },
    ] as unknown as LifeItem[]);
    const wishes = await getLifeItems('wish');
    expect(wishes.map((w) => w.id).sort()).toEqual(['w1', 'w2', 'w3']);
    expect((await getLifeCounts()).wish).toBe(3);
  });
});
