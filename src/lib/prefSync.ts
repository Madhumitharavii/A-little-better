import { readPref, watchPref, writePref } from '@/db/repositories/syncedPrefs';
import { applyAiEnabled, isAiEnabled } from '@/features/ai/aiEngine';
import { applySeen, getSeen, loadHistory, mergeHistory, mergeSeen, saveHistory, subscribeHistory, subscribeSeen, type AdvisorHistory, type SeenToday } from '@/features/advisor/select';
import { applyStudyTimer, getStudyTimer, subscribeStudyTimer, type RunningStudyTimer } from '@/features/study/studyTimer';

/**
 * Keeps small per-device preferences the same on every device, through
 * the synced "pref" rows (see syncedPrefs.ts):
 *  - the On-device AI switch (each device still downloads the model itself),
 *  - Noticed for You history: what was shown, "Not helpful", and what's been read,
 *  - a running study timer — start it on the Mac, stop it on the phone.
 * Changes made here are written up; changes from another device are
 * applied here (merged, for advice history) without being echoed back.
 */
let applying = false;
const quietly = (fn: () => void) => {
  applying = true;
  try {
    fn();
  } finally {
    applying = false;
  }
};
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function startPrefSync(): void {
  // On-device AI switch.
  watchPref<boolean>('aiEnabled', (on) => {
    if (typeof on === 'boolean' && on !== isAiEnabled()) applyAiEnabled(on);
  });
  void readPref('aiEnabled').then((p) => {
    if (!p && isAiEnabled()) void writePref('aiEnabled', true); // first run: share a switch that was already on here
  });

  // Noticed for You history (merged, so nothing shown or dismissed on either device is lost).
  subscribeHistory((h) => {
    if (!applying) void writePref('advisorHistory', h);
  });
  watchPref<AdvisorHistory>('advisorHistory', (remote) => {
    const local = loadHistory();
    const merged = mergeHistory(local, remote);
    if (!same(merged, local)) quietly(() => saveHistory(merged));
  });
  void readPref('advisorHistory').then((p) => {
    if (!p) void writePref('advisorHistory', loadHistory());
  });

  // Which of today's advice has been read (the dot on 🧭 Noticed).
  subscribeSeen(() => {
    if (!applying) void writePref('advisorSeen', getSeen());
  });
  watchPref<SeenToday | null>('advisorSeen', (remote) => {
    const local = getSeen();
    const merged = mergeSeen(local, remote);
    if (!same(merged, local)) quietly(() => applySeen(merged));
  });

  // A running study timer.
  subscribeStudyTimer((t) => {
    if (!applying) void writePref('studyTimer', t);
  });
  watchPref<RunningStudyTimer | null>('studyTimer', (remote) => {
    if (!same(remote, getStudyTimer())) quietly(() => applyStudyTimer(remote));
  });
  void readPref('studyTimer').then((p) => {
    const t = getStudyTimer();
    if (!p && t) void writePref('studyTimer', t);
  });
}
