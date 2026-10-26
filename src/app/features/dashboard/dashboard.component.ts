import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAward, LucideRefreshCw } from '@lucide/angular';
import { BooksService, progressPercent } from '../../core/data/books.service';
import { GoalsService } from '../../core/data/goals.service';
import { LibraryService } from '../../core/data/library.service';
import { ProfileService } from '../../core/data/profile.service';
import { StatsService } from '../../core/data/stats.service';
import { Book } from '../../core/models/models';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { BookCoverComponent } from '../../shared/components/book-cover.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StarRatingComponent } from '../../shared/components/star-rating.component';
import { VineProgressComponent } from '../../shared/components/vine-progress.component';
import { formatWeekday, greetingFor } from '../../shared/utils/dates';
import { MARGINALIA_LINES, pickForToday, PUBLIC_DOMAIN_QUOTES } from '../../shared/utils/quotes';
import { authorLine, toIntOrNull } from '../../shared/utils/text';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    BookCoverComponent,
    VineProgressComponent,
    StarRatingComponent,
    EmptyStateComponent,
    LucideRefreshCw,
    LucideAward,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly library = inject(LibraryService);
  protected readonly books = inject(BooksService);
  protected readonly stats = inject(StatsService);
  private readonly goals = inject(GoalsService);
  private readonly profile = inject(ProfileService);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  private readonly now = new Date();
  protected readonly today = formatWeekday(this.now);
  protected readonly greeting = computed(() => {
    const name = this.profile.displayName();
    return name ? `${greetingFor(this.now)}, ${name}.` : `${greetingFor(this.now)}.`;
  });
  protected readonly line = pickForToday(MARGINALIA_LINES);
  private readonly quoteIndex = signal(PUBLIC_DOMAIN_QUOTES.indexOf(pickForToday(PUBLIC_DOMAIN_QUOTES)));
  protected readonly quote = computed(() => PUBLIC_DOMAIN_QUOTES[this.quoteIndex()]);
  protected readonly monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(this.now);
  protected readonly year = this.now.getFullYear();

  protected readonly featured = computed(() => this.books.reading()[0] ?? null);
  protected readonly alsoReading = computed(() => this.books.reading().slice(1, 5));
  protected readonly upNext = computed(() =>
    [...this.books.wishlist()].sort((a, b) => (a.wishPriority ?? 9) - (b.wishPriority ?? 9)).slice(0, 4),
  );
  protected readonly recentlyAdded = computed(() => this.books.all().filter((b) => b.status !== 'want_to_read').slice(0, 6));
  protected readonly recentlyFinished = computed(() => this.books.completed().slice(0, 6));
  protected readonly favorites = computed(() => this.books.favorites().slice(0, 6));
  protected readonly bookOfYear = computed(() => {
    const goal = this.goals.current();
    const book = this.books.get(goal?.bookOfYearId);
    return book ? { book, note: goal?.bookOfYearNote ?? null } : null;
  });
  protected readonly percent = computed(() => {
    const b = this.featured();
    return b ? progressPercent(b) : null;
  });
  protected readonly monthSentence = computed(() => {
    const finished = this.stats.completedThisMonth();
    const entries = this.stats.journalThisMonth();
    const reading = this.books.reading().length;
    const parts: string[] = [];
    parts.push(finished ? `finished ${finished === 1 ? 'one book' : `${finished} books`}` : 'not finished a book yet');
    if (entries) parts.push(`written ${entries === 1 ? 'one journal entry' : `${entries} journal entries`}`);
    const head = `In ${this.monthName} you’ve ${parts.join(' and ')}.`;
    const tail = reading ? ` ${reading === 1 ? 'One book is' : `${reading} books are`} open on your nightstand.` : '';
    return head + tail;
  });

  protected readonly pageInput = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly authorLine = authorLine;

  constructor() {
    effect(() => {
      const b = this.featured();
      this.pageInput.set(b?.currentPage || null);
    });
  }

  protected nextQuote(): void {
    this.quoteIndex.update((i) => (i + 1) % PUBLIC_DOMAIN_QUOTES.length);
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
    this.saving.set(true);
    try {
      const updated = await this.books.updateProgress(book, page);
      if (updated.pageCount && page === updated.pageCount) {
        const result = await this.dialogs.askFinished({ title: book.title, startedOn: book.startedOn, rating: book.rating });
        if (result) {
          await this.books.setStatus(updated, 'completed', { finishedOn: result.finishedOn, rating: result.rating });
          this.toasts.success(`Finished. “${book.title}” is on your shelf of read books.`);
          return;
        }
      }
      this.toasts.success(`Progress saved: page ${page}.`);
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async startReading(book: Book): Promise<void> {
    try {
      await this.books.setStatus(book, 'reading');
      this.toasts.success(`Started “${book.title}”. Enjoy.`);
    } catch (error) {
      this.toasts.error(error);
    }
  }
}
