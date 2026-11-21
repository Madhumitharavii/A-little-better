import { useEffect, useState } from 'react';
import { suggestTags, useAiEnabled, useAiState } from './aiEngine';

/** Up to 3 suggested tags for the text being written (debounced; only when on-device AI is on and ready). */
export function useTagSuggestions(text: string, currentTags: string[]): string[] {
  const enabled = useAiEnabled();
  const { ready } = useAiState();
  const [tags, setTags] = useState<string[]>([]);
  const current = currentTags.join(',');

  useEffect(() => {
    if (!enabled || !ready || text.trim().length < 20) {
      setTags([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      suggestTags(text, current ? current.split(',') : [])
        .then((s) => !cancelled && setTags(s))
        .catch(() => !cancelled && setTags([]));
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [enabled, ready, text, current]);

  return tags;
}
