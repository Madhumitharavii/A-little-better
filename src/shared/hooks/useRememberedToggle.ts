import { useState } from 'react';

/**
 * A boolean that remembers its last value on this device (e.g. whether
 * a Today section is folded open). Purely a per-device convenience:
 * if storage is unavailable (private mode, cleared data) it quietly
 * falls back to `initial` and still works for the session.
 */
export function useRememberedToggle(key: string, initial: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === '1';
    } catch {
      return initial;
    }
  });
  const update = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      // Not saved for next time — fine.
    }
  };
  return [value, update];
}
