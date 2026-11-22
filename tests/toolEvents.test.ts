import { describe, it, expect } from 'vitest';
import { recordToolEvent, getToolEvents, clearToolEvents } from '@/db/repositories/toolEventRepository';

describe('"I\'m bored" / "I\'m scrolling" taps', () => {
  it('can be cleared', async () => {
    await recordToolEvent('bored');
    await recordToolEvent('bored');
    await recordToolEvent('scrolling');
    expect(await clearToolEvents()).toBe(3);
    expect(await getToolEvents()).toEqual([]);
  });
});
