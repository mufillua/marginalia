import { Injectable, signal } from '@angular/core';
import { AppError } from './app-error';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; run: () => void };
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, action?: Toast['action']): void {
    this.show('success', message, action);
  }

  info(message: string): void {
    this.show('info', message);
  }

  error(error: unknown, fallback = 'Something went wrong. Please try again.'): void {
    const message = error instanceof AppError ? error.message : fallback;
    if (!(error instanceof AppError)) console.error(error);
    this.show('error', message);
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(kind: ToastKind, message: string, action?: Toast['action']): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, kind, message, action }]);
    const ttl = kind === 'error' ? 9000 : action ? 7000 : 4200;
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), ttl),
    );
  }
}
