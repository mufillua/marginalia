import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { AppError } from '../../core/services/app-error';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideEye, LucideEyeOff],
  styleUrl: './auth-form.scss',
  template: `
    <h1>Welcome back</h1>
    <p class="intro">Your shelves are just as you left them.</p>

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (error()) {
        <p class="alert" role="alert">{{ error() }}</p>
      }
      <div class="field">
        <label for="email">Email</label>
        <input id="email" class="input" type="email" formControlName="email" autocomplete="email" inputmode="email" placeholder="you@example.com" [attr.aria-invalid]="invalid('email')" aria-describedby="email-error" />
        @if (invalid('email')) {
          <span id="email-error" class="error-text">Enter the email you registered with.</span>
        }
      </div>
      <div class="field">
        <div class="row">
          <label for="password">Password</label>
          <a routerLink="/forgot-password">Forgot your password?</a>
        </div>
        <div class="password-wrap">
          <input id="password" class="input" [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" [attr.aria-invalid]="invalid('password')" aria-describedby="password-error" />
          <button type="button" class="reveal" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showPassword()">
            @if (showPassword()) { <svg lucideEyeOff [size]="18"></svg> } @else { <svg lucideEye [size]="18"></svg> }
          </button>
        </div>
        @if (invalid('password')) {
          <span id="password-error" class="error-text">Enter your password.</span>
        }
      </div>
      <button type="submit" class="btn btn-primary btn-block" [disabled]="busy()">
        @if (busy()) { <span class="spinner" aria-hidden="true"></span> Signing in… } @else { Sign in }
      </button>
      @if (auth.googleEnabled) {
        <div class="or">or</div>
        <button type="button" class="btn btn-block" (click)="google()" [disabled]="busy()">Continue with Google</button>
      }
    </form>

    <p class="switch">New here? <a routerLink="/register">Create your library</a></p>
  `,
})
export class SignInComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly next = input<string>();

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);

  protected invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email.trim(), password);
      const next = this.next();
      await this.router.navigateByUrl(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (e) {
      this.error.set(e instanceof AppError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async google(): Promise<void> {
    this.error.set('');
    try {
      await this.auth.signInWithGoogle();
    } catch (e) {
      this.error.set(e instanceof AppError ? e.message : 'Google sign-in is not available right now.');
    }
  }
}
