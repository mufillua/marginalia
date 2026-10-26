import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReadingStatus, STATUS_LABELS, STATUS_SHORT_LABELS } from '../../core/models/models';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'status s-' + status()" },
  template: `<span class="mark" aria-hidden="true"></span>{{ text() }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--step--1);
      color: var(--ink-soft);
      white-space: nowrap;
      line-height: 1.3;
    }
    .mark {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex: none;
      border: 1.5px solid currentColor;
    }
    :host(.s-reading) {
      color: var(--forest);
    }
    :host(.s-reading) .mark {
      background: var(--forest);
    }
    :host(.s-completed) .mark {
      background: var(--sage);
      border-color: var(--sage);
    }
    :host(.s-want_to_read) {
      color: var(--rose-ink);
    }
    :host(.s-paused) .mark {
      border-style: dashed;
    }
    :host(.s-dnf) .mark {
      background: linear-gradient(135deg, transparent 45%, currentColor 45%, currentColor 60%, transparent 60%);
    }
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<ReadingStatus>();
  readonly short = input(false);
  protected readonly text = computed(() => (this.short() ? STATUS_SHORT_LABELS : STATUS_LABELS)[this.status()]);
}
