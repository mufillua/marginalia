import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { LucideHeart, LucideImagePlus, LucidePlus, LucideTrash } from '@lucide/angular';
import {
  BookDraft,
  MetadataSource,
  PRIORITY_LABELS,
  READING_STATUSES,
  ReadingStatus,
  SOURCE_LABELS,
  STATUS_LABELS,
  WishPriority,
} from '../../core/models/models';
import { CoverUploadService } from '../../core/services/cover-upload.service';
import { ToastService } from '../../core/services/toast.service';
import { BookCoverComponent } from '../../shared/components/book-cover.component';
import { ChipsInputComponent } from '../../shared/components/chips-input.component';
import { StarRatingComponent } from '../../shared/components/star-rating.component';
import { todayISO } from '../../shared/utils/dates';
import { nullIfBlank, toIntOrNull } from '../../shared/utils/text';
import { BooksService } from '../../core/data/books.service';

export interface QuoteEdit {
  id?: string;
  body: string;
  page: number | null;
}

export interface BookFormValue {
  draft: BookDraft;
  quotes: QuoteEdit[];
}

const STATUS_HINTS: Record<ReadingStatus, string> = {
  want_to_read: 'On your to-read list',
  reading: 'On your nightstand now',
  completed: 'You turned the last page',
  paused: 'Set aside for now',
  dnf: 'Not for you, and that’s fine',
};

const httpsUrl = (c: AbstractControl): ValidationErrors | null => {
  const v = (c.value as string | null)?.trim();
  if (!v) return null;
  return /^https:\/\/\S+$/i.test(v) ? null : { https: true };
};

const yearRange = (c: AbstractControl): ValidationErrors | null => {
  const v = c.value;
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= -3000 && n <= new Date().getFullYear() + 5 ? null : { year: true };
};

const formRules = (group: AbstractControl): ValidationErrors | null => {
  const g = group as FormGroup;
  const errors: ValidationErrors = {};
  const pages = toIntOrNull(g.get('pageCount')?.value);
  const current = toIntOrNull(g.get('currentPage')?.value);
  if (pages && current && current > pages) errors['pageBeyondTotal'] = true;
  const started = g.get('startedOn')?.value as string;
  const finished = g.get('finishedOn')?.value as string;
  if (started && finished && finished < started) errors['finishBeforeStart'] = true;
  return Object.keys(errors).length ? errors : null;
};

@Component({
  selector: 'app-book-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    BookCoverComponent,
    ChipsInputComponent,
    StarRatingComponent,
    LucideImagePlus,
    LucidePlus,
    LucideTrash,
    LucideHeart,
  ],
  templateUrl: './book-form.component.html',
  styleUrl: './book-form.component.scss',
})
export class BookFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly uploads = inject(CoverUploadService);
  private readonly toasts = inject(ToastService);
  private readonly books = inject(BooksService);

  readonly initial = input<Partial<BookDraft>>({});
  readonly initialQuotes = input<QuoteEdit[]>([]);
  readonly submitLabel = input('Add to my shelf');
  readonly busy = input(false);
  readonly saved = output<BookFormValue>();
  readonly cancelled = output<void>();

  private readonly chipInputs = viewChildren(ChipsInputComponent);

  protected readonly statuses = READING_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusHints = STATUS_HINTS;
  protected readonly priorities: WishPriority[] = [1, 2, 3];
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly genreSuggestions = this.books.genres;
  protected readonly today = todayISO();

  protected readonly form = this.fb.group(
    {
      title: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(500)]),
      authors: this.fb.nonNullable.control<string[]>([], [(c) => ((c.value as string[]).length ? null : { required: true })]),
      summary: this.fb.nonNullable.control(''),
      genres: this.fb.nonNullable.control<string[]>([]),
      coverUrl: this.fb.nonNullable.control('', [httpsUrl]),
      isbn: this.fb.nonNullable.control('', [Validators.maxLength(20)]),
      publisher: this.fb.nonNullable.control('', [Validators.maxLength(300)]),
      publishedYear: this.fb.control<number | null>(null, [yearRange]),
      pageCount: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(50000)]),
      status: this.fb.nonNullable.control<ReadingStatus>('want_to_read'),
      startedOn: this.fb.nonNullable.control(''),
      finishedOn: this.fb.nonNullable.control(''),
      currentPage: this.fb.control<number | null>(null, [Validators.min(0)]),
      review: this.fb.nonNullable.control(''),
      notes: this.fb.nonNullable.control(''),
      whyItMatters: this.fb.nonNullable.control(''),
      isFavorite: this.fb.nonNullable.control(false),
      wishReason: this.fb.nonNullable.control(''),
      wishPriority: this.fb.control<WishPriority | null>(null),
      quotes: this.fb.array<FormGroup<{ id: FormControl<string | null>; body: FormControl<string>; page: FormControl<number | null> }>>([]),
    },
    { validators: formRules },
  );

  protected readonly rating = signal<number | null>(null);
  protected readonly uploading = signal(false);
  protected readonly submitted = signal(false);
  private summarySource: MetadataSource | null = null;
  private importedSummary = '';
  private source: MetadataSource = 'manual';
  private externalId: string | null = null;

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly status = computed(() => this.value().status ?? 'want_to_read');
  protected readonly previewTitle = computed(() => this.value().title?.trim() || 'Untitled');
  protected readonly previewAuthors = computed(() => this.value().authors ?? []);
  protected readonly previewCover = computed(() => {
    const url = this.value().coverUrl?.trim();
    return url && /^https:\/\//.test(url) ? url : null;
  });
  protected readonly summaryNote = computed(() => {
    const summary = this.value().summary ?? '';
    if (this.summarySource && this.summarySource !== 'manual' && summary === this.importedSummary && summary) {
      return `Description from ${SOURCE_LABELS[this.summarySource]}. Edit it freely.`;
    }
    return '';
  });

  get quotes(): FormArray {
    return this.form.controls.quotes;
  }

  constructor() {
    effect(() => {
      const initial = this.initial();
      const quotes = this.initialQuotes();
      untracked(() => this.reset(initial, quotes));
    });
  }

  private reset(d: Partial<BookDraft>, quotes: QuoteEdit[]): void {
    this.summarySource = d.summarySource ?? null;
    this.importedSummary = d.summary ?? '';
    this.source = d.source ?? 'manual';
    this.externalId = d.externalId ?? null;
    this.rating.set(d.rating ?? null);
    this.quotes.clear();
    for (const q of quotes) this.addQuote(q);
    this.form.reset({
      title: d.title ?? '',
      authors: d.authors ?? [],
      summary: d.summary ?? '',
      genres: d.genres ?? [],
      coverUrl: d.coverUrl ?? '',
      isbn: d.isbn ?? '',
      publisher: d.publisher ?? '',
      publishedYear: d.publishedYear ?? null,
      pageCount: d.pageCount ?? null,
      status: d.status ?? 'want_to_read',
      startedOn: d.startedOn ?? '',
      finishedOn: d.finishedOn ?? '',
      currentPage: d.currentPage ? d.currentPage : null,
      review: d.review ?? '',
      notes: d.notes ?? '',
      whyItMatters: d.whyItMatters ?? '',
      isFavorite: d.isFavorite ?? false,
      wishReason: d.wishReason ?? '',
      wishPriority: d.wishPriority ?? null,
    });
    this.submitted.set(false);
  }

  protected setStatus(status: ReadingStatus): void {
    this.form.controls.status.setValue(status);
    if (status === 'reading' && !this.form.controls.startedOn.value) this.form.controls.startedOn.setValue(this.today);
    if (status === 'completed' && !this.form.controls.finishedOn.value) this.form.controls.finishedOn.setValue(this.today);
  }

  protected addQuote(q: Partial<QuoteEdit> = {}): void {
    this.quotes.push(
      this.fb.group({
        id: this.fb.control<string | null>(q.id ?? null),
        body: this.fb.nonNullable.control(q.body ?? '', [Validators.maxLength(5000)]),
        page: this.fb.control<number | null>(q.page ?? null, [Validators.min(1)]),
      }),
    );
  }

  protected removeQuote(index: number): void {
    this.quotes.removeAt(index);
  }

  protected async onCoverFile(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    this.uploading.set(true);
    try {
      const url = await this.uploads.upload(file);
      this.form.controls.coverUrl.setValue(url);
      this.form.controls.coverUrl.markAsDirty();
      this.toasts.success('Cover uploaded.');
    } catch (error) {
      this.toasts.error(error, 'We couldn’t upload that cover. Try another image.');
    } finally {
      this.uploading.set(false);
    }
  }

  protected clearCover(): void {
    this.form.controls.coverUrl.setValue('');
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  protected submit(): void {
    // Commit anything typed into the chip fields but not yet confirmed.
    for (const chips of this.chipInputs()) chips.commit();
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      queueMicrotask(() => document.querySelector<HTMLElement>('app-book-form [aria-invalid="true"], app-book-form .ng-invalid.ng-touched input, app-book-form .input.ng-invalid')?.focus());
      return;
    }
    const v = this.form.getRawValue();
    const status = v.status;
    const pageCount = toIntOrNull(v.pageCount);
    let currentPage = toIntOrNull(v.currentPage) ?? 0;
    if (status === 'completed' && pageCount) currentPage = pageCount;
    const summary = nullIfBlank(v.summary);
    const summarySource: MetadataSource | null = !summary
      ? null
      : summary === this.importedSummary.trim() && this.summarySource
        ? this.summarySource
        : 'manual';

    const draft: BookDraft = {
      title: v.title.trim(),
      authors: v.authors,
      summary,
      summarySource,
      genres: v.genres,
      coverUrl: nullIfBlank(v.coverUrl),
      isbn: nullIfBlank(v.isbn)?.replace(/\s/g, '') ?? null,
      publisher: nullIfBlank(v.publisher),
      publishedYear: toIntOrNull(v.publishedYear),
      pageCount,
      source: this.source,
      externalId: this.externalId,
      status,
      currentPage,
      rating: this.rating(),
      review: nullIfBlank(v.review),
      notes: nullIfBlank(v.notes),
      whyItMatters: nullIfBlank(v.whyItMatters),
      startedOn: v.startedOn || null,
      finishedOn: status === 'completed' ? v.finishedOn || this.today : v.finishedOn || null,
      isFavorite: v.isFavorite,
      wishReason: nullIfBlank(v.wishReason),
      wishPriority: v.wishPriority,
    };
    const quotes: QuoteEdit[] = (v.quotes as { id: string | null; body: string; page: number | null }[])
      .map((q) => ({ id: q.id ?? undefined, body: q.body.trim(), page: toIntOrNull(q.page) }))
      .filter((q) => q.body);
    this.saved.emit({ draft, quotes });
  }
}
