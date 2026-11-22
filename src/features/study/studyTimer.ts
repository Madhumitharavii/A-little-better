import { useEffect, useState } from 'react';

/**
 * The start/stop study timer. Only the START moment is stored (on this
 * device), and elapsed time is always worked out from it — so the timer
 * keeps counting even if the app is closed or the phone is locked, and
 * picks up exactly where it was when you come back.
 */

export interface RunningStudyTimer {
  subjectId: string;
  topicId?: string;
  /** ISO timestamp of when "Start" was tapped. */
  startedAt: string;
}

const STORAGE_KEY = 'alb.studyTimer';
const listeners = new Set<(timer: RunningStudyTimer | null) => void>();

function read(): RunningStudyTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RunningStudyTimer) : null;
  } catch {
    return null;
  }
}

function write(timer: RunningStudyTimer | null) {
  try {
    if (timer) localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the timer still works while the app stays open.
  }
  memory = timer;
  for (const listener of listeners) listener(timer);
}

let memory: RunningStudyTimer | null = read();

export function getStudyTimer(): RunningStudyTimer | null {
  return memory;
}

/** Sets the timer from another device (sync) — same as starting/stopping here, without a new start time. */
export function applyStudyTimer(timer: RunningStudyTimer | null): void {
  write(timer);
}

export function subscribeStudyTimer(listener: (timer: RunningStudyTimer | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startStudyTimer(subjectId: string, topicId?: string) {
  write({ subjectId, topicId, startedAt: new Date().toISOString() });
}

/** Clears the timer and returns what was running (the caller saves the session). */
export function stopStudyTimer(): RunningStudyTimer | null {
  const running = memory;
  write(null);
  return running;
}

export function elapsedSeconds(timer: RunningStudyTimer, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(timer.startedAt)) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** The running timer (or null), plus a ticking elapsed-seconds value while it runs. */
export function useStudyTimer(): { timer: RunningStudyTimer | null; seconds: number } {
  const [timer, setTimer] = useState<RunningStudyTimer | null>(memory);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    listeners.add(setTimer);
    // Another tab/window started or stopped it.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        memory = read();
        setTimer(memory);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(setTimer);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!timer) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  return { timer, seconds: timer ? elapsedSeconds(timer, now) : 0 };
}
