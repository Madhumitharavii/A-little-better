import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { DailyReflection } from '../schema';

export async function getDailyReflection(date: string): Promise<DailyReflection | undefined> {
  return db.dailyReflections.where('date').equals(date).first();
}

export async function getAllDailyReflections(): Promise<DailyReflection[]> {
  return db.dailyReflections.orderBy('date').toArray();
}

type ReflectionPatch = Partial<
  Omit<DailyReflection, 'id' | 'date' | 'createdAt' | 'updatedAt'>
>;

/** Create-or-patch the single reflection row for a date. */
export async function saveDailyReflection(
  date: string,
  patch: ReflectionPatch,
): Promise<DailyReflection> {
  const existing = await getDailyReflection(date);
  const timestamp = nowIso();

  if (existing) {
    const updated: DailyReflection = { ...existing, ...patch, updatedAt: timestamp };
    await db.dailyReflections.put(updated);
    return updated;
  }

  const created: DailyReflection = {
    id: generateId(),
    date,
    ...patch,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.dailyReflections.add(created);
  return created;
}
