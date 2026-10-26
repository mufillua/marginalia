import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AppError } from '../../core/services/app-error';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

const matching = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './auth-form.scss',
  template: `
    <h1>Choose a new password</h1>
    @if (!auth.session()) {
      <div class="notice" role="alert">
        <h2>This link has expired</h2>
        <p>Reset links work once and only for a short time. Request a fresh one and use it straight away.</p>
        <a routerLink="/forgot-password" class="btn btn-primary">Send a new link</a>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error()) {
          <p class="alert" role="alert">{{ error() }}</p>
        }
        <div class="field">
          <label for="password">New password</label>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" aria-describedby="password-hint" />
          <span id="password-hint" class="hint">At least 8 characters.</span>
        </div>
        <div class="field">
          <label for="confirm">Type it again</label>
          <input id="confirm" class="input" type="password" formControlName="confirm" autocomplete="new-password" aria-describedby="confirm-error" />
          @if (form.hasError('mismatch') && form.controls.confirm.touched) {
            <span id="confirm-error" class="error-text">The two passwords don't match.</span>
          }
        </div>
        <button type="submit" class="btn btn-primary btn-block" [disabled]="busy()">
          @if (busy()) { <span class="spinner" aria-hidden="true"></span> Saving… } @else { Save new password }
        </button>
      </form>
    }
  `,
})
export class ResetPasswordComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: matching },
  );
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      if (this.form.controls.password.invalid) this.error.set('Choose a password with at least 8 characters.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.updatePassword(this.form.getRawValue().password);
      this.toasts.success('Password updated. Welcome back.');
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set(e instanceof AppError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
