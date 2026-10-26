import { computed, inject, Injectable } from '@angular/core';
import { bookDraftToRow, quoteDraftToRow } from '../models/mappers';
import { Book, BookDraft, Quote, QuoteDraft, ReadingStatus } from '../models/models';
import { normalizeForCompare } from '../../shared/utils/text';
import { todayISO } from '../../shared/utils/dates';
import { LibraryService } from './library.service';

const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);

@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly library = inject(LibraryService);

  readonly all = computed(() => [...this.library.books.all()].sort(byNewest));
  readonly loaded = this.library.books.loaded;
  readonly shelf = computed(() => this.all());
  readonly reading = computed(() =>
    this.all()
      .filter((b) => b.status === 'reading')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
  readonly wishlist = computed(() => this.all().filter((b) => b.status === 'want_to_read'));
  readonly completed = computed(() =>
    this.all()
      .filter((b) => b.status === 'completed')
      .sort((a, b) => (b.finishedOn ?? b.updatedAt).localeCompare(a.finishedOn ?? a.updatedAt)),
  );
  readonly favorites = computed(() => this.all().filter((b) => b.isFavorite));
  readonly genres = computed(() => {
    const counts = new Map<string, number>();
    for (const b of this.all()) for (const g of b.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    return [...counts.keys()].sort((a, b) => a.localeCompare(b));
  });

  get(id: string | null | undefined): Book | undefined {
    return this.library.books.get(id);
  }

  quotesFor(bookId: string): Quote[] {
    return this.library.quotes
      .all()
      .filter((q) => q.bookId === bookId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Books that look like the same title by the same author. */
  findPossibleDuplicates(title: string, authors: string[], ignoreId?: string): Book[] {
    // Compare main titles, so "Middlemarch: A Study of Provincial Life" matches "Middlemarch".
    const mainTitle = (value: string) => normalizeForCompare(value.split(/[:(]/)[0]);
    const t = mainTitle(title);
    if (!t) return [];
    const a = authors.map(normalizeForCompare).filter(Boolean);
    return this.all().filter((b) => {
      if (b.id === ignoreId) return false;
      if (mainTitle(b.title) !== t) return false;
      if (!a.length) return true;
      return b.authors.some((x) => a.includes(normalizeForCompare(x)));
    });
  }

  create(draft: BookDraft): Promise<Book> {
    return this.library.write(
      () => this.library.books.insert(bookDraftToRow(normalizeDraft(draft)), 'add this book'),
      'add this book',
    );
  }

  /** Full edit from the book form — refuses to overwrite a newer version. */
  save(book: Book, draft: BookDraft): Promise<Book> {
    return this.library.write(
      () =>
        this.library.books.update(book.id, bookDraftToRow(normalizeDraft(draft)), {
          expectedVersion: book.version,
        }),
      'save this book',
    );
  }

  /** Small single-purpose updates (status, page, rating, favourite). */
  patch(id: string, patch: Partial<BookDraft>, action = 'save that change'): Promise<Book> {
    return this.library.write(() => this.library.books.update(id, bookDraftToRow(patch), {}, action), action);
  }

  async remove(book: Book): Promise<void> {
    await this.library.write(() => this.library.books.remove(book.id, 'delete this book'), 'delete this book');
    // Mirror what the database already did: quotes cascade, journal entries
    // and Book of the Year are unlinked.
    this.library.quotes.removeLocalWhere((q) => q.bookId === book.id);
    this.library.journal.patchLocalWhere(
      (j) => j.bookId === book.id,
      (j) => ({ ...j, bookId: null }),
    );
    this.library.goals.patchLocalWhere(
      (g) => g.bookOfYearId === book.id,
      (g) => ({ ...g, bookOfYearId: null }),
    );
  }

  /** Builds the patch for a status change, filling sensible dates. */
  statusPatch(book: Book, status: ReadingStatus, extra: Partial<BookDraft> = {}): Partial<BookDraft> {
    const patch: Partial<BookDraft> = { status, ...extra };
    if (status === 'reading' && !book.startedOn && extra.startedOn === undefined) patch.startedOn = todayISO();
    if (status === 'completed') {
      patch.finishedOn = extra.finishedOn ?? book.finishedOn ?? todayISO();
      if (book.pageCount) patch.currentPage = book.pageCount;
    }
    if (status !== 'completed' && book.status === 'completed' && extra.finishedOn === undefined) {
      patch.finishedOn = null;
    }
    if (patch.startedOn && patch.finishedOn && patch.finishedOn < patch.startedOn) {
      patch.startedOn = patch.finishedOn;
    }
    return patch;
  }

  setStatus(book: Book, status: ReadingStatus, extra: Partial<BookDraft> = {}): Promise<Book> {
    return this.patch(book.id, this.statusPatch(book, status, extra), 'update the reading status');
  }

  updateProgress(book: Book, currentPage: number): Promise<Book> {
    const page = Math.max(0, Math.min(currentPage, book.pageCount ?? Number.MAX_SAFE_INTEGER));
    const patch: Partial<BookDraft> = { currentPage: page };
    if (book.status === 'want_to_read' || book.status === 'paused') {
      Object.assign(patch, this.statusPatch(book, 'reading'));
    }
    return this.patch(book.id, patch, 'update your progress');
  }

  toggleFavorite(book: Book): Promise<Book> {
    return this.patch(book.id, { isFavorite: !book.isFavorite }, 'update your favourites');
  }

  setRating(book: Book, rating: number | null): Promise<Book> {
    return this.patch(book.id, { rating }, 'save your rating');
  }

  addQuote(draft: QuoteDraft): Promise<Quote> {
    return this.library.write(() => this.library.quotes.insert(quoteDraftToRow(draft), 'save this quote'), 'save this quote');
  }

  updateQuote(quote: Quote, draft: Partial<QuoteDraft>): Promise<Quote> {
    return this.library.write(
      () => this.library.quotes.update(quote.id, quoteDraftToRow(draft), { expectedVersion: quote.version }, 'save this quote'),
      'save this quote',
    );
  }

  removeQuote(quote: Quote): Promise<void> {
    return this.library.write(() => this.library.quotes.remove(quote.id, 'remove this quote'), 'remove this quote');
  }
}

function normalizeDraft(draft: Partial<BookDraft>): Partial<BookDraft> {
  const d = { ...draft };
  if (d.pageCount !== undefined && d.pageCount !== null && d.currentPage !== undefined) {
    d.currentPage = Math.min(d.currentPage, d.pageCount);
  }
  return d;
}

export function progressPercent(book: Pick<Book, 'currentPage' | 'pageCount' | 'status'>): number | null {
  if (book.status === 'completed') return 100;
  if (!book.pageCount) return null;
  return Math.max(0, Math.min(100, Math.round((book.currentPage / book.pageCount) * 100)));
}
