import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideX } from '@lucide/angular';
import { uniqueCaseless } from '../utils/text';

let nextId = 0;

/** Type and press Enter or comma to add an item (authors, genres, tags). */
@Component({
  selector: 'app-chips-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ChipsInputComponent), multi: true }],
  template: `
    <div class="box" [class.disabled]="disabled()" (click)="focusInput()">
      @for (item of items(); track item; let i = $index) {
        <span class="chip">
          {{ item }}
          <button type="button" (click)="remove(i); $event.stopPropagation()" [attr.aria-label]="'Remove ' + item" [disabled]="disabled()">
            <svg lucideX [size]="13"></svg>
          </button>
        </span>
      }
      <input
        #field
        [id]="inputId()"
        type="text"
        [attr.list]="suggestions().length ? listId : null"
        [placeholder]="items().length ? '' : placeholder()"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        autocomplete="off"
        (keydown)="onKey($event)"
        (blur)="commit(); onTouched()"
        (input)="draft.set(field.value)"
      />
      @if (suggestions().length) {
        <datalist [id]="listId">
          @for (s of suggestions(); track s) {
            <option [value]="s"></option>
          }
        </datalist>
      }
    </div>
  `,
  styles: `
    .box {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      min-height: 44px;
      padding: 6px 8px;
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius);
      background: var(--surface);
      cursor: text;
      transition:
        border-color var(--dur-fast) var(--ease),
        box-shadow var(--dur-fast) var(--ease);
    }
    .box:focus-within {
      border-color: var(--forest);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--forest) 18%, transparent);
    }
    .box.disabled {
      opacity: 0.6;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px 4px 3px 10px;
      border-radius: 999px;
      background: var(--sage-soft);
      color: var(--ink);
      font-size: var(--step--1);
      line-height: 1.4;
    }
    .chip button {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ink-soft);
    }
    .chip button:hover {
      background: color-mix(in srgb, var(--ink) 10%, transparent);
      color: var(--ink);
    }
    input {
      flex: 1 1 120px;
      min-width: 100px;
      border: 0;
      outline: none;
      background: transparent;
      font-size: 1rem;
      padding: 4px;
    }
    input::placeholder {
      color: var(--ink-faint);
    }
  `,
})
export class ChipsInputComponent implements ControlValueAccessor {
  readonly placeholder = input('');
  readonly inputId = input(`chips-${++nextId}`);
  readonly describedBy = input('');
  readonly suggestions = input<string[]>([]);
  readonly max = input(20);

  protected readonly listId = `chips-list-${nextId}`;
  protected readonly items = signal<string[]>([]);
  protected readonly draft = signal('');
  protected readonly disabled = signal(false);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  private onChange: (value: string[]) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string[] | null): void {
    this.items.set(Array.isArray(value) ? value : []);
  }
  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  /** Adds whatever is typed but not yet committed (call before saving). */
  commit(): void {
    const raw = this.field().nativeElement.value;
    const parts = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    this.setItems(uniqueCaseless([...this.items(), ...parts]).slice(0, this.max()));
    this.field().nativeElement.value = '';
    this.draft.set('');
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      if (this.field().nativeElement.value.trim()) {
        event.preventDefault();
        this.commit();
      } else if (event.key !== 'Enter') {
        event.preventDefault();
      }
    } else if (event.key === 'Backspace' && !this.field().nativeElement.value && this.items().length) {
      this.remove(this.items().length - 1);
    }
  }

  protected remove(index: number): void {
    this.setItems(this.items().filter((_, i) => i !== index));
  }

  protected focusInput(): void {
    this.field().nativeElement.focus();
  }

  private setItems(items: string[]): void {
    this.items.set(items);
    this.onChange(items);
  }
}
