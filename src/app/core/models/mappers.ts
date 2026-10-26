import {
  Book,
  BookDraft,
  JournalDraft,
  JournalEntry,
  MetadataSource,
  Profile,
  Quote,
  QuoteDraft,
  ReadingGoal,
  ReadingStatus,
  ThemePreference,
  WishPriority,
} from './models';

// ---------------------------------------------------------------------------
// Row shapes returned by PostgREST (snake_case)
// ---------------------------------------------------------------------------

export interface BookRow {
  id: string;
  user_id: string;
  title: string;
  authors: string[];
  summary: string | null;
  summary_source: MetadataSource | null;
  genres: string[];
  cover_url: string | null;
  isbn: string | null;
  publisher: string | null;
  published_year: number | null;
  page_count: number | null;
  source: MetadataSource;
  external_id: string | null;
  status: ReadingStatus;
  current_page: number;
  rating: number | string | null;
  review: string | null;
  notes: string | null;
  why_it_matters: string | null;
  started_on: string | null;
  finished_on: string | null;
  is_favorite: boolean;
  wish_reason: string | null;
  wish_priority: number | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface QuoteRow {
  id: string;
  user_id: string;
  book_id: string;
  body: string;
  page: number | null;
  note: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface JournalRow {
  id: string;
  user_id: string;
  book_id: string | null;
  entry_date: string;
  title: string | null;
  body: string;
  quote: string | null;
  quote_page: number | null;
  tags: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface GoalRow {
  id: string;
  user_id: string;
  year: number;
  target_books: number | null;
  book_of_year_id: string | null;
  book_of_year_note: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  theme: ThemePreference;
  version: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row → model
// ---------------------------------------------------------------------------

const toNumberOrNull = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

export const bookFromRow = (r: BookRow): Book => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  authors: r.authors ?? [],
  summary: r.summary,
  summarySource: r.summary_source,
  genres: r.genres ?? [],
  coverUrl: r.cover_url,
  isbn: r.isbn,
  publisher: r.publisher,
  publishedYear: r.published_year,
  pageCount: r.page_count,
  source: r.source,
  externalId: r.external_id,
  status: r.status,
  currentPage: r.current_page ?? 0,
  rating: toNumberOrNull(r.rating),
  review: r.review,
  notes: r.notes,
  whyItMatters: r.why_it_matters,
  startedOn: r.started_on,
  finishedOn: r.finished_on,
  isFavorite: r.is_favorite,
  wishReason: r.wish_reason,
  wishPriority: (r.wish_priority as WishPriority | null) ?? null,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const quoteFromRow = (r: QuoteRow): Quote => ({
  id: r.id,
  userId: r.user_id,
  bookId: r.book_id,
  body: r.body,
  page: r.page,
  note: r.note,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const journalFromRow = (r: JournalRow): JournalEntry => ({
  id: r.id,
  userId: r.user_id,
  bookId: r.book_id,
  entryDate: r.entry_date,
  title: r.title,
  body: r.body,
  quote: r.quote,
  quotePage: r.quote_page,
  tags: r.tags ?? [],
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const goalFromRow = (r: GoalRow): ReadingGoal => ({
  id: r.id,
  userId: r.user_id,
  year: r.year,
  targetBooks: r.target_books,
  bookOfYearId: r.book_of_year_id,
  bookOfYearNote: r.book_of_year_note,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const profileFromRow = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  theme: r.theme,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ---------------------------------------------------------------------------
// Model → row (only writable columns; user_id comes from auth.uid() default)
// ---------------------------------------------------------------------------

type Writable<T> = Partial<T>;

export const bookDraftToRow = (d: Partial<BookDraft>): Writable<BookRow> => {
  const row: Writable<BookRow> = {};
  const set = <K extends keyof BookRow>(key: K, value: BookRow[K] | undefined) => {
    if (value !== undefined) row[key] = value;
  };
  set('title', d.title?.trim());
  set('authors', d.authors);
  set('summary', d.summary);
  set('summary_source', d.summarySource);
  set('genres', d.genres);
  set('cover_url', d.coverUrl);
  set('isbn', d.isbn);
  set('publisher', d.publisher);
  set('published_year', d.publishedYear);
  set('page_count', d.pageCount);
  set('source', d.source);
  set('external_id', d.externalId);
  set('status', d.status);
  set('current_page', d.currentPage);
  set('rating', d.rating);
  set('review', d.review);
  set('notes', d.notes);
  set('why_it_matters', d.whyItMatters);
  set('started_on', d.startedOn);
  set('finished_on', d.finishedOn);
  set('is_favorite', d.isFavorite);
  set('wish_reason', d.wishReason);
  set('wish_priority', d.wishPriority);
  return row;
};

export const quoteDraftToRow = (d: Partial<QuoteDraft>): Writable<QuoteRow> => {
  const row: Writable<QuoteRow> = {};
  if (d.bookId !== undefined) row.book_id = d.bookId;
  if (d.body !== undefined) row.body = d.body.trim();
  if (d.page !== undefined) row.page = d.page;
  if (d.note !== undefined) row.note = d.note;
  return row;
};

export const journalDraftToRow = (d: Partial<JournalDraft>): Writable<JournalRow> => {
  const row: Writable<JournalRow> = {};
  if (d.bookId !== undefined) row.book_id = d.bookId;
  if (d.entryDate !== undefined) row.entry_date = d.entryDate;
  if (d.title !== undefined) row.title = d.title;
  if (d.body !== undefined) row.body = d.body;
  if (d.quote !== undefined) row.quote = d.quote;
  if (d.quotePage !== undefined) row.quote_page = d.quotePage;
  if (d.tags !== undefined) row.tags = d.tags;
  return row;
};

export interface GoalDraft {
  year: number;
  targetBooks?: number | null;
  bookOfYearId?: string | null;
  bookOfYearNote?: string | null;
}

export const goalDraftToRow = (d: Partial<GoalDraft>): Writable<GoalRow> => {
  const row: Writable<GoalRow> = {};
  if (d.year !== undefined) row.year = d.year;
  if (d.targetBooks !== undefined) row.target_books = d.targetBooks;
  if (d.bookOfYearId !== undefined) row.book_of_year_id = d.bookOfYearId;
  if (d.bookOfYearNote !== undefined) row.book_of_year_note = d.bookOfYearNote;
  return row;
};
