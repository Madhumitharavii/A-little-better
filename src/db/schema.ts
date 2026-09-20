/**
 * Entity types for every local store.
 *
 * Every entity carries id / createdAt / updatedAt so records are
 * sync-ready from day one, per the approved architecture — even
 * though there's no sync code yet. `deletedAt` is included on the
 * entities a person actually edits/deletes so soft-delete can
 * propagate later without a schema migration.
 */

export const SCHEMA_VERSION = 3;

export type CareItemKey =
  | 'bathed'
  | 'ateFruit'
  | 'movement'
  | 'reading'
  | 'focus'
  | 'spaceReset'
  | 'messageReset'
  | 'relationshipCheck';

export type CareStatus = 'done' | 'skipped';

export interface CareEntry {
  id: string;
  date: string; // local date key, e.g. "2026-08-12"
  itemKey: CareItemKey;
  status: CareStatus;
  skipReason?: string | null;
  /** Only meaningful for 'reading' and 'focus' — accumulated minutes for that day. */
  valueMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReflection {
  id: string;
  date: string;
  gratitude?: string;
  smallWin?: string;
  eveningGoodThing?: string;
  eveningLeaveForTomorrow?: string;
  eveningMood?: string;
  eveningDone?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SourceTool =
  | 'procrastination'
  | 'overthinking'
  | 'temper'
  | 'selfDoubt'
  | 'appearance'
  | null;

export interface JournalEntry {
  id: string;
  date: string;
  title?: string;
  body: string;
  mood?: string;
  tags?: string[];
  sourceTool?: SourceTool;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * LIFE — a personal archive of things read, watched, made, and lived.
 *
 * One Dexie table (`lifeItems`) holds all six categories, discriminated
 * by `type`. This keeps cross-category search, "recently added", and
 * future sync simple (one table, one changefeed) while TypeScript still
 * enforces that a book can't accidentally carry movie fields.
 *
 * Ratings are personal records, not scores — nothing in the UI should
 * ever frame them as judgment.
 */
export type LifeItemType = 'book' | 'movie' | 'series' | 'artwork' | 'experience' | 'wish';

/** "Want to Read" / "Currently Reading" / "Finished" / "Did Not Finish". */
export type BookStatus = 'wantTo' | 'inProgress' | 'finished' | 'didNotFinish';

/** A movie is assumed watched unless marked otherwise — no separate "watched" status needed. */
export type MovieStatus = 'watched' | 'didNotFinish';

export type SeriesStatus = 'wantTo' | 'watching' | 'finished' | 'didNotFinish';

interface LifeItemBase {
  id: string;
  title: string;
  favorite?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * One earlier reading of a book, kept when the person logs a re-read.
 * The book's own top-level fields (status/dates/rating/notes) always
 * represent the CURRENT (most recent) reading — this array holds the
 * ones before it, oldest first, so nothing is overwritten.
 */
export interface BookReadingEntry {
  id: string;
  status?: BookStatus;
  dateStarted?: string;
  dateFinished?: string;
  rating?: number;
  notes?: string;
}

export interface BookItem extends LifeItemBase {
  type: 'book';
  author?: string;
  /** External cover URL, if the person pastes one in. */
  coverUrl?: string;
  /** id into the lifeImages store, if a cover photo was uploaded locally. */
  coverImageId?: string;
  status?: BookStatus;
  dateAdded?: string;
  dateStarted?: string;
  dateFinished?: string;
  /** 1–5, a personal record — never displayed as a grade. */
  rating?: number;
  quote?: string;
  /** Earlier readings, oldest first — see BookReadingEntry. */
  previousReadings?: BookReadingEntry[];
  /** Future-proofing for a Goodreads importer — not built yet. */
  source?: 'manual' | 'goodreads';
}

/**
 * One earlier watch of a movie, kept when the person logs a rewatch.
 * Mirrors BookReadingEntry — the movie's top-level fields always
 * represent the CURRENT (most recent) watch.
 */
export interface MovieWatchEntry {
  id: string;
  dateWatched?: string;
  rating?: number;
  review?: string;
  source?: 'manual' | 'letterboxd';
}

export interface MovieItem extends LifeItemBase {
  type: 'movie';
  year?: number;
  posterUrl?: string;
  posterImageId?: string;
  status?: MovieStatus;
  dateWatched?: string;
  rating?: number;
  review?: string;
  /** True once there's more than one watch on record — kept for quick display, derived at write time. */
  rewatch?: boolean;
  tags?: string[];
  letterboxdUri?: string;
  imdbId?: string;
  tmdbId?: string;
  /** Earlier watches, oldest first — see MovieWatchEntry. */
  previousWatches?: MovieWatchEntry[];
  /** Set to 'letterboxd' for rows brought in via the diary CSV importer. */
  source?: 'manual' | 'letterboxd';
}

/**
 * One episode within a season. Kept simple and flat — no separate
 * air dates or synopses, just enough to track watching it.
 */
export interface Episode {
  id: string;
  number: number;
  title?: string;
  watched?: boolean;
  dateWatched?: string;
  favorite?: boolean;
  /** 1–5, a personal record. */
  rating?: number;
  /** How many times this episode has been rewatched, beyond the first watch. */
  rewatchCount?: number;
}

export interface Season {
  id: string;
  number: number;
  title?: string;
  /** 1–5, a personal record for the season as a whole. */
  rating?: number;
  episodes: Episode[];
}

/** Series keeps its own top-level rating/favorite/status for the show overall, plus optional season/episode detail. */
export interface SeriesItem extends LifeItemBase {
  type: 'series';
  posterUrl?: string;
  posterImageId?: string;
  status?: SeriesStatus;
  dateStarted?: string;
  dateFinished?: string;
  rating?: number;
  /** Optional — a series can be logged with no season/episode detail at all. */
  seasons?: Season[];
}

export interface ArtworkItem extends LifeItemBase {
  type: 'artwork';
  /** id into the lifeImages store. */
  imageId?: string;
  dateCreated?: string;
  medium?: string;
  mood?: string;
}

export interface ExperienceItem extends LifeItemBase {
  type: 'experience';
  date?: string;
  location?: string;
  people?: string;
  description?: string;
  favoriteMemory?: string;
  /** 1–5, a personal record. */
  rating?: number;
  /** ids into the lifeImages store — up to 3 photos per experience. */
  imageIds?: string[];
  tags?: string[];
}

/** Which of the two lightweight lists a wish belongs to. */
export type WishListType = 'somedayMaybe' | 'annualVision';

/**
 * A playful, lightweight entry — not a goal tracker.
 * 'somedayMaybe': lifelong, pressure-free things to try/see/eat/visit.
 * 'annualVision': this year's vision-board items, with a small
 * celebratory moment when checked off.
 * listType is optional for backward compatibility with entries
 * created before the split — treated as 'somedayMaybe' if absent.
 */
export interface WishItem extends LifeItemBase {
  type: 'wish';
  listType?: WishListType;
  category?: string;
  /** Mainly relevant for annualVision entries. */
  year?: number;
  done?: boolean;
  dateCompleted?: string;
  /** Set when a completed wish is turned into an Experience entry. */
  linkedExperienceId?: string;
}

export type LifeItem = BookItem | MovieItem | SeriesItem | ArtworkItem | ExperienceItem | WishItem;

/**
 * Omit<LifeItem, ...> or Partial<LifeItem> would silently collapse to
 * only the fields shared by all variants — TypeScript's keyof on a
 * union is the *intersection* of each member's keys, not the union of
 * them. These are built per-variant first, then unioned, so each
 * category keeps its own fields (author, year, medium, ...) typed.
 */
export type NewLifeItemInput =
  | Omit<BookItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  | Omit<MovieItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  | Omit<SeriesItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  | Omit<ArtworkItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  | Omit<ExperienceItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  | Omit<WishItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export type LifeItemPatch =
  | ({ type: 'book' } & Partial<Omit<BookItem, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'deletedAt'>>)
  | ({ type: 'movie' } & Partial<Omit<MovieItem, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'deletedAt'>>)
  | ({ type: 'series' } & Partial<Omit<SeriesItem, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'deletedAt'>>)
  | ({ type: 'artwork' } & Partial<Omit<ArtworkItem, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'deletedAt'>>)
  | ({ type: 'experience' } & Partial<Omit<ExperienceItem, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'deletedAt'>>)
  | ({ type: 'wish' } & Partial<Omit<WishItem, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'deletedAt'>>);

/** Raw image bytes for artwork/experience photos and optional book/movie/series covers. */
export interface LifeImage {
  id: string;
  blob: Blob;
  createdAt: string;
  /** Set once this image has been uploaded to Supabase Storage — prevents re-uploading on every sync. Unused until sync is wired up. */
  remoteUploadedAt?: string;
}

/** Placeholder store for the future People section — no UI yet. */
export interface Person {
  id: string;
  name: string;
  relationship?: string;
  desiredCadenceDays?: number;
  lastContactedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * PERIOD / CYCLE TRACKING
 *
 * A separate store from lifeItems — this is personal health data, not
 * a memory to browse. Each entry is one period (a start date, and an
 * end date once it's known). Predictions and averages are always
 * computed from this history at read time, never stored, so they stay
 * correct as new entries are added or edited.
 */
export type PeriodSource = 'manual' | 'import';

export interface PeriodEntry {
  id: string;
  startDate: string;
  endDate?: string;
  flow?: 'light' | 'medium' | 'heavy';
  notes?: string;
  source: PeriodSource;
  /** e.g. "Flo" — which app/file an imported entry came from, for the person's own reference. */
  importSourceLabel?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AppSettings {
  id: 'app-settings';
  soundEnabled: boolean;
  theme: 'light';
  /** Reminders are best-effort local notifications — see remindersRepository for the honest limitations. */
  nightReminderEnabled?: boolean;
  nightReminderTime?: string; // "HH:MM", 24h
  morningReminderEnabled?: boolean;
  morningReminderTime?: string; // "HH:MM", 24h
  lastNightReminderFiredDate?: string;
  lastMorningReminderFiredDate?: string;
  /**
   * A random id generated once per device/install, used to tag which
   * device last wrote a record — useful context for a future conflict
   * view. Not currently written by any sync process; see
   * src/lib/sync for the (not-yet-wired-up) foundation.
   */
  deviceId?: string;
  /** Timestamp of the last successful two-way sync — unused until sync is built. */
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  data: {
    careEntries: CareEntry[];
    dailyReflections: DailyReflection[];
    journalEntries: JournalEntry[];
    lifeItems: LifeItem[];
    /** Images are base64-encoded for JSON portability; absent in v1 backups. */
    lifeImages?: SerializedLifeImage[];
    people: Person[];
    /** Absent in backups made before period tracking existed. */
    periodEntries?: PeriodEntry[];
    settings: AppSettings[];
  };
}

/** JSON-safe form of LifeImage — Blob can't survive JSON.stringify. */
export interface SerializedLifeImage {
  id: string;
  base64: string;
  mimeType: string;
  createdAt: string;
}
