import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideAward,
  LucideHeart,
  LucidePencil,
  LucidePlus,
  LucideQuote,
  LucideTrash,
} from '@lucide/angular';
import { BooksService, progressPercent } from '../../core/data/books.service';
import { GoalsService } from '../../core/data/goals.service';
import { JournalService } from '../../core/data/journal.service';
import { LibraryService } from '../../core/data/library.service';
import { Book, Quote, READING_STATUSES, ReadingStatus, SOURCE_LABELS, STATUS_LABELS } from '../../core/models/models';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { BookCoverComponent } from '../../shared/components/book-cover.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StarRatingComponent } from '../../shared/components/star-rating.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { VineProgressComponent } from '../../shared/components/vine-progress.component';
import { formatLongDate, formatShortDate } from '../../shared/utils/dates';
import { authorLine, toIntOrNull } from '../../shared/utils/text';

@Component({
  selector: 'app-book-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    BookCoverComponent,
    StarRatingComponent,
    StatusBadgeComponent,
    VineProgressComponent,
    EmptyStateComponent,
    LucideArrowLeft,
    LucideHeart,
    LucidePencil,
    LucideTrash,
    LucidePlus,
    LucideQuote,
    LucideAward,
  ],
  templateUrl: './book-details.component.html',
  styleUrl: './book-details.component.scss',
})
export class BookDetailsComponent {
  protected readonly library = inject(LibraryService);
  private readonly books = inject(BooksService);
  private readonly journal = inject(JournalService);
  private readonly goals = inject(GoalsService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly statuses = READING_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly formatLongDate = formatLongDate;
  protected readonly formatShortDate = formatShortDate;

  protected readonly book = computed(() => this.books.get(this.id()));
  protected readonly author = computed(() => authorLine(this.book()?.authors ?? []));
  protected readonly quotes = computed(() => {
    this.library.quotes.all();
    return this.books.quotesFor(this.id());
  });
  protected readonly entries = computed(() => this.journal.forBook(this.id()));
  protected readonly percent = computed(() => {
    const b = this.book();
    return b ? progressPercent(b) : null;
  });
  protected readonly summarySourceLabel = computed(() => {
    const s = this.book()?.summarySource;
    if (!s) return '';
    return s === 'manual' ? 'In your words' : `From ${SOURCE_LABELS[s]}`;
  });
  protected readonly bookOfYear = computed(() => this.goals.all().find((g) => g.bookOfYearId === this.id())?.year ?? null);
  protected readonly facts = computed(() => {
    const b = this.book();
    if (!b) return [];
    const out: { label: string; value: string }[] = [];
    if (b.publisher) out.push({ label: 'Publisher', value: b.publisher });
    if (b.publishedYear) out.push({ label: 'Published', value: String(b.publishedYear) });
    if (b.pageCount) out.push({ label: 'Pages', value: String(b.pageCount) });
    if (b.isbn) out.push({ label: 'ISBN', value: b.isbn });
    return out;
  });

  protected readonly busy = signal<string | null>(null);
  protected readonly pageInput = signal<number | null>(null);
  protected readonly lastPagePrompt = signal(false);
  protected readonly statusFlash = signal(false);
  protected readonly newQuote = signal('');
  protected readonly newQuotePage = signal<number | null>(null);
  protected readonly addingQuote = signal(false);

  constructor() {
    effect(() => {
      const b = this.book();
      this.pageInput.set(b && b.currentPage ? b.currentPage : null);
      if (b) document.title = `${b.title} · Marginalia`;
    });
  }

  protected async changeStatus(book: Book, status: ReadingStatus, select?: HTMLSelectElement): Promise<void> {
    if (status === book.status) return;
    let extra = {};
    if (status === 'completed') {
      const result = await this.dialogs.askFinished({ title: book.title, startedOn: book.startedOn, rating: book.rating });
      if (!result) {
        if (select) select.value = book.status;
        return;
      }
      extra = { finishedOn: result.finishedOn, rating: result.rating };
    }
    this.busy.set('status');
    try {
      await this.books.setStatus(book, status, extra);
      this.lastPagePrompt.set(false);
      this.flash();
      this.toasts.success(status === 'completed' ? `Finished. “${book.title}” is on your shelf of read books.` : `Moved to ${STATUS_LABELS[status].toLowerCase()}.`);
    } catch (error) {
      if (select) select.value = book.status;
      this.toasts.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async saveProgress(book: Book): Promise<void> {
    const page = toIntOrNull(this.pageInput());
    if (page === null || page < 0) {
      this.toasts.info('Enter the page you’re on.');
      return;
    }
    if (book.pageCount && page > book.pageCount) {
      this.toasts.info(`This book has ${book.pageCount} pages. Check the page number.`);
      return;
    }
    this.busy.set('progress');
    try {
      const updated = await this.books.updateProgress(book, page);
      this.lastPagePrompt.set(!!updated.pageCount && page === updated.pageCount && updated.status !== 'completed');
      if (!this.lastPagePrompt()) this.toasts.success(`Progress saved: page ${page}.`);
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async toggleFavorite(book: Book): Promise<void> {
    this.busy.set('fav');
    try {
      const updated = await this.books.toggleFavorite(book);
      this.toasts.success(updated.isFavorite ? 'Added to your favourites.' : 'Removed from your favourites.');
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async rate(book: Book, rating: number | null): Promise<void> {
    if (rating === book.rating) return;
    this.busy.set('rating');
    try {
      await this.books.setRating(book, rating);
      this.toasts.success(rating === null ? 'Rating cleared.' : `Rated ${rating} out of 5.`);
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async addQuote(book: Book): Promise<void> {
    const body = this.newQuote().trim();
    if (!body) return;
    this.busy.set('quote');
    try {
      await this.books.addQuote({ bookId: book.id, body, page: toIntOrNull(this.newQuotePage()), note: null });
      this.newQuote.set('');
      this.newQuotePage.set(null);
      this.addingQuote.set(false);
      this.toasts.success('Quote saved.');
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async removeQuote(quote: Quote): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Remove this quote?',
      message: `“${quote.body.length > 120 ? quote.body.slice(0, 120) + '…' : quote.body}”`,
      confirmLabel: 'Remove quote',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await this.books.removeQuote(quote);
      this.toasts.success('Quote removed.');
    } catch (error) {
      this.toasts.error(error);
    }
  }

  protected async remove(book: Book): Promise<void> {
    const entryCount = this.entries().length;
    const ok = await this.dialogs.confirm({
      title: `Delete “${book.title}”?`,
      message:
        'This removes the book, its quotes, rating and progress from all your devices. ' +
        (entryCount ? `Your ${entryCount} journal ${entryCount === 1 ? 'entry stays' : 'entries stay'} in your journal.` : 'This can’t be undone.'),
      confirmLabel: 'Delete book',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set('delete');
    try {
      await this.books.remove(book);
      this.toasts.success(`Deleted “${book.title}”.`);
      await this.router.navigateByUrl('/shelf');
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  private flash(): void {
    this.statusFlash.set(true);
    setTimeout(() => this.statusFlash.set(false), 900);
  }
}
