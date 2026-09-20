import { db } from '../db';
import { generateId, nowIso } from '../id';
import type { LifeImage } from '../schema';

/** Stores a raw image file as a Blob and returns its new id. */
export async function saveLifeImage(file: Blob): Promise<string> {
  const id = generateId();
  const record: LifeImage = { id, blob: file, createdAt: nowIso() };
  await db.lifeImages.add(record);
  return id;
}

export async function getLifeImage(id: string): Promise<LifeImage | undefined> {
  return db.lifeImages.get(id);
}

export async function deleteLifeImage(id: string): Promise<void> {
  await db.lifeImages.delete(id);
}
