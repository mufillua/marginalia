import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucidePencil, LucidePlus, LucideQuote, LucideTrash, LucideX } from '@lucide/angular';
import { BooksService } from '../../core/data/books.service';
import { JournalService } from '../../core/data/journal.service';
import { LibraryService } from '../../core/data/library.service';
import { JournalEntry } from '../../core/models/models';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { BookCoverComponent } from '../../shared/components/book-cover.component';
import { ChipsInputComponent } from '../../shared/components/chips-input.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { formatLongDate, formatMonthYear, todayISO } from '../../shared/utils/dates';
import { authorLine, nullIfBlank, toIntOrNull } from '../../shared/utils/text';

interface MonthGroup {
  key: string;
  label: string;
  entries: JournalEntry[];
}

@Component({
  selector: 'app-journal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, BookCoverComponent, ChipsInputComponent, EmptyStateComponent, LucidePlus, LucidePencil, LucideTrash, LucideQuote, LucideX],
  templateUrl: './journal.component.html',
  styleUrl: './journal.component.scss',
})
export class JournalComponent {
  protected readonly library = inject(LibraryService);
  protected readonly journal = inject(JournalService);
  protected readonly books = inject(BooksService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /** ?book=<id> filters to one book; ?write=1 opens a new entry for it. */
  readonly book = input<string>();
  readonly write = input<string>();

  private readonly editorTop = viewChild<ElementRef<HTMLElement>>('editorTop');
  private readonly tagsInput = viewChild(ChipsInputComponent);

  protected readonly bookFilter = signal<string>('');
  protected readonly tagFilter = signal<string>('');
  protected readonly editing = signal<JournalEntry | 'new' | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly today = todayISO();
  protected readonly formatLongDate = formatLongDate;
  protected readonly authorLine = authorLine;

  protected readonly bookOptions = computed(() =>
    [...this.books.all()].sort((a, b) => a.title.localeCompare(b.title)),
  );

  protected readonly form = this.fb.nonNullable.group({
    entryDate: [todayISO(), Validators.required],
    bookId: [''],
    title: ['', Validators.maxLength(200)],
    body: ['', [Validators.required, Validators.maxLength(50000)]],
    quote: [''],
    quotePage: this.fb.control<number | null>(null, Validators.min(1)),
    tags: this.fb.nonNullable.control<string[]>([]),
  });

  protected readonly filtered = computed(() => {
    const book = this.bookFilter();
    const tag = this.tagFilter().toLowerCase();
    return this.journal.entries().filter((e) => {
      if (book === 'none' && e.bookId) return false;
      if (book && book !== 'none' && e.bookId !== book) return false;
      if (tag && !e.tags.some((t) => t.toLowerCase() === tag)) return false;
      return true;
    });
  });

  protected readonly groups = computed<MonthGroup[]>(() => {
    const out: MonthGroup[] = [];
    for (const e of this.filtered()) {
      const key = e.entryDate.slice(0, 7);
      let group = out.find((g) => g.key === key);
      if (!group) {
        group = { key, label: formatMonthYear(e.entryDate), entries: [] };
        out.push(group);
      }
      group.entries.push(e);
    }
    return out;
  });

  constructor() {
    effect(() => {
      const book = this.book();
      const write = this.write();
      untracked(() => {
        if (book) this.bookFilter.set(book);
        if (write) this.startNew(book ?? '');
      });
    });
  }

  protected startNew(bookId = this.bookFilter() && this.bookFilter() !== 'none' ? this.bookFilter() : ''): void {
    this.submitted.set(false);
    this.form.reset({ entryDate: todayISO(), bookId, title: '', body: '', quote: '', quotePage: null, tags: [] });
    this.editing.set('new');
    this.focusEditor();
  }

  protected edit(entry: JournalEntry): void {
    this.submitted.set(false);
    this.form.reset({
      entryDate: entry.entryDate,
      bookId: entry.bookId ?? '',
      title: entry.title ?? '',
      body: entry.body,
      quote: entry.quote ?? '',
      quotePage: entry.quotePage,
      tags: entry.tags,
    });
    this.editing.set(entry);
    this.focusEditor();
  }

  protected cancel(): void {
    this.editing.set(null);
    if (this.write()) void this.router.navigate([], { queryParams: { write: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected async save(): Promise<void> {
    this.tagsInput()?.commit();
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const draft = {
      entryDate: v.entryDate,
      bookId: v.bookId || null,
      title: nullIfBlank(v.title),
      body: v.body.trim(),
      quote: nullIfBlank(v.quote),
      quotePage: nullIfBlank(v.quote) ? toIntOrNull(v.quotePage) : null,
      tags: v.tags,
    };
    const editing = this.editing();
    this.saving.set(true);
    try {
      if (editing === 'new') {
        await this.journal.create(draft);
        this.toasts.success('Entry saved to your journal.');
      } else if (editing) {
        await this.journal.save(editing, draft);
        this.toasts.success('Entry updated.');
      }
      this.editing.set(null);
      if (this.write()) void this.router.navigate([], { queryParams: { write: null }, queryParamsHandling: 'merge', replaceUrl: true });
    } catch (error) {
      // Keep the editor open with her words intact.
      this.toasts.error(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(entry: JournalEntry): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Delete this entry?',
      message: `The entry from ${formatLongDate(entry.entryDate)} will be removed from all your devices. This can’t be undone.`,
      confirmLabel: 'Delete entry',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await this.journal.remove(entry);
      if (this.editing() !== 'new' && (this.editing() as JournalEntry | null)?.id === entry.id) this.editing.set(null);
      this.toasts.success('Entry deleted.');
    } catch (error) {
      this.toasts.error(error);
    }
  }

  protected setBookFilter(value: string): void {
    this.bookFilter.set(value);
    void this.router.navigate([], { queryParams: { book: value && value !== 'none' ? value : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected toggleTag(tag: string): void {
    this.tagFilter.set(this.tagFilter().toLowerCase() === tag.toLowerCase() ? '' : tag);
  }

  protected clearFilters(): void {
    this.tagFilter.set('');
    this.setBookFilter('');
  }

  protected bookFor(entry: JournalEntry) {
    return this.books.get(entry.bookId);
  }

  protected invalid(name: 'body' | 'entryDate'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  private focusEditor(): void {
    setTimeout(() => {
      this.editorTop()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('je-body')?.focus({ preventScroll: true });
    }, 30);
  }
}
