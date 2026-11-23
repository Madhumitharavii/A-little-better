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
/** 'watchlist' = want to watch (not yet seen) — kept out of everything that counts what was watched. */
export type MovieStatus = 'watched' | 'didNotFinish' | 'watchlist';

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
  /** External cover link — pasted in, or found on Open Library from the title/ISBN. */
  coverUrl?: string;
  /** ISBN (from a Goodreads import) — helps find the right cover. */
  isbn?: string;
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
  /** Shelves this book is on (e.g. custom Goodreads shelves). */
  shelves?: string[];
  /** Where the record came from — 'goodreads' when added by the Goodreads CSV import (books/goodreadsImport.ts). */
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
  /** Where this watch's review came from — Letterboxd ones can be updated from Letterboxd; app ones never are. */
  reviewFrom?: 'letterboxd' | 'app';
}

export interface MovieListEntry {
  name: string;
  position?: number;
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
  /** Where the review came from — see MovieWatchEntry.reviewFrom. */
  reviewFrom?: 'letterboxd' | 'app';
  /** True once there's more than one watch on record — kept for quick display, derived at write time. */
  rewatch?: boolean;
  tags?: string[];
  letterboxdUri?: string;
  imdbId?: string;
  tmdbId?: string;
  /** Earlier watches, oldest first — see MovieWatchEntry. */
  previousWatches?: MovieWatchEntry[];
  /** Lists this film is on (e.g. from Letterboxd), with its position in each. */
  lists?: MovieListEntry[];
  /** Set to 'letterboxd' for rows brought in via the diary CSV importer. */
  source?: 'manual' | 'letterboxd';
  /** The day "Pick for me" chose this film (YYYY-MM-DD) — one pick a day, no re-rolls. */
  pickedOn?: string;
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
  /** Can't happen this time (e.g. a festival that has passed) — kept, but out of the open list. */
  missed?: boolean;
  dateMissed?: string;
  /** Set when a completed wish is turned into an Experience entry. */
  linkedExperienceId?: string;
  /** The story of how it happened, written when it was ticked off. */
  story?: string;
  /** Set when that story was also saved as a journal entry. */
  linkedJournalId?: string;
}

export type LifeItem = BookItem | MovieItem | SeriesItem | ArtworkItem | ExperienceItem | WishItem;

/**
 * STUDY (shown on the Week page, not Life).
 *
 * Stored in the same `lifeItems` table (and synced the same way, as
 * life_items rows with their fields in `payload`) so no database change
 * was needed — but deliberately NOT part of the LifeItem union, and
 * filtered out of every Life view (see LIFE_ITEM_TYPES).
 *
 * A subject carries its topics; every study session is its own row, so
 * logging study on two devices at once can never overwrite either one.
 */
export type TopicStatus = 'notStarted' | 'learning' | 'confident';

export interface StudyTopic {
  id: string;
  name: string;
  status: TopicStatus;
}

export interface SubjectItem extends LifeItemBase {
  type: 'subject';
  icon?: string;
  /** e.g. "JLPT N5" */
  goal?: string;
  /** Local date key the goal is aimed at, e.g. "2027-06-30". */
  goalDate?: string;
  /** In display order. */
  topics: StudyTopic[];
  /**
   * Optional weekly goal (a week runs Monday–Sunday). Either or both:
   * total study time, and/or how many different days to study.
   */
  weeklyGoal?: { minutes?: number; days?: number };
}

export interface StudySessionItem extends LifeItemBase {
  type: 'studySession';
  /** Logged by the Today focus timer — those minutes are already in the care "focus" total. */
  fromFocus?: boolean;
  subjectId: string;
  topicId?: string;
  /** Local date key of the session, e.g. "2026-11-21". */
  date: string;
  minutes: number;
}

export type StudyItem = SubjectItem | StudySessionItem;

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
  /** Set once this image has been uploaded to Supabase Storage — prevents re-uploading on every sync. */
  remoteUploadedAt?: string;
}

/**
 * A record that something was hard-deleted locally, kept only until
 * the next successful sync tells Supabase about it (so other devices
 * learn about the deletion instead of keeping — or re-downloading —
 * their copy). Only written when Supabase is configured; see
 * src/lib/sync/syncEngine.ts pushTombstones.
 */
/**
 * A tap on a Today "mindful redirect" button (I'm bored / I'm
 * scrolling). Kept ONLY on this device — never synced — so the advisor
 * can notice patterns like a lot of doom-scrolling this week.
 */
export interface ToolEvent {
  id: string;
  tool: 'bored' | 'scrolling';
  at: string;
}

/**
 * A tap on "I'm bored" / "I'm scrolling", stored as a row of the synced
 * lifeItems table (like study rows) so every device sees the same taps.
 * The old local-only `toolEvents` table is only read once, to move its rows here.
 */
/**
 * A small preference that should be the same on every device (the
 * On-device AI switch, Noticed-for-You history, a running study timer),
 * stored as a row of the synced lifeItems table. If two devices ever
 * create one at the same time, the newest row wins.
 */
export interface SyncedPrefItem {
  id: string;
  type: 'pref';
  title: string;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ToolEventItem extends ToolEvent {
  type: 'toolEvent';
  title: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * A sentence embedding ("meaning fingerprint") computed by the on-device
 * AI model — kept ONLY on this device, never synced or backed up (it can
 * always be recomputed from the text). `hash` detects when the text changed.
 */
export interface EmbeddingRecord {
  /** `${source}:${sourceId}` */
  id: string;
  source: 'journal' | 'reflection' | 'life' | 'study' | 'anchor' | 'sentence';
  sourceId: string;
  hash: string;
  vector: number[];
  updatedAt: string;
}

export interface SyncTombstone {
  /** `${table}:${rowId}` — one tombstone per deleted row. */
  id: string;
  table: 'care_entries' | 'life_images';
  rowId: string;
  deletedAt: string;
}

/** Someone I want to stay connected with — see My People (Me page) and the Relationship Connection tool. */
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
  /** 'system' follows the device's light/dark setting. */
  theme: 'light' | 'dark' | 'system';
  /** Reminders are best-effort local notifications — see remindersRepository for the honest limitations. */
  nightReminderEnabled?: boolean;
  nightReminderTime?: string; // "HH:MM", 24h
  morningReminderEnabled?: boolean;
  morningReminderTime?: string; // "HH:MM", 24h
  lastNightReminderFiredDate?: string;
  lastMorningReminderFiredDate?: string;
  /**
   * A random id generated once per device/install, sent with every
   * synced row as `device_id` so the server records which device last
   * wrote it. Local-only bookkeeping — never synced as a setting.
   */
  deviceId?: string;
  /**
   * Local device clock time at which the last successful sync STARTED.
   * Used only to decide which local rows changed since then and need
   * pushing (both sides of that comparison are this device's clock).
   * Local-only bookkeeping — never synced as a setting.
   */
  lastSyncedAt?: string;
  /**
   * Per-table pull cursors: the newest server-assigned `synced_at`
   * this device has pulled for each remote table. Pulls compare
   * against the SERVER's clock only, so a device whose clock is off
   * can never skip another device's changes. Local-only bookkeeping —
   * never synced as a setting.
   */
  syncCursors?: Partial<Record<string, string>>;
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
