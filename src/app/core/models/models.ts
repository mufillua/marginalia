// ---------------------------------------------------------------------------
// Domain models used throughout the app (camelCase). Row types mirror the
// Postgres tables (snake_case) and are converted in core/models/mappers.ts.
// ---------------------------------------------------------------------------

export type ReadingStatus = 'want_to_read' | 'reading' | 'completed' | 'paused' | 'dnf';

export const READING_STATUSES: readonly ReadingStatus[] = [
  'want_to_read',
  'reading',
  'completed',
  'paused',
  'dnf',
] as const;

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  want_to_read: 'Want to read',
  reading: 'Currently reading',
  completed: 'Completed',
  paused: 'Paused',
  dnf: 'Did not finish',
};

export const STATUS_SHORT_LABELS: Record<ReadingStatus, string> = {
  want_to_read: 'To read',
  reading: 'Reading',
  completed: 'Finished',
  paused: 'Paused',
  dnf: 'DNF',
};

export type MetadataSource = 'google_books' | 'open_library' | 'manual';

export const SOURCE_LABELS: Record<MetadataSource, string> = {
  google_books: 'Google Books',
  open_library: 'Open Library',
  manual: 'you',
};

export type WishPriority = 1 | 2 | 3;

export const PRIORITY_LABELS: Record<WishPriority, string> = {
  1: 'Soon',
  2: 'Someday',
  3: 'Maybe',
};

export interface Book {
  id: string;
  userId: string;
  title: string;
  authors: string[];
  summary: string | null;
  summarySource: MetadataSource | null;
  genres: string[];
  coverUrl: string | null;
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  source: MetadataSource;
  externalId: string | null;
  status: ReadingStatus;
  currentPage: number;
  rating: number | null;
  review: string | null;
  notes: string | null;
  whyItMatters: string | null;
  startedOn: string | null; // YYYY-MM-DD
  finishedOn: string | null; // YYYY-MM-DD
  isFavorite: boolean;
  wishReason: string | null;
  wishPriority: WishPriority | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Everything a person can edit about a book. */
export type BookDraft = Omit<Book, 'id' | 'userId' | 'version' | 'createdAt' | 'updatedAt'>;

export interface Quote {
  id: string;
  userId: string;
  bookId: string;
  body: string;
  page: number | null;
  note: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type QuoteDraft = Pick<Quote, 'bookId' | 'body' | 'page' | 'note'>;

export interface JournalEntry {
  id: string;
  userId: string;
  bookId: string | null;
  entryDate: string; // YYYY-MM-DD
  title: string | null;
  body: string;
  quote: string | null;
  quotePage: number | null;
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type JournalDraft = Pick<
  JournalEntry,
  'bookId' | 'entryDate' | 'title' | 'body' | 'quote' | 'quotePage' | 'tags'
>;

export interface ReadingGoal {
  id: string;
  userId: string;
  year: number;
  targetBooks: number | null;
  bookOfYearId: string | null;
  bookOfYearNote: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Profile {
  id: string;
  displayName: string | null;
  theme: ThemePreference;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** A normalized result from a book metadata API, before it becomes a Book. */
export interface BookSearchResult {
  source: Exclude<MetadataSource, 'manual'>;
  externalId: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  summary: string | null;
  genres: string[];
  coverUrl: string | null;
  thumbnailUrl: string | null;
  isbn: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
}

/** A row that carries the fields every synced table shares. */
export interface SyncedRecord {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
