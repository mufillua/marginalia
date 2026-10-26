import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideCheck, LucideCircleAlert, LucideInfo, LucideX } from '@lucide/angular';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCheck, LucideCircleAlert, LucideInfo, LucideX],
  template: `
    <div class="region" role="status" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast t-' + toast.kind" animate.enter="toast-in" animate.leave="toast-out" [attr.role]="toast.kind === 'error' ? 'alert' : null">
          <span class="icon" aria-hidden="true">
            @switch (toast.kind) {
              @case ('success') { <svg lucideCheck [size]="16"></svg> }
              @case ('error') { <svg lucideCircleAlert [size]="16"></svg> }
              @default { <svg lucideInfo [size]="16"></svg> }
            }
          </span>
          <p>{{ toast.message }}</p>
          @if (toast.action; as action) {
            <button type="button" class="action" (click)="action.run(); toasts.dismiss(toast.id)">{{ action.label }}</button>
          }
          <button type="button" class="close" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss notification">
            <svg lucideX [size]="14"></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .region {
      position: fixed;
      z-index: 60;
      right: max(16px, env(safe-area-inset-right));
      bottom: 24px;
      display: grid;
      gap: 10px;
      width: min(400px, calc(100vw - 32px));
      pointer-events: none;
    }
    @media (max-width: 860px) {
      .region {
        left: 16px;
        right: 16px;
        width: auto;
        bottom: calc(84px + env(safe-area-inset-bottom));
      }
    }
    .toast {
      pointer-events: auto;
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: start;
      gap: 10px;
      padding: 12px 10px 12px 14px;
      border-radius: var(--radius);
      background: var(--ink);
      color: var(--paper);
      box-shadow: var(--shadow-soft);
      font-size: var(--step-0);
    }
    .toast p {
      padding-top: 1px;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--paper) 14%, transparent);
    }
    .t-success .icon {
      background: var(--sage);
      color: #1f2a22;
    }
    .t-error .icon {
      background: var(--rose);
      color: #4a2622;
    }
    .action {
      border: 0;
      background: none;
      color: var(--rose);
      font-weight: 600;
      padding: 2px 6px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .close {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      opacity: 0.7;
    }
    .close:hover {
      opacity: 1;
      background: color-mix(in srgb, var(--paper) 12%, transparent);
    }
    .toast-in {
      animation: rise-in 260ms var(--ease) both;
    }
    .toast-out {
      animation: fade-out 200ms var(--ease) both;
    }
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
