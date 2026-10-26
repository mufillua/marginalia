import { computed, inject, Injectable } from '@angular/core';
import { Book } from '../models/models';
import { parseISODate } from '../../shared/utils/dates';
import { BooksService } from './books.service';
import { GoalsService } from './goals.service';
import { JournalService } from './journal.service';
import { LibraryService } from './library.service';

export interface GenreCount {
  genre: string;
  count: number;
}

/** Every number here is derived from the reader's saved books and journal. */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly books = inject(BooksService);
  private readonly journal = inject(JournalService);
  private readonly goals = inject(GoalsService);
  private readonly library = inject(LibraryService);

  readonly now = new Date();
  readonly year = this.now.getFullYear();
  readonly month = this.now.getMonth();

  readonly counts = computed(() => {
    const all = this.books.all();
    const by = (s: Book['status']) => all.filter((b) => b.status === s).length;
    return {
      total: all.length,
      onShelf: all.filter((b) => b.status !== 'want_to_read').length,
      completed: by('completed'),
      reading: by('reading'),
      wishlist: by('want_to_read'),
      paused: by('paused'),
      dnf: by('dnf'),
      favorites: all.filter((b) => b.isFavorite).length,
      journalEntries: this.journal.entries().length,
      quotes: this.library.quotes.all().length,
    };
  });

  readonly completedThisYear = computed(() => this.completedIn(this.year).length);
  readonly completedThisMonth = computed(
    () =>
      this.completedIn(this.year).filter((b) => parseISODate(b.finishedOn)!.getMonth() === this.month).length,
  );
  readonly journalThisMonth = computed(
    () =>
      this.journal.entries().filter((e) => {
        const d = parseISODate(e.entryDate);
        return d && d.getFullYear() === this.year && d.getMonth() === this.month;
      }).length,
  );

  readonly pages = computed(() => {
    let pages = 0;
    let booksWithData = 0;
    for (const b of this.books.all()) {
      if (b.status === 'want_to_read') continue;
      if (b.status === 'completed' && b.pageCount) {
        pages += b.pageCount;
        booksWithData++;
      } else if (b.currentPage > 0) {
        pages += b.currentPage;
        booksWithData++;
      }
    }
    return { pages, booksWithData };
  });

  readonly averageRating = computed(() => {
    const rated = this.books.all().filter((b) => b.rating !== null);
    if (!rated.length) return { average: null as number | null, count: 0 };
    const sum = rated.reduce((s, b) => s + (b.rating ?? 0), 0);
    return { average: Math.round((sum / rated.length) * 10) / 10, count: rated.length };
  });

  /** Genres across books she has actually picked up (not the wishlist). */
  readonly topGenres = computed<GenreCount[]>(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const b of this.books.all()) {
      if (b.status === 'want_to_read') continue;
      for (const g of b.genres) {
        const key = g.toLowerCase();
        const entry = counts.get(key) ?? { label: g, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 6)
      .map((e) => ({ genre: e.label, count: e.count }));
  });

  readonly yearsWithReading = computed(() => {
    const years = new Set<number>([this.year]);
    for (const b of this.books.completed()) {
      const d = parseISODate(b.finishedOn);
      if (d) years.add(d.getFullYear());
    }
    return [...years].sort((a, b) => b - a);
  });

  readonly goalProgress = computed(() => {
    const target = this.goals.current()?.targetBooks ?? null;
    const done = this.completedThisYear();
    return { target, done, percent: target ? Math.min(100, Math.round((done / target) * 100)) : null };
  });

  completedIn(year: number): Book[] {
    return this.books.completed().filter((b) => parseISODate(b.finishedOn)?.getFullYear() === year);
  }

  monthlyCompleted(year: number): number[] {
    const months = Array.from({ length: 12 }, () => 0);
    for (const b of this.completedIn(year)) months[parseISODate(b.finishedOn)!.getMonth()]++;
    return months;
  }

  /** Completed books with no finish date can't be placed on the calendar. */
  readonly undatedCompleted = computed(() => this.books.completed().filter((b) => !b.finishedOn).length);
}
