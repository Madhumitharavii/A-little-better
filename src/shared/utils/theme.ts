import type { AppSettings } from '@/db/schema';

type ThemeChoice = AppSettings['theme'];

/** Remembered on this device so the next launch paints in the right theme immediately (see index.html). */
const STORAGE_KEY = 'alb.theme';

const THEME_COLORS = { light: '#FFFFFF', dark: '#171411' } as const;

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

/** Resolves a choice ('system' included) to what should actually show right now. */
export function resolveTheme(choice: ThemeChoice | undefined): 'light' | 'dark' {
  if (choice === 'dark') return 'dark';
  if (choice === 'light') return 'light';
  return prefersDark() ? 'dark' : 'light';
}

/** Applies a theme choice to the page: the `dark` class, the browser/status-bar colour, and the remembered value. */
export function applyTheme(choice: ThemeChoice | undefined): void {
  const resolved = resolveTheme(choice);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
  try {
    localStorage.setItem(STORAGE_KEY, choice ?? 'system');
  } catch {
    // Only affects the very first paint next time — fine.
  }
}

/** Calls back whenever the device switches between light and dark (for the 'system' choice). */
export function onSystemThemeChange(callback: () => void): () => void {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!media) return () => {};
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

