import Dexie, { type Table } from 'dexie';
import type {
  CareEntry,
  DailyReflection,
  JournalEntry,
  LifeItem,
  LifeImage,
  Person,
  PeriodEntry,
  AppSettings,
} from './schema';

/**
 * The single local IndexedDB database. This is the app's source of
 * truth on-device — the UI reads it via live queries (see
 * dexie-react-hooks' useLiveQuery in the feature hooks) rather than
 * keeping a parallel copy in React state.
 *
 * UI components should never import this file directly — go through
 * `src/db/repositories/*` instead, so a future sync stage can hook
 * into writes in one place.
 */
class AppDatabase extends Dexie {
  careEntries!: Table<CareEntry, string>;
  dailyReflections!: Table<DailyReflection, string>;
  journalEntries!: Table<JournalEntry, string>;
  lifeItems!: Table<LifeItem, string>;
  lifeImages!: Table<LifeImage, string>;
  people!: Table<Person, string>;
  periodEntries!: Table<PeriodEntry, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('a-little-better');

    this.version(1).stores({
      careEntries: 'id, date, itemKey, [date+itemKey], updatedAt',
      dailyReflections: 'id, date, updatedAt',
      journalEntries: 'id, date, sourceTool, updatedAt, deletedAt',
      lifeItems: 'id, type, status, updatedAt, deletedAt',
      people: 'id, name, updatedAt, deletedAt',
      settings: 'id, updatedAt',
    });

    // LIFE (Stage 2): purely additive — a new lifeImages store for
    // artwork/experience photos and optional covers, plus wider
    // indexes on lifeItems. No existing store/index/record touched.
    this.version(2).stores({
      careEntries: 'id, date, itemKey, [date+itemKey], updatedAt',
      dailyReflections: 'id, date, updatedAt',
      journalEntries: 'id, date, sourceTool, updatedAt, deletedAt',
      lifeItems: 'id, type, status, favorite, updatedAt, deletedAt, [type+deletedAt]',
      lifeImages: 'id, createdAt',
      people: 'id, name, updatedAt, deletedAt',
      settings: 'id, updatedAt',
    });

    // Week/Period/Reminders/Series/Wishlist pass: another purely
    // additive bump — a new periodEntries store for cycle tracking.
    // Every existing store and index is repeated unchanged, so
    // upgrading in place loses nothing. 'series' and 'wish' are new
    // values for the existing lifeItems.type index, not new stores,
    // so no index change is needed for them.
    this.version(3).stores({
      careEntries: 'id, date, itemKey, [date+itemKey], updatedAt',
      dailyReflections: 'id, date, updatedAt',
      journalEntries: 'id, date, sourceTool, updatedAt, deletedAt',
      lifeItems: 'id, type, status, favorite, updatedAt, deletedAt, [type+deletedAt]',
      lifeImages: 'id, createdAt',
      people: 'id, name, updatedAt, deletedAt',
      periodEntries: 'id, startDate, updatedAt, deletedAt',
      settings: 'id, updatedAt',
    });
  }
}

export const db = new AppDatabase();
