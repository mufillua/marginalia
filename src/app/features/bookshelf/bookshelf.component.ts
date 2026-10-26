import { ChangeDetectionStrategy, Component, computed, inject, Injectable, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideHeart, LucideLayoutGrid, LucideList, LucideSearch, LucideX } from '@lucide/angular';
import { BooksService } from '../../core/data/books.service';
import { LibraryService } from '../../core/data/library.service';
import { Book, READING_STATUSES, ReadingStatus, STATUS_LABELS } from '../../core/models/models';
import { BookCardComponent } from '../../shared/components/book-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

type SortKey = 'added' | 'added-old' | 'title' | 'author' | 'rating' | 'finished';
type RatingFilter = 'any' | '5' | '4' | '3' | 'unrated';
type ViewMode = 'grid' | 'list';

const VIEW_KEY = 'marginalia-shelf-view';

/** Keeps shelf filters while she visits a book and comes back. */
@Injectable({ providedIn: 'root' })
class ShelfState {
  readonly query = signal('');
  readonly genre = signal('');
  readonly status = signal<ReadingStatus | ''>('');
  readonly rating = signal<RatingFilter>('any');
  readonly favoritesOnly = signal(false);
  readonly sort = signal<SortKey>('added');
  readonly view = signal<ViewMode>(readView());

  setView(v: ViewMode): void {
    this.view.set(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* preference just won't persist */
    }
  }
}

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const sortTitle = (t: string) => t.replace(/^(the|a|an)\s+/i, '');
const sortAuthor = (b: Book) => {
  const first = b.authors[0] ?? '';
  const parts = first.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}` : first;
};

@Component({
  selector: 'app-bookshelf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BookCardComponent, EmptyStateComponent, LucideSearch, LucideX, LucideLayoutGrid, LucideList, LucideHeart],
  templateUrl: './bookshelf.component.html',
  styleUrl: './bookshelf.component.scss',
})
export class BookshelfComponent {
  protected readonly library = inject(LibraryService);
  private readonly books = inject(BooksService);
  protected readonly state = inject(ShelfState);

  protected readonly statuses = READING_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly genres = this.books.genres;
  protected readonly total = computed(() => this.books.all().length);

  protected readonly filtersActive = computed(
    () =>
      !!this.state.query().trim() ||
      !!this.state.genre() ||
      !!this.state.status() ||
      this.state.rating() !== 'any' ||
      this.state.favoritesOnly(),
  );

  protected readonly visible = computed(() => {
    const q = this.state.query().trim().toLowerCase();
    const genre = this.state.genre().toLowerCase();
    const status = this.state.status();
    const rating = this.state.rating();
    const favs = this.state.favoritesOnly();

    const list = this.books.all().filter((b) => {
      if (status && b.status !== status) return false;
      if (favs && !b.isFavorite) return false;
      if (genre && !b.genres.some((g) => g.toLowerCase() === genre)) return false;
      if (rating === 'unrated' && b.rating !== null) return false;
      if (rating !== 'any' && rating !== 'unrated' && (b.rating ?? 0) < Number(rating)) return false;
      if (q && !b.title.toLowerCase().includes(q) && !b.authors.some((a) => a.toLowerCase().includes(q))) return false;
      return true;
    });

    const sorted = [...list];
    switch (this.state.sort()) {
      case 'added':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'added-old':
        sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case 'title':
        sorted.sort((a, b) => collator.compare(sortTitle(a.title), sortTitle(b.title)));
        break;
      case 'author':
        sorted.sort((a, b) => collator.compare(sortAuthor(a), sortAuthor(b)) || collator.compare(a.title, b.title));
        break;
      case 'rating':
        sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || collator.compare(a.title, b.title));
        break;
      case 'finished':
        sorted.sort((a, b) => (b.finishedOn ?? '').localeCompare(a.finishedOn ?? '') || b.createdAt.localeCompare(a.createdAt));
        break;
    }
    return sorted;
  });

  protected clearFilters(): void {
    this.state.query.set('');
    this.state.genre.set('');
    this.state.status.set('');
    this.state.rating.set('any');
    this.state.favoritesOnly.set(false);
  }
}
