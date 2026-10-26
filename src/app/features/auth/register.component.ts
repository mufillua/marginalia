import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { AppError } from '../../core/services/app-error';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideEye, LucideEyeOff],
  styleUrl: './auth-form.scss',
  template: `
    @if (sentTo()) {
      <h1>Check your inbox</h1>
      <div class="notice" role="status">
        <h2>One more step</h2>
        <p>We sent a confirmation link to <strong>{{ sentTo() }}</strong>. Open it on any device to finish creating your library, then sign in.</p>
        <p>Nothing there? Check your spam folder, or wait a minute before trying again.</p>
      </div>
      <p class="switch"><a routerLink="/sign-in">Back to sign in</a></p>
    } @else {
      <h1>Start your library</h1>
      <p class="intro">A private place for every book you read, and everything they made you think.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error()) {
          <p class="alert" role="alert">{{ error() }}</p>
        }
        <div class="field">
          <label for="name">What should we call you?</label>
          <input id="name" class="input" formControlName="name" autocomplete="given-name" placeholder="Your first name" maxlength="60" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" inputmode="email" placeholder="you@example.com" [attr.aria-invalid]="invalid('email')" aria-describedby="email-error" />
          @if (invalid('email')) {
            <span id="email-error" class="error-text">Enter a valid email address.</span>
          }
        </div>
        <div class="field">
          <label for="password">Password</label>
          <div class="password-wrap">
            <input id="password" class="input" [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" aria-describedby="password-hint" [attr.aria-invalid]="invalid('password')" />
            <button type="button" class="reveal" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showPassword()">
              @if (showPassword()) { <svg lucideEyeOff [size]="18"></svg> } @else { <svg lucideEye [size]="18"></svg> }
            </button>
          </div>
          <span id="password-hint" [class]="invalid('password') ? 'error-text' : 'hint'">At least 8 characters.</span>
        </div>
        <button type="submit" class="btn btn-primary btn-block" [disabled]="busy()">
          @if (busy()) { <span class="spinner" aria-hidden="true"></span> Creating your library… } @else { Create my library }
        </button>
        @if (auth.googleEnabled) {
          <div class="or">or</div>
          <button type="button" class="btn btn-block" (click)="google()" [disabled]="busy()">Continue with Google</button>
        }
      </form>

      <p class="switch">Already have an account? <a routerLink="/sign-in">Sign in</a></p>
    }
  `,
})
export class RegisterComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly form = this.fb.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly sentTo = signal('');
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
      const { name, email, password } = this.form.getRawValue();
      const signedIn = await this.auth.signUp(email.trim(), password, name);
      if (signedIn) await this.router.navigateByUrl('/');
      else this.sentTo.set(email.trim());
    } catch (e) {
      this.error.set(e instanceof AppError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async google(): Promise<void> {
    try {
      await this.auth.signInWithGoogle();
    } catch (e) {
      this.error.set(e instanceof AppError ? e.message : 'Google sign-in is not available right now.');
    }
  }
}
