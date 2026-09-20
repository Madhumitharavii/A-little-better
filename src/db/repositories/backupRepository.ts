import { db } from '../db';
import { nowIso } from '../id';
import { SCHEMA_VERSION, type BackupFile, type SerializedLifeImage } from '../schema';

/** Converts a Blob to a base64 string in chunks, safe for large images. */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Reads every store into one exportable JSON-serializable object. */
export async function exportAllData(): Promise<BackupFile> {
  const [careEntries, dailyReflections, journalEntries, lifeItems, lifeImageRows, people, periodEntries, settings] =
    await Promise.all([
      db.careEntries.toArray(),
      db.dailyReflections.toArray(),
      db.journalEntries.toArray(),
      db.lifeItems.toArray(),
      db.lifeImages.toArray(),
      db.people.toArray(),
      db.periodEntries.toArray(),
      db.settings.toArray(),
    ]);

  const lifeImages: SerializedLifeImage[] = await Promise.all(
    lifeImageRows.map(async (row) => ({
      id: row.id,
      base64: await blobToBase64(row.blob),
      mimeType: row.blob.type || 'image/jpeg',
      createdAt: row.createdAt,
    })),
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    data: { careEntries, dailyReflections, journalEntries, lifeItems, lifeImages, people, periodEntries, settings },
  };
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  summary?: {
    careEntries: number;
    dailyReflections: number;
    journalEntries: number;
    lifeItems: number;
    lifeImages: number;
    people: number;
    periodEntries: number;
    exportedAt: string;
    schemaVersion: number;
  };
}

/**
 * Checks a parsed backup file's shape before anything touches the
 * database. The UI must show this summary and get an explicit
 * confirmation from the person before calling importAllData —
 * imports never happen silently.
 *
 * Backups made with schemaVersion 1 (before LIFE existed) won't have
 * a lifeImages array, and backups made before schemaVersion 3 (before
 * period tracking existed) won't have periodEntries — both are
 * expected and treated as "nothing to restore" for that part, not an
 * error.
 */
export function validateBackupFile(candidate: unknown): BackupValidationResult {
  const errors: string[] = [];

  if (typeof candidate !== 'object' || candidate === null) {
    return { valid: false, errors: ['This file is not a valid backup (not a JSON object).'] };
  }

  const file = candidate as Partial<BackupFile>;

  if (typeof file.schemaVersion !== 'number') {
    errors.push('Missing or invalid schemaVersion.');
  } else if (file.schemaVersion > SCHEMA_VERSION) {
    errors.push(
      `This backup was made with a newer app version (schema v${file.schemaVersion}) than this app supports (v${SCHEMA_VERSION}).`,
    );
  }

  if (typeof file.exportedAt !== 'string') {
    errors.push('Missing exportedAt timestamp.');
  }

  if (typeof file.data !== 'object' || file.data === null) {
    errors.push('Missing data section.');
    return { valid: false, errors };
  }

  const requiredKeys: Array<keyof BackupFile['data']> = [
    'careEntries',
    'dailyReflections',
    'journalEntries',
    'lifeItems',
    'people',
    'settings',
  ];
  for (const key of requiredKeys) {
    if (!Array.isArray(file.data[key])) {
      errors.push(`data.${key} is missing or not an array.`);
    }
  }
  // lifeImages and periodEntries are optional for backward compatibility with older backups.
  if (file.data.lifeImages !== undefined && !Array.isArray(file.data.lifeImages)) {
    errors.push('data.lifeImages is present but not an array.');
  }
  if (file.data.periodEntries !== undefined && !Array.isArray(file.data.periodEntries)) {
    errors.push('data.periodEntries is present but not an array.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    summary: {
      careEntries: file.data.careEntries!.length,
      dailyReflections: file.data.dailyReflections!.length,
      journalEntries: file.data.journalEntries!.length,
      lifeItems: file.data.lifeItems!.length,
      lifeImages: file.data.lifeImages?.length ?? 0,
      people: file.data.people!.length,
      periodEntries: file.data.periodEntries?.length ?? 0,
      exportedAt: file.exportedAt as string,
      schemaVersion: file.schemaVersion as number,
    },
  };
}

/**
 * Replaces all local data with the contents of a validated backup.
 * Callers must run validateBackupFile first and get explicit user
 * confirmation — this function does not ask again, it trusts the
 * caller has already gated it.
 */
export async function importAllData(file: BackupFile): Promise<void> {
  const lifeImages = file.data.lifeImages ?? [];
  const periodEntries = file.data.periodEntries ?? [];

  await db.transaction(
    'rw',
    [db.careEntries, db.dailyReflections, db.journalEntries, db.lifeItems, db.lifeImages, db.people, db.periodEntries, db.settings],
    async () => {
      await Promise.all([
        db.careEntries.clear(),
        db.dailyReflections.clear(),
        db.journalEntries.clear(),
        db.lifeItems.clear(),
        db.lifeImages.clear(),
        db.people.clear(),
        db.periodEntries.clear(),
        db.settings.clear(),
      ]);

      const decodedImages = lifeImages.map((img) => ({
        id: img.id,
        blob: base64ToBlob(img.base64, img.mimeType),
        createdAt: img.createdAt,
      }));

      await Promise.all([
        db.careEntries.bulkAdd(file.data.careEntries),
        db.dailyReflections.bulkAdd(file.data.dailyReflections),
        db.journalEntries.bulkAdd(file.data.journalEntries),
        db.lifeItems.bulkAdd(file.data.lifeItems),
        db.lifeImages.bulkAdd(decodedImages),
        db.people.bulkAdd(file.data.people),
        db.periodEntries.bulkAdd(periodEntries),
        db.settings.bulkAdd(file.data.settings),
      ]);
    },
  );
}

export function downloadBackupFile(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStamp = backup.exportedAt.slice(0, 10);
  a.href = url;
  a.download = `a-little-better-backup-${dateStamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
