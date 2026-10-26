import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppError } from '../../core/services/app-error';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './auth-form.scss',
  template: `
    <h1>Reset your password</h1>
    @if (sent()) {
      <div class="notice" role="status">
        <h2>Look for an email from us</h2>
        <p>If an account exists for <strong>{{ form.controls.email.value }}</strong>, a link to choose a new password is on its way. It works on any device.</p>
      </div>
    } @else {
      <p class="intro">We'll email you a link to choose a new one.</p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error()) {
          <p class="alert" role="alert">{{ error() }}</p>
        }
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" inputmode="email" placeholder="you@example.com" aria-describedby="email-error" />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <span id="email-error" class="error-text">Enter the email you registered with.</span>
          }
        </div>
        <button type="submit" class="btn btn-primary btn-block" [disabled]="busy()">
          @if (busy()) { <span class="spinner" aria-hidden="true"></span> Sending… } @else { Send reset link }
        </button>
      </form>
    }
    <p class="switch"><a routerLink="/sign-in">Back to sign in</a></p>
  `,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.sendPasswordReset(this.form.getRawValue().email.trim());
      this.sent.set(true);
    } catch (e) {
      this.error.set(e instanceof AppError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
