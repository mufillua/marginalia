import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, OnDestroy, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideArrowLeft, LucideBookmark, LucidePenLine, LucideSearch, LucideX } from '@lucide/angular';
import { BooksService } from '../../core/data/books.service';
import { Book, BookDraft, BookSearchResult, ReadingStatus } from '../../core/models/models';
import { AppError } from '../../core/services/app-error';
import { BookSearchService, SearchSource } from '../../core/services/book-search.service';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { BookCoverComponent } from '../../shared/components/book-cover.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { todayISO } from '../../shared/utils/dates';
import { authorLine, isISBN } from '../../shared/utils/text';
import { BookFormComponent, BookFormValue } from './book-form.component';

type Mode = 'search' | 'manual';

const DEBOUNCE_MS = 450;

@Component({
  selector: 'app-add-book',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    BookFormComponent,
    BookCoverComponent,
    EmptyStateComponent,
    LucideSearch,
    LucidePenLine,
    LucideArrowLeft,
    LucideBookmark,
    LucideX,
  ],
  templateUrl: './add-book.component.html',
  styleUrl: './add-book.component.scss',
})
export class AddBookComponent implements OnDestroy {
  private readonly search = inject(BookSearchService);
  private readonly books = inject(BooksService);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  /** ?mode=manual opens the hand-entry form; ?status=want_to_read targets the to-read list. */
  readonly mode = input<string>();
  readonly status = input<string>();
  readonly q = input<string>();

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly tab = signal<Mode>('search');
  protected readonly query = signal('');
  protected readonly source = signal<SearchSource>('google_books');
  protected readonly results = signal<BookSearchResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchError = signal('');
  protected readonly fallbackNote = signal('');
  protected readonly searchedFor = signal('');
  protected readonly choosing = signal<string | null>(null);
  protected readonly quickSaving = signal<string | null>(null);

  /** When set, the form is showing (prefilled from a search result or blank). */
  protected readonly draft = signal<Partial<BookDraft> | null>(null);
  protected readonly saving = signal(false);

  protected readonly forWishlist = computed(() => this.status() === 'want_to_read');
  protected readonly defaultStatus = computed<ReadingStatus>(() => (this.forWishlist() ? 'want_to_read' : 'reading'));
  protected readonly authorLine = authorLine;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;

  constructor() {
    effect(() => {
      if (this.mode() === 'manual') this.startManual();
      const q = this.q();
      if (q) {
        this.query.set(q);
        this.runSearch(q);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.controller?.abort();
  }

  protected onQueryInput(value: string): void {
    this.query.set(value);
    if (this.timer) clearTimeout(this.timer);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      this.controller?.abort();
      this.results.set([]);
      this.searchError.set('');
      this.searching.set(false);
      this.searchedFor.set('');
      return;
    }
    this.timer = setTimeout(() => this.runSearch(trimmed), isISBN(trimmed) ? 0 : DEBOUNCE_MS);
  }

  protected submitSearch(): void {
    if (this.timer) clearTimeout(this.timer);
    const q = this.query().trim();
    if (q.length >= 2) this.runSearch(q);
  }

  protected setSource(source: SearchSource): void {
    this.source.set(source);
    const q = this.query().trim();
    if (q.length >= 2) this.runSearch(q);
  }

  protected clearQuery(): void {
    this.onQueryInput('');
    this.searchInput()?.nativeElement.focus();
  }

  private async runSearch(q: string): Promise<void> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.searching.set(true);
    this.searchError.set('');
    this.fallbackNote.set('');
    try {
      const outcome = await this.search.search(q, this.source(), controller.signal);
      if (controller.signal.aborted) return;
      this.results.set(outcome.results);
      this.searchedFor.set(q);
      if (outcome.fellBack) {
        const used = outcome.source === 'google_books' ? 'Google Books' : 'Open Library';
        this.fallbackNote.set(`${outcome.fallbackReason ?? ''} Showing results from ${used} instead.`.trim());
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      this.results.set([]);
      this.searchedFor.set(q);
      this.searchError.set(
        error instanceof AppError
          ? `${error.message} You can still add the book by hand.`
          : 'The catalogues aren’t responding right now. You can still add the book by hand.',
      );
    } finally {
      if (this.controller === controller) this.searching.set(false);
    }
  }

  protected async choose(result: BookSearchResult): Promise<void> {
    this.choosing.set(result.externalId);
    try {
      const full = await this.search.details(result);
      this.draft.set(this.draftFrom(full, this.defaultStatus()));
      this.scrollTop();
    } finally {
      this.choosing.set(null);
    }
  }

  /** One-tap save straight to the to-read list. */
  protected async saveToRead(result: BookSearchResult): Promise<void> {
    if (!result.authors.length) {
      // Author is required; let her fill it in.
      this.draft.set(this.draftFrom(result, 'want_to_read'));
      this.toasts.info('This one has no author listed. Add one, then save.');
      this.scrollTop();
      return;
    }
    this.quickSaving.set(result.externalId);
    try {
      const full = await this.search.details(result);
      const draft = this.draftFrom(full, 'want_to_read') as BookDraft;
      if (!(await this.confirmNotDuplicate(draft))) return;
      const book = await this.books.create(draft);
      this.toasts.success(`Saved “${book.title}” to your to-read list.`, {
        label: 'View',
        run: () => void this.router.navigate(['/book', book.id]),
      });
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.quickSaving.set(null);
    }
  }

  protected startManual(): void {
    this.tab.set('manual');
    this.draft.set({
      status: this.defaultStatus(),
      source: 'manual',
      startedOn: this.defaultStatus() === 'reading' ? todayISO() : null,
    });
  }

  protected backToSearch(): void {
    this.draft.set(null);
    this.tab.set('search');
    queueMicrotask(() => this.searchInput()?.nativeElement.focus());
  }

  protected async save(value: BookFormValue): Promise<void> {
    if (!(await this.confirmNotDuplicate(value.draft))) return;
    this.saving.set(true);
    let book: Book;
    try {
      book = await this.books.create(value.draft);
    } catch (error) {
      this.toasts.error(error);
      this.saving.set(false);
      return;
    }
    // Quotes go in after the book exists.
    const failedQuotes: number[] = [];
    for (const [i, q] of value.quotes.entries()) {
      try {
        await this.books.addQuote({ bookId: book.id, body: q.body, page: q.page, note: null });
      } catch {
        failedQuotes.push(i + 1);
      }
    }
    this.saving.set(false);
    if (failedQuotes.length) {
      this.toasts.error(
        new AppError('network', `“${book.title}” was added, but ${failedQuotes.length === 1 ? 'one quote' : 'some quotes'} didn’t save. Add them again from the book page.`),
      );
    } else {
      this.toasts.success(
        book.status === 'want_to_read' ? `Added “${book.title}” to your to-read list.` : `Added “${book.title}” to your shelf.`,
      );
    }
    await this.router.navigate(['/book', book.id], { state: { justAdded: true } });
  }

  protected cancel(): void {
    if (this.tab() === 'manual' && this.mode() === 'manual') {
      void this.router.navigateByUrl(this.forWishlist() ? '/to-read' : '/shelf');
      return;
    }
    this.backToSearch();
  }

  private async confirmNotDuplicate(draft: BookDraft): Promise<boolean> {
    const dupes = this.books.findPossibleDuplicates(draft.title, draft.authors);
    if (!dupes.length) return true;
    const existing = dupes[0];
    const choice = await this.dialogs.choose({
      title: 'Already on your shelf?',
      message: `You already have “${existing.title}” by ${authorLine(existing.authors)}. Add another copy anyway, for example a different edition or translation?`,
      confirmLabel: 'Add another edition',
      altLabel: 'Open the one I have',
      cancelLabel: 'Cancel',
    });
    if (choice === 'alt') void this.router.navigate(['/book', existing.id]);
    return choice === 'confirm';
  }

  private draftFrom(r: BookSearchResult, status: ReadingStatus): Partial<BookDraft> {
    return {
      title: r.subtitle && r.title.length < 60 ? `${r.title}: ${r.subtitle}` : r.title,
      authors: r.authors,
      summary: r.summary,
      summarySource: r.summary ? r.source : null,
      genres: r.genres,
      coverUrl: r.coverUrl ?? r.thumbnailUrl,
      isbn: r.isbn,
      publisher: r.publisher,
      publishedYear: r.publishedYear,
      pageCount: r.pageCount,
      source: r.source,
      externalId: r.externalId,
      status,
      startedOn: status === 'reading' ? todayISO() : null,
    };
  }

  private scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
