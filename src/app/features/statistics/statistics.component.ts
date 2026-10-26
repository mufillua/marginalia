import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAward } from '@lucide/angular';
import { BooksService } from '../../core/data/books.service';
import { GoalsService } from '../../core/data/goals.service';
import { LibraryService } from '../../core/data/library.service';
import { StatsService } from '../../core/data/stats.service';
import { ToastService } from '../../core/services/toast.service';
import { BookCoverComponent } from '../../shared/components/book-cover.component';
import { VineProgressComponent } from '../../shared/components/vine-progress.component';
import { MONTH_INITIALS } from '../../shared/utils/dates';
import { authorLine, toIntOrNull } from '../../shared/utils/text';

const GOAL_PRESETS = [12, 24, 36, 50];
const numberFormat = new Intl.NumberFormat();

@Component({
  selector: 'app-statistics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, VineProgressComponent, BookCoverComponent, LucideAward],
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.scss',
})
export class StatisticsComponent {
  protected readonly library = inject(LibraryService);
  protected readonly stats = inject(StatsService);
  private readonly books = inject(BooksService);
  private readonly goals = inject(GoalsService);
  private readonly toasts = inject(ToastService);

  protected readonly presets = GOAL_PRESETS;
  protected readonly months = MONTH_INITIALS;
  protected readonly fmt = (n: number) => numberFormat.format(n);
  protected readonly authorLine = authorLine;
  protected readonly currentYear = this.stats.year;
  protected readonly currentMonth = this.stats.month;

  protected readonly year = signal(this.stats.year);
  protected readonly isCurrentYear = computed(() => this.year() === this.currentYear);
  protected readonly goal = computed(() => this.goals.forYear(this.year()));
  protected readonly completedInYear = computed(() => {
    this.books.completed();
    return this.stats.completedIn(this.year());
  });
  protected readonly pagesInYear = computed(() =>
    this.completedInYear().reduce((sum, b) => sum + (b.pageCount ?? 0), 0),
  );
  protected readonly monthly = computed(() => {
    this.books.completed();
    return this.stats.monthlyCompleted(this.year());
  });
  protected readonly monthlyMax = computed(() => Math.max(1, ...this.monthly()));
  protected readonly peakMonth = computed(() => {
    const m = this.monthly();
    const max = Math.max(...m);
    return max > 0 ? m.indexOf(max) : -1;
  });
  protected readonly goalPercent = computed(() => {
    const target = this.goal()?.targetBooks;
    return target ? Math.min(100, Math.round((this.completedInYear().length / target) * 100)) : 0;
  });
  protected readonly genreMax = computed(() => Math.max(1, ...this.stats.topGenres().map((g) => g.count)));
  protected readonly botyBook = computed(() => this.books.get(this.goal()?.bookOfYearId));

  protected readonly targetInput = signal<number | null>(null);
  protected readonly botyId = signal('');
  protected readonly botyNote = signal('');
  protected readonly savingGoal = signal(false);
  protected readonly savingBoty = signal(false);
  protected readonly showTable = signal(false);

  constructor() {
    effect(() => {
      const g = this.goal();
      untracked(() => {
        this.targetInput.set(g?.targetBooks ?? null);
        this.botyId.set(g?.bookOfYearId ?? '');
        this.botyNote.set(g?.bookOfYearNote ?? '');
      });
    });
  }

  protected chooseYear(value: string): void {
    this.year.set(Number(value));
  }

  protected async saveGoal(target: number | null = toIntOrNull(this.targetInput())): Promise<void> {
    if (target !== null && (target < 1 || target > 1000)) {
      this.toasts.info('Choose a goal between 1 and 1000 books.');
      return;
    }
    this.savingGoal.set(true);
    try {
      await this.goals.save({ year: this.year(), targetBooks: target });
      this.toasts.success(target ? `Goal set: ${target} books in ${this.year()}.` : `Goal removed for ${this.year()}.`);
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.savingGoal.set(false);
    }
  }

  protected async saveBookOfYear(): Promise<void> {
    this.savingBoty.set(true);
    try {
      const id = this.botyId() || null;
      await this.goals.save({ year: this.year(), bookOfYearId: id, bookOfYearNote: id ? this.botyNote().trim() || null : null });
      this.toasts.success(id ? `Book of ${this.year()} chosen.` : `Book of ${this.year()} cleared.`);
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.savingBoty.set(false);
    }
  }

  protected barHeight(count: number): number {
    return count === 0 ? 0 : Math.max(6, (count / this.monthlyMax()) * 100);
  }
}
