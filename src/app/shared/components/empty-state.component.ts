import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A quiet invitation to act, with a small line drawing. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="art" viewBox="0 0 160 110" aria-hidden="true">
      @switch (art()) {
        @case ('journal') {
          <path d="M40 22h70a6 6 0 0 1 6 6v68H46a6 6 0 0 1-6-6z" />
          <path d="M40 90a6 6 0 0 1 6-6h70" />
          <path class="soft" d="M56 40h44M56 50h44M56 60h30" />
          <path class="stem" d="M124 18c-10 14-16 30-18 50" />
          <path class="leafy" d="M118 30c8-2 12 2 12 2s-4 6-12 4M113 44c-8-3-12 1-12 1s4 6 12 3M112 56c8-2 12 2 12 2s-4 6-12 4" />
        }
        @case ('search') {
          <circle cx="68" cy="50" r="24" />
          <path d="M86 68l22 22" />
          <path class="soft" d="M56 50h24M60 42h16" />
          <path class="leafy" d="M108 30c10-4 16 2 16 2s-6 8-16 4" />
        }
        @default {
          <path d="M22 92h116" />
          <rect x="34" y="40" width="14" height="52" rx="1.5" />
          <rect x="50" y="30" width="16" height="62" rx="1.5" />
          <path d="M70 92l10-58 14 2.5-10 58" />
          <path class="soft" d="M38 50h6M54 40h8" />
          <path class="stem" d="M116 92c0-18 2-34 8-48" />
          <path class="leafy" d="M118 70c-8-4-14 0-14 0s4 8 14 4M120 56c8-3 13 2 13 2s-5 7-13 3M123 44c-6-5-12-2-12-2s3 7 11 6" />
          <path d="M106 92h24l-3-14h-18z" />
        }
      }
    </svg>
    <h2>{{ heading() }}</h2>
    @if (message()) {
      <p>{{ message() }}</p>
    }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--s-8) var(--s-5);
      gap: var(--s-3);
    }
    .art {
      width: 150px;
      height: auto;
      margin-bottom: var(--s-3);
      fill: none;
      stroke: var(--cocoa);
      stroke-width: 1.3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .art .soft {
      stroke: var(--ink-faint);
      opacity: 0.6;
    }
    .art .stem {
      stroke: var(--forest);
    }
    .art .leafy {
      stroke: var(--forest);
      fill: var(--sage-soft);
    }
    h2 {
      font-style: italic;
      font-weight: 360;
      font-size: var(--step-3);
    }
    p {
      max-width: 42ch;
      color: var(--ink-soft);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--s-3);
      justify-content: center;
      margin-top: var(--s-3);
    }
    .actions:empty {
      display: none;
    }
  `,
})
export class EmptyStateComponent {
  readonly heading = input.required<string>();
  readonly message = input<string>('');
  readonly art = input<'shelf' | 'journal' | 'search'>('shelf');
}
