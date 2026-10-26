import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideBookOpen, LucidePencil, LucidePenLine, LucideSearch, LucideTrash } from '@lucide/angular';
import { BooksService } from '../../core/data/books.service';
import { LibraryService } from '../../core/data/library.service';
import { Book, PRIORITY_LABELS, WishPriority } from '../../core/models/models';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { BookCoverComponent } from '../../shared/components/book-cover.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { formatShortDate } from '../../shared/utils/dates';
import { authorLine } from '../../shared/utils/text';

type WishSort = 'added' | 'priority' | 'title' | 'author';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

@Component({
  selector: 'app-wishlist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BookCoverComponent, EmptyStateComponent, LucideBookOpen, LucidePencil, LucideTrash, LucideSearch, LucidePenLine],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>To read</h1>
          <p class="lede">
            @if (books.wishlist().length) {
              {{ books.wishlist().length }} {{ books.wishlist().length === 1 ? 'book is' : 'books are' }} waiting for you.
            } @else {
              Books you’re looking forward to.
            }
          </p>
        </div>
        <div class="head-actions">
          <a routerLink="/add" [queryParams]="{ status: 'want_to_read' }" class="btn btn-primary"><svg lucideSearch [size]="17"></svg> Find a book</a>
          <a routerLink="/add" [queryParams]="{ status: 'want_to_read', mode: 'manual' }" class="btn"><svg lucidePenLine [size]="17"></svg> Add by hand</a>
        </div>
      </div>

      @if (library.loadState() === 'loading' || library.loadState() === 'idle') {
        <div class="skeleton" style="height: 120px; max-width: 820px"></div>
      } @else if (!books.wishlist().length) {
        <app-empty-state heading="Nothing waiting yet" message="Save books you hear about, so the next one is always ready. They won’t count as read until you finish them.">
          <a routerLink="/add" [queryParams]="{ status: 'want_to_read' }" class="btn btn-primary">Find a book</a>
        </app-empty-state>
      } @else {
        <div class="sort">
          <label for="w-sort">Sort by</label>
          <select id="w-sort" class="select" [value]="sort()" (change)="sort.set($any(ws.value))" #ws>
            <option value="added">Recently added</option>
            <option value="priority" [selected]="sort() === 'priority'">How soon</option>
            <option value="title" [selected]="sort() === 'title'">Title</option>
            <option value="author" [selected]="sort() === 'author'">Author</option>
          </select>
        </div>
        <ol class="list">
          @for (b of sorted(); track b.id) {
            <li class="item">
              <a [routerLink]="['/book', b.id]" class="cover" tabindex="-1" aria-hidden="true">
                <app-book-cover [title]="b.title" [authors]="b.authors" [coverUrl]="b.coverUrl" [decorative]="true" />
              </a>
              <div class="body">
                <div class="title-row">
                  <h2><a [routerLink]="['/book', b.id]">{{ b.title }}</a></h2>
                  @if (b.wishPriority) {
                    <span class="priority" [class]="'priority p' + b.wishPriority">{{ priorityLabel(b.wishPriority) }}</span>
                  }
                </div>
                <p class="by">{{ authorLine(b.authors) }}</p>
                @if (b.wishReason) {
                  <p class="reason">{{ b.wishReason }}</p>
                }
                <p class="added">Added {{ formatShortDate(b.createdAt) }}</p>
                <div class="actions">
                  <button type="button" class="btn btn-sm btn-primary" (click)="start(b)" [disabled]="busy() === b.id">
                    <svg lucideBookOpen [size]="15"></svg> Start reading
                  </button>
                  <a [routerLink]="['/book', b.id, 'edit']" class="btn btn-sm btn-quiet"><svg lucidePencil [size]="14"></svg> Edit</a>
                  <button type="button" class="btn btn-sm btn-quiet danger" (click)="remove(b)" [disabled]="busy() === b.id">
                    <svg lucideTrash [size]="14"></svg> Remove
                  </button>
                </div>
              </div>
            </li>
          }
        </ol>
      }
    </div>
  `,
  styles: `
    .lede {
      margin-top: var(--s-2);
    }
    .head-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--s-2);
    }
    .sort {
      display: flex;
      align-items: center;
      gap: var(--s-3);
      margin-bottom: var(--s-4);
    }
    .sort label {
      font-size: var(--step--1);
      color: var(--ink-soft);
    }
    .sort .select {
      width: auto;
      min-height: 38px;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-width: 860px;
    }
    .item {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: var(--s-5);
      padding: var(--s-5) 0;
      border-top: 1px solid var(--rule);
      animation: rise-in 300ms var(--ease) both;
    }
    .cover {
      display: block;
    }
    .body {
      display: grid;
      gap: 4px;
      align-content: start;
      min-width: 0;
    }
    .title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--s-2) var(--s-3);
    }
    h2 {
      font-size: var(--step-2);
      font-weight: 420;
    }
    h2 a {
      color: var(--ink);
      text-decoration: none;
    }
    h2 a:hover {
      text-decoration: underline;
      text-decoration-color: var(--rose);
    }
    .priority {
      font-size: var(--step--1);
      padding: 1px 10px;
      border-radius: 999px;
      border: 1px solid var(--rule-strong);
      color: var(--ink-soft);
    }
    .priority.p1 {
      background: var(--rose-soft);
      border-color: var(--rose);
      color: var(--rose-ink);
    }
    .by {
      color: var(--ink-soft);
    }
    .reason {
      margin-top: var(--s-2);
      font-family: var(--serif);
      font-style: italic;
      max-width: 60ch;
    }
    .added {
      font-size: var(--step--1);
      color: var(--ink-faint);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: var(--s-3);
    }
    .danger {
      color: var(--danger);
    }
    @media (max-width: 560px) {
      .item {
        grid-template-columns: 72px minmax(0, 1fr);
        gap: var(--s-4);
      }
      .head-actions {
        width: 100%;
      }
      .head-actions .btn {
        flex: 1;
      }
    }
  `,
})
export class WishlistComponent {
  protected readonly library = inject(LibraryService);
  protected readonly books = inject(BooksService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly sort = signal<WishSort>('added');
  protected readonly busy = signal<string | null>(null);
  protected readonly authorLine = authorLine;
  protected readonly formatShortDate = formatShortDate;

  protected readonly sorted = computed(() => {
    const list = [...this.books.wishlist()];
    switch (this.sort()) {
      case 'priority':
        return list.sort((a, b) => (a.wishPriority ?? 9) - (b.wishPriority ?? 9) || b.createdAt.localeCompare(a.createdAt));
      case 'title':
        return list.sort((a, b) => collator.compare(a.title, b.title));
      case 'author':
        return list.sort((a, b) => collator.compare(a.authors[0] ?? '', b.authors[0] ?? ''));
      default:
        return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  });

  protected priorityLabel(p: WishPriority): string {
    return PRIORITY_LABELS[p];
  }

  protected async start(book: Book): Promise<void> {
    this.busy.set(book.id);
    try {
      await this.books.setStatus(book, 'reading');
      this.toasts.success(`Started “${book.title}”. It’s on your nightstand now.`, {
        label: 'Open',
        run: () => void this.router.navigate(['/book', book.id]),
      });
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(null);
    }
  }

  protected async remove(book: Book): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: `Remove “${book.title}”?`,
      message: 'It will be taken off your to-read list on all your devices.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(book.id);
    try {
      await this.books.remove(book);
      this.toasts.success(`Removed “${book.title}” from your list.`);
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.busy.set(null);
    }
  }
}
