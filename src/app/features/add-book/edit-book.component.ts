import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';
import { BooksService } from '../../core/data/books.service';
import { LibraryService } from '../../core/data/library.service';
import { BookDraft } from '../../core/models/models';
import { AppError } from '../../core/services/app-error';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { authorLine } from '../../shared/utils/text';
import { BookFormComponent, BookFormValue, QuoteEdit } from './book-form.component';

@Component({
  selector: 'app-edit-book',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BookFormComponent, EmptyStateComponent, LucideArrowLeft],
  template: `
    <div class="page">
      @if (book(); as b) {
        <div class="page-head">
          <div>
            <a [routerLink]="['/book', b.id]" class="back"><svg lucideArrowLeft [size]="15"></svg> Back to the book</a>
            <h1>Edit <em>{{ b.title }}</em></h1>
          </div>
        </div>
        <app-book-form
          [initial]="initial()"
          [initialQuotes]="initialQuotes()"
          [busy]="saving()"
          submitLabel="Save changes"
          (saved)="save($event)"
          (cancelled)="leave()"
        />
      } @else if (library.loadState() === 'loading') {
        <div class="skeleton" style="height: 48px; width: 50%"></div>
      } @else {
        <app-empty-state heading="This book isn’t on your shelf" message="It may have been deleted on another device.">
          <a routerLink="/shelf" class="btn btn-primary">Go to my books</a>
        </app-empty-state>
      }
    </div>
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: var(--s-3);
      font-size: var(--step--1);
    }
    h1 em {
      font-style: italic;
    }
  `,
})
export class EditBookComponent {
  protected readonly library = inject(LibraryService);
  private readonly books = inject(BooksService);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly book = computed(() => this.books.get(this.id()));
  /**
   * Snapshot of the book when editing began. Live sync keeps updating book(),
   * but the form keeps her edits; the version tells the database which
   * state she was editing so a newer change elsewhere is never overwritten.
   */
  private readonly snapshot = signal<{ version: number; draft: Partial<BookDraft>; quotes: QuoteEdit[] } | null>(null);
  protected readonly initial = computed(() => this.snapshot()?.draft ?? {});
  protected readonly initialQuotes = computed(() => this.snapshot()?.quotes ?? []);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const b = this.book();
      if (!b || untracked(this.snapshot)) return;
      untracked(() =>
        this.snapshot.set({
          version: b.version,
          draft: { ...b },
          quotes: this.books.quotesFor(b.id).map((q) => ({ id: q.id, body: q.body, page: q.page })),
        }),
      );
    });
  }

  protected async save(value: BookFormValue): Promise<void> {
    const current = this.book();
    if (!current) return;
    // Different title/author now matching another book on the shelf?
    const dupes = this.books.findPossibleDuplicates(value.draft.title, value.draft.authors, current.id);
    if (dupes.length && (value.draft.title !== current.title || value.draft.authors.join() !== current.authors.join())) {
      const ok = await this.dialogs.confirm({
        title: 'This matches another book',
        message: `You also have “${dupes[0].title}” by ${authorLine(dupes[0].authors)}. Save this one anyway?`,
        confirmLabel: 'Save anyway',
      });
      if (!ok) return;
    }

    this.saving.set(true);
    try {
      // Use the version she started editing from, so a newer edit elsewhere isn't overwritten.
      await this.books.save({ ...current, version: this.snapshot()?.version ?? current.version }, value.draft);
      await this.syncQuotes(current.id, value.quotes);
      this.toasts.success('Changes saved.');
      await this.router.navigate(['/book', current.id]);
    } catch (error) {
      if (error instanceof AppError && error.kind === 'conflict') {
        // Reload the form from the newer version that was just fetched.
        const latest = this.book();
        this.snapshot.set(
          latest
            ? {
                version: latest.version,
                draft: { ...latest },
                quotes: this.books.quotesFor(latest.id).map((q) => ({ id: q.id, body: q.body, page: q.page })),
              }
            : null,
        );
      }
      this.toasts.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  private async syncQuotes(bookId: string, edited: QuoteEdit[]): Promise<void> {
    const existing = this.books.quotesFor(bookId);
    const keepIds = new Set(edited.filter((q) => q.id).map((q) => q.id));
    for (const q of existing) if (!keepIds.has(q.id)) await this.books.removeQuote(q);
    for (const q of edited) {
      if (!q.id) {
        await this.books.addQuote({ bookId, body: q.body, page: q.page, note: null });
        continue;
      }
      const before = existing.find((x) => x.id === q.id);
      if (before && (before.body !== q.body || before.page !== q.page)) {
        await this.books.updateQuote(before, { body: q.body, page: q.page });
      }
    }
  }

  protected leave(): void {
    void this.router.navigate(['/book', this.id()]);
  }
}
