import { useEffect, useState } from 'react';
import { readPref, watchPref, writePref } from '@/db/repositories/syncedPrefs';

/** A line of your own writing you ♥'d — kept for good, and it follows you between devices. */
export interface SavedLine {
  text: string;
  /** The day you wrote it (YYYY-MM-DD). */
  date: string;
  savedAt: string;
}

export const sameLine = (a: { text: string }, b: { text: string }) => a.text.trim() === b.text.trim();

/** Adds the line if it isn't saved yet, removes it if it is. Newest saved first. */
export function toggleLine(lines: readonly SavedLine[], line: { text: string; date: string }, now = new Date().toISOString()): SavedLine[] {
  return lines.some((l) => sameLine(l, line))
    ? lines.filter((l) => !sameLine(l, line))
    : [{ text: line.text.trim(), date: line.date, savedAt: now }, ...lines];
}

let current: SavedLine[] = [];
const listeners = new Set<(l: SavedLine[]) => void>();
const publish = (l: SavedLine[]) => {
  current = l;
  listeners.forEach((f) => f(l));
};
let loaded = false;
function load() {
  if (loaded) return;
  loaded = true;
  void readPref<SavedLine[]>('savedLines').then((p) => p && publish(p.value ?? []));
  watchPref<SavedLine[]>('savedLines', (v) => publish(v ?? []));
}

export function useSavedLines(): [SavedLine[], (line: { text: string; date: string }) => void] {
  const [lines, setLines] = useState(current);
  useEffect(() => {
    load();
    listeners.add(setLines);
    setLines(current);
    return () => void listeners.delete(setLines);
  }, []);
  const toggle = (line: { text: string; date: string }) => {
    const next = toggleLine(current, line);
    publish(next);
    void writePref('savedLines', next);
  };
  return [lines, toggle];
}
