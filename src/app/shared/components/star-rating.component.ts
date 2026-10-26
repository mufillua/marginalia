import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

const STAR =
  'M12 2.6l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.06l-5.66 2.97 1.08-6.3-4.58-4.47 6.33-.92z';

/**
 * Five stars with half-star precision. Read-only by default; with
 * `editable` it behaves as a slider (arrow keys, Home/End, Delete to clear).
 */
@Component({
  selector: 'app-star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.editable]': 'editable()',
    '[attr.role]': "editable() ? 'slider' : 'img'",
    '[attr.tabindex]': 'editable() && !disabled() ? 0 : null',
    '[attr.aria-label]': 'editable() ? label() : readLabel()',
    '[attr.aria-valuemin]': 'editable() ? 0 : null',
    '[attr.aria-valuemax]': 'editable() ? 5 : null',
    '[attr.aria-valuenow]': 'editable() ? (value() ?? 0) : null',
    '[attr.aria-valuetext]': 'editable() ? readLabel() : null',
    '[attr.aria-disabled]': 'disabled() || null',
    '[style.--star-size.px]': 'size()',
    '(keydown)': 'onKey($event)',
  },
  template: `
    <span class="stars" aria-hidden="true">
      @for (i of positions; track i) {
        <span class="star">
          <svg viewBox="0 0 24 24" class="empty"><path [attr.d]="star" /></svg>
          <svg viewBox="0 0 24 24" class="full" [style.clip-path]="clipFor(i)"><path [attr.d]="star" /></svg>
          @if (editable() && !disabled()) {
            <button type="button" tabindex="-1" class="hit left" (click)="set(i - 0.5)" [attr.aria-label]="i - 0.5 + ' stars'"></button>
            <button type="button" tabindex="-1" class="hit right" (click)="set(i)" [attr.aria-label]="i + ' stars'"></button>
          }
        </span>
      }
    </span>
    @if (showValue() && value() !== null) {
      <span class="value">{{ value() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      --star-size: 16px;
      line-height: 1;
      border-radius: 4px;
    }
    .stars {
      display: inline-flex;
      gap: calc(var(--star-size) * 0.12);
    }
    .star {
      position: relative;
      width: var(--star-size);
      height: var(--star-size);
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .empty path {
      fill: none;
      stroke: var(--ink-faint);
      stroke-width: 1.3;
      stroke-linejoin: round;
    }
    .full path {
      fill: var(--rose-ink);
      stroke: var(--rose-ink);
      stroke-width: 1.3;
      stroke-linejoin: round;
    }
    .hit {
      position: absolute;
      top: -4px;
      bottom: -4px;
      width: 50%;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
    }
    .hit.left {
      left: -2px;
    }
    .hit.right {
      right: -2px;
    }
    :host(.editable) .star {
      transition: transform var(--dur-fast) var(--ease);
    }
    :host(.editable) .star:hover {
      transform: scale(1.12);
    }
    .value {
      font-size: var(--step--1);
      color: var(--ink-soft);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class StarRatingComponent {
  readonly value = model<number | null>(null);
  readonly editable = input(false);
  readonly disabled = input(false);
  readonly size = input(16);
  readonly showValue = input(false);
  readonly label = input('Your rating');

  protected readonly star = STAR;
  protected readonly positions = [1, 2, 3, 4, 5];

  protected readonly readLabel = computed(() => {
    const v = this.value();
    return v === null ? 'Not rated' : `${v} out of 5 stars`;
  });

  protected clipFor(i: number): string {
    const v = this.value() ?? 0;
    const fill = Math.max(0, Math.min(1, v - (i - 1)));
    return `inset(0 ${100 - fill * 100}% 0 0)`;
  }

  protected set(v: number): void {
    if (!this.editable() || this.disabled()) return;
    // Clicking the current value again clears it.
    this.value.set(this.value() === v ? null : v);
  }

  protected onKey(event: KeyboardEvent): void {
    if (!this.editable() || this.disabled()) return;
    const v = this.value() ?? 0;
    let next: number | null | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(5, v + 0.5);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0.5, v - 0.5);
        break;
      case 'Home':
        next = 0.5;
        break;
      case 'End':
        next = 5;
        break;
      case 'Delete':
      case 'Backspace':
        next = null;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.value.set(next);
  }
}
