import { computed, inject, Injectable } from '@angular/core';
import { goalDraftToRow, GoalDraft } from '../models/mappers';
import { ReadingGoal } from '../models/models';
import { AuthService } from '../services/auth.service';
import { LibraryService } from './library.service';

@Injectable({ providedIn: 'root' })
export class GoalsService {
  private readonly library = inject(LibraryService);
  private readonly auth = inject(AuthService);

  readonly currentYear = new Date().getFullYear();
  readonly all = computed(() => [...this.library.goals.all()].sort((a, b) => b.year - a.year));
  readonly current = computed(() => this.forYear(this.currentYear));

  forYear(year: number): ReadingGoal | undefined {
    return this.library.goals.all().find((g) => g.year === year);
  }

  /** Creates or updates the row for a year (goal and/or Book of the Year). */
  save(draft: GoalDraft): Promise<ReadingGoal> {
    const userId = this.auth.userId();
    const existing = this.forYear(draft.year);
    if (existing) {
      return this.library.write(
        () => this.library.goals.update(existing.id, goalDraftToRow(draft), {}, 'save your reading goal'),
        'save your reading goal',
      );
    }
    return this.library.write(
      () =>
        this.library.goals.upsert(
          { ...goalDraftToRow(draft), user_id: userId ?? undefined },
          'user_id,year',
          'save your reading goal',
        ),
      'save your reading goal',
    );
  }
}
