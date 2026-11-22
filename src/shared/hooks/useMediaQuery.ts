import { useSyncExternalStore } from 'react';

/** True while the CSS media query matches (e.g. '(min-width: 768px)'), updating as the window resizes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
