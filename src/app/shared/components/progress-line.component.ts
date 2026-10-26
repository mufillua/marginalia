import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A thin reading-progress rule, for compact places like book cards. */
@Component({
  selector: 'app-progress-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'clamped()',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <span class="track"><span class="fill" [style.width.%]="clamped()"></span></span>
    @if (showLabel()) {
      <span class="pct">{{ clamped() }}%</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .track {
      flex: 1;
      height: 3px;
      border-radius: 2px;
      background: var(--sage-soft);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      background: var(--forest);
      border-radius: inherit;
      transition: width 600ms var(--ease);
    }
    .pct {
      font-size: var(--step--1);
      color: var(--ink-soft);
      font-variant-numeric: tabular-nums;
      min-width: 3.2ch;
      text-align: right;
    }
  `,
})
export class ProgressLineComponent {
  readonly percent = input.required<number>();
  readonly label = input('Reading progress');
  readonly showLabel = input(true);
  protected readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.percent()))));
}
