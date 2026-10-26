import { computed, inject, Injectable } from '@angular/core';
import { journalDraftToRow } from '../models/mappers';
import { JournalDraft, JournalEntry } from '../models/models';
import { LibraryService } from './library.service';

@Injectable({ providedIn: 'root' })
export class JournalService {
  private readonly library = inject(LibraryService);

  /** Newest first: by entry date, then by when it was written. */
  readonly entries = computed(() =>
    [...this.library.journal.all()].sort(
      (a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt),
    ),
  );
  readonly loaded = this.library.journal.loaded;
  readonly tags = computed(() => {
    const set = new Map<string, string>();
    for (const e of this.entries()) for (const t of e.tags) if (!set.has(t.toLowerCase())) set.set(t.toLowerCase(), t);
    return [...set.values()].sort((a, b) => a.localeCompare(b));
  });

  get(id: string): JournalEntry | undefined {
    return this.library.journal.get(id);
  }

  forBook(bookId: string): JournalEntry[] {
    return this.entries().filter((e) => e.bookId === bookId);
  }

  create(draft: JournalDraft): Promise<JournalEntry> {
    return this.library.write(
      () => this.library.journal.insert(journalDraftToRow(draft), 'save this entry'),
      'save this entry',
    );
  }

  save(entry: JournalEntry, draft: JournalDraft): Promise<JournalEntry> {
    return this.library.write(
      () =>
        this.library.journal.update(entry.id, journalDraftToRow(draft), { expectedVersion: entry.version }, 'save this entry'),
      'save this entry',
    );
  }

  remove(entry: JournalEntry): Promise<void> {
    return this.library.write(() => this.library.journal.remove(entry.id, 'delete this entry'), 'delete this entry');
  }
}
