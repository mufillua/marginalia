import { Injectable, signal } from '@angular/core';

export interface ChoiceOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Optional third button, e.g. "Open the existing book". */
  altLabel?: string;
  tone?: 'default' | 'danger';
}

export type Choice = 'confirm' | 'alt' | 'cancel';

export interface FinishOptions {
  title: string;
  startedOn: string | null;
  rating: number | null;
}

export interface FinishResult {
  finishedOn: string;
  rating: number | null;
}

interface PendingChoice extends ChoiceOptions {
  resolve: (choice: Choice) => void;
}

interface PendingFinish extends FinishOptions {
  resolve: (result: FinishResult | null) => void;
}

/** Opens the app's modal dialogs (rendered by DialogHostComponent in the shell). */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly choice = signal<PendingChoice | null>(null);
  readonly finish = signal<PendingFinish | null>(null);

  choose(options: ChoiceOptions): Promise<Choice> {
    this.choice()?.resolve('cancel');
    return new Promise((resolve) => this.choice.set({ ...options, resolve }));
  }

  async confirm(options: ChoiceOptions): Promise<boolean> {
    return (await this.choose(options)) === 'confirm';
  }

  resolveChoice(choice: Choice): void {
    const pending = this.choice();
    this.choice.set(null);
    pending?.resolve(choice);
  }

  /** Asks for the finish date and rating when a book is marked as finished. */
  askFinished(options: FinishOptions): Promise<FinishResult | null> {
    this.finish()?.resolve(null);
    return new Promise((resolve) => this.finish.set({ ...options, resolve }));
  }

  resolveFinish(result: FinishResult | null): void {
    const pending = this.finish();
    this.finish.set(null);
    pending?.resolve(result);
  }
}
