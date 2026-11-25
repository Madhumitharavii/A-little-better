import { useEffect, useMemo, useReducer, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useLifeRows } from '@/db/lifeStore';
import { useToday } from '@/shared/hooks/useToday';
import { getLocalDateKey } from '@/db/dateUtils';
import { allInsights, type AdvisorData, type Insight } from './rules';
import { allSeen, chooseToday, dismissRule, loadHistory, markSeen, saveHistory, subscribeHistory, subscribeSeen } from './select';
import { useAiEnabled, useAiState } from '@/features/ai/aiEngine';

/** Everything the advisor reads — straight from the local database. */
function useAdvisorData(): AdvisorData | undefined {
  const others = useLiveQuery(async () => {
    const [care, journal, reflections, people] = await Promise.all([
      db.careEntries.toArray(),
      db.journalEntries.toArray(),
      db.dailyReflections.toArray(),
      db.people.toArray(),
    ]);
    return { care, journal, reflections, people };
  }, []);
  // Life rows come from the one shared copy of the table (lifeStore.ts).
  const life = useLifeRows();
  const today = useToday();
  return useMemo(() => {
    if (!others || !life) return undefined;
    const { care, journal, reflections, people } = others;
    // The lifeItems table also holds study rows, "I'm bored" taps and synced preferences — split them out.
    const rows = life.filter((i) => !i.deletedAt) as unknown as Array<{ type: string }>;
    return {
      today,
      care,
      journal: journal.filter((j) => !j.deletedAt),
      reflections,
      life: rows.filter((i) => i.type !== 'subject' && i.type !== 'studySession' && i.type !== 'toolEvent' && i.type !== 'pref' && i.type !== 'letter') as unknown as AdvisorData['life'],
      people: people.filter((p) => !p.deletedAt),
      toolEvents: rows.filter((i) => i.type === 'toolEvent') as unknown as AdvisorData['toolEvents'],
      subjects: rows.filter((i) => i.type === 'subject') as unknown as AdvisorData['subjects'],
      studySessions: rows.filter((i) => i.type === 'studySession') as unknown as AdvisorData['studySessions'],
    };
  }, [others, life, today]);
}

/**
 * Today's advice, shared by the Today card and the header's 🧭 Noticed
 * pop-up (both read the same history, so they always agree).
 */
export function useAdvice() {
  const baseData = useAdvisorData();
  const aiEnabled = useAiEnabled();
  const ai = useAiState();
  // Emotion understanding from the on-device model, when it's on and ready.
  const data = useMemo(
    () => (baseData ? { ...baseData, aiThemeCounts: aiEnabled && ai.ready ? ai.emotionCounts : null } : undefined),
    [baseData, aiEnabled, ai.ready, ai.emotionCounts],
  );
  const [history, setHistory] = useState(loadHistory);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => subscribeHistory(setHistory), []);
  useEffect(() => subscribeSeen(rerender), []);

  const candidates = useMemo(() => (data ? allInsights(data) : []), [data]);
  const today = data?.today ?? getLocalDateKey();
  const { picks, history: nextHistory } = useMemo(() => chooseToday(candidates, history, today), [candidates, history, today]);

  useEffect(() => {
    if (data && nextHistory !== history) saveHistory(nextHistory);
  }, [data, nextHistory, history]);

  const keys = picks.map((p) => p.key);

  return {
    ready: !!data,
    picks,
    hasAnyData: candidates.length > 0,
    /** New advice today that hasn't been looked at yet → the dot. */
    hasUnseen: picks.length > 0 && !allSeen(today, keys),
    markSeen: () => markSeen(today, keys),
    notHelpful: (insight: Insight) => {
      // Quiet this kind for a month, and drop today's cached picks so something else can take its place.
      saveHistory({ ...dismissRule(history, insight.rule, today), today: undefined });
    },
  };
}
