import { describe, it, expect, vi } from 'vitest';
import { db } from '@/db/db';
import { ensureDefaultSettings, getSettings, saveDeviceBookkeeping, saveSettings } from '@/db/repositories/settingsRepository';

describe('reminder notes are per device', () => {
  it('marking a reminder as shown does not count as a settings change (so it never overwrites the theme on other devices)', async () => {
    await db.settings.clear();
    await ensureDefaultSettings();
    await saveSettings({ theme: 'dark' });
    const before = (await getSettings()).updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await saveDeviceBookkeeping({ lastMorningReminderFiredDate: '2026-11-22' });
    const after = await getSettings();
    expect(after.lastMorningReminderFiredDate).toBe('2026-11-22');
    expect(after.updatedAt).toBe(before);
  });
});

describe('requests have a time limit', () => {
  it('a request that hangs is aborted instead of blocking sync forever', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const { fetchWithTimeout } = await import('@/lib/supabaseClient');
    vi.useFakeTimers();
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
    const pending = fetchWithTimeout('https://example.supabase.co/rest/v1/life_items');
    vi.advanceTimersByTime(30_001);
    await expect(pending).rejects.toThrow('aborted');
    globalThis.fetch = realFetch;
    vi.useRealTimers();
  });
});
