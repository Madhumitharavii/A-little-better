import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db/db';
import { readPref, writePref, watchPref } from '@/db/repositories/syncedPrefs';
import { mergeHistory, mergeSeen } from '@/features/advisor/select';
import { lifeItemToRemote } from '@/lib/sync/mapping';
import type { LifeItem } from '@/db/schema';

const wait = () => new Promise((r) => setTimeout(r, 30));

describe('synced preferences', () => {
  beforeEach(async () => {
    await db.lifeItems.clear();
  });

  it('are rows in the synced table, so they travel with normal sync', async () => {
    await writePref('aiEnabled', true);
    const [row] = await db.lifeItems.toArray();
    expect(row).toMatchObject({ type: 'pref', key: 'aiEnabled', value: true, title: 'aiEnabled' });
    expect(lifeItemToRemote(row as LifeItem, 'u', null)).toMatchObject({ type: 'pref', title: 'aiEnabled', payload: { key: 'aiEnabled', value: true } });
    expect((await readPref<boolean>('aiEnabled'))?.value).toBe(true);
  });

  it('updates in place, and the newest row wins if two devices created one', async () => {
    await writePref('aiEnabled', true);
    await writePref('aiEnabled', false);
    expect(await db.lifeItems.count()).toBe(1);
    await db.lifeItems.add({ id: 'other-device', type: 'pref', title: 'aiEnabled', key: 'aiEnabled', value: true, createdAt: '2999-01-01T00:00:00Z', updatedAt: '2999-01-01T00:00:00Z' } as unknown as LifeItem);
    expect((await readPref<boolean>('aiEnabled'))?.value).toBe(true);
  });

  it('tells this device about changes from another device, not about its own', async () => {
    const seen = vi.fn();
    const stop = watchPref<boolean>('aiEnabled', seen);
    await writePref('aiEnabled', true); // our own write
    await wait();
    await db.lifeItems.put({ id: 'x', type: 'pref', title: 'aiEnabled', key: 'aiEnabled', value: false, createdAt: '2999-01-01T00:00:00Z', updatedAt: '2999-01-01T00:00:00Z' } as unknown as LifeItem); // arrives via sync
    await wait();
    stop();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith(false);
  });

  it('merges Noticed-for-You history from two devices without losing anything', () => {
    const phone = { shown: { a: { date: '2026-11-20', fingerprint: '1' } }, dismissed: { boredom: '2026-11-21' }, today: { date: '2026-11-22', keys: ['a'] } };
    const mac = { shown: { a: { date: '2026-11-18', fingerprint: '1' }, b: { date: '2026-11-19', fingerprint: '2' } }, dismissed: {}, today: { date: '2026-11-21', keys: ['b'] } };
    expect(mergeHistory(mac, phone)).toEqual({
      shown: { a: { date: '2026-11-20', fingerprint: '1' }, b: { date: '2026-11-19', fingerprint: '2' } },
      dismissed: { boredom: '2026-11-21' },
      today: { date: '2026-11-22', keys: ['a'] },
    });
    expect(mergeSeen({ date: '2026-11-22', keys: ['a'] }, { date: '2026-11-22', keys: ['b'] })).toEqual({ date: '2026-11-22', keys: ['a', 'b'] });
    expect(mergeSeen({ date: '2026-11-21', keys: ['a'] }, { date: '2026-11-22', keys: ['b'] })).toEqual({ date: '2026-11-22', keys: ['b'] });
  });
});
