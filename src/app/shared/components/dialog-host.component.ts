import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../core/services/dialog.service';
import { todayISO } from '../utils/dates';
import { StarRatingComponent } from './star-rating.component';

/** Renders the app's modal dialogs using the native <dialog> element. */
@Component({
  selector: 'app-dialog-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StarRatingComponent],
  template: `
    <dialog #choiceDialog class="dialog" aria-labelledby="choice-title" aria-describedby="choice-message" (cancel)="onChoiceCancel($event)">
      @if (dialogs.choice(); as c) {
        <form method="dialog" class="inner" (submit)="$event.preventDefault()">
          <h2 id="choice-title">{{ c.title }}</h2>
          <p id="choice-message">{{ c.message }}</p>
          <div class="actions">
            <button type="button" class="btn btn-quiet" (click)="dialogs.resolveChoice('cancel')">{{ c.cancelLabel ?? 'Cancel' }}</button>
            @if (c.altLabel) {
              <button type="button" class="btn" (click)="dialogs.resolveChoice('alt')">{{ c.altLabel }}</button>
            }
            <button
              type="button"
              class="btn"
              [class.btn-danger-solid]="c.tone === 'danger'"
              [class.btn-primary]="c.tone !== 'danger'"
              (click)="dialogs.resolveChoice('confirm')"
              autofocus
            >
              {{ c.confirmLabel }}
            </button>
          </div>
        </form>
      }
    </dialog>

    <dialog #finishDialog class="dialog" aria-labelledby="finish-title" (cancel)="onFinishCancel($event)">
      @if (dialogs.finish(); as f) {
        <form class="inner" (ngSubmit)="submitFinish()">
          <svg class="sprig" viewBox="0 0 80 24" aria-hidden="true">
            <path d="M2 18c20-2 44-8 76-14" />
            <path class="leaf" d="M22 15c2-7 9-8 9-8s1 7-9 8zM40 11c4-6 11-5 11-5s-2 7-11 5zM58 8c1-6 8-7 8-7s1 6-8 7z" />
          </svg>
          <h2 id="finish-title">You finished <em>{{ f.title }}</em></h2>
          <p class="sub">When did you turn the last page, and how did it leave you?</p>
          <div class="field">
            <label for="finish-date">Date finished</label>
            <input
              id="finish-date"
              class="input"
              type="date"
              name="finishedOn"
              [(ngModel)]="finishedOn"
              [min]="f.startedOn ?? ''"
              [max]="today"
              required
            />
            @if (dateError()) {
              <span class="error-text">{{ dateError() }}</span>
            }
          </div>
          <div class="field">
            <span class="label" id="finish-rating-label">Your rating <span class="optional">(optional)</span></span>
            <app-star-rating [(value)]="rating" [editable]="true" [size]="26" label="Your rating" />
          </div>
          <div class="actions">
            <button type="button" class="btn btn-quiet" (click)="dialogs.resolveFinish(null)">Not yet</button>
            <button type="submit" class="btn btn-primary">Mark as finished</button>
          </div>
        </form>
      }
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(460px, calc(100vw - 32px));
      padding: 0;
      border: 1px solid var(--rule);
      border-radius: var(--radius-lg);
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 30px 80px -30px rgb(30 25 20 / 0.5);
    }
    .dialog[open] {
      animation: rise-in 220ms var(--ease) both;
    }
    .dialog::backdrop {
      background: rgb(36 32 28 / 0.42);
      backdrop-filter: blur(2px);
      animation: fade-in 200ms var(--ease) both;
    }
    .inner {
      display: grid;
      gap: var(--s-4);
      padding: var(--s-6) var(--s-6) var(--s-5);
    }
    h2 {
      font-size: var(--step-3);
      font-weight: 400;
    }
    h2 em {
      font-style: italic;
    }
    p {
      color: var(--ink-soft);
    }
    .sub {
      font-family: var(--serif);
      font-style: italic;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--s-2);
      margin-top: var(--s-3);
    }
    .sprig {
      display: block;
      width: 80px;
      height: 24px;
      fill: none;
      stroke: var(--forest);
      stroke-width: 1.4;
      stroke-linecap: round;
    }
    .sprig .leaf {
      fill: var(--sage);
    }
  `,
})
export class DialogHostComponent {
  protected readonly dialogs = inject(DialogService);
  private readonly choiceDialog = viewChild.required<ElementRef<HTMLDialogElement>>('choiceDialog');
  private readonly finishDialog = viewChild.required<ElementRef<HTMLDialogElement>>('finishDialog');

  protected readonly today = todayISO();
  protected finishedOn = todayISO();
  protected readonly rating = signal<number | null>(null);
  protected readonly dateError = signal('');

  constructor() {
    effect(() => toggle(this.choiceDialog().nativeElement, !!this.dialogs.choice()));
    effect(() => {
      const f = this.dialogs.finish();
      if (f) {
        this.finishedOn = todayISO();
        this.rating.set(f.rating);
        this.dateError.set('');
      }
      toggle(this.finishDialog().nativeElement, !!f);
    });
  }

  protected onChoiceCancel(event: Event): void {
    event.preventDefault();
    this.dialogs.resolveChoice('cancel');
  }

  protected onFinishCancel(event: Event): void {
    event.preventDefault();
    this.dialogs.resolveFinish(null);
  }

  protected submitFinish(): void {
    const f = this.dialogs.finish();
    if (!f) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.finishedOn)) {
      this.dateError.set('Choose the date you finished.');
      return;
    }
    if (f.startedOn && this.finishedOn < f.startedOn) {
      this.dateError.set('The finish date can’t be before you started.');
      return;
    }
    this.dialogs.resolveFinish({ finishedOn: this.finishedOn, rating: this.rating() });
  }
}

function toggle(dialog: HTMLDialogElement, open: boolean): void {
  if (open && !dialog.open) dialog.showModal();
  if (!open && dialog.open) dialog.close();
}
