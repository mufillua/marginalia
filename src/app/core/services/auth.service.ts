import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthError, Session } from '@supabase/supabase-js';
import { env } from '../config/env';
import { AppError } from './app-error';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly userId = computed(() => this.user()?.id ?? null);
  readonly email = computed(() => this.user()?.email ?? null);
  readonly ready = signal(false);
  /** True after arriving from a password-reset email link. */
  readonly recovering = signal(false);
  readonly googleEnabled = env.enableGoogleSignIn;

  /** Runs once before the first route renders (see app.config.ts). */
  async init(): Promise<void> {
    if (!this.supabase.configured) {
      this.ready.set(true);
      return;
    }
    const auth = this.supabase.client.auth;
    if (typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)) {
      this.recovering.set(true);
    }
    auth.onAuthStateChange((event, session) => {
      // Keep this callback synchronous: awaiting Supabase calls here can deadlock.
      if (event === 'PASSWORD_RECOVERY') this.recovering.set(true);
      if (event === 'SIGNED_OUT') this.recovering.set(false);
      this.session.set(session);
    });
    try {
      const { data } = await auth.getSession();
      this.session.set(data.session);
    } finally {
      this.ready.set(true);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw authError(error);
  }

  /** Returns true when the account is active immediately (no email confirmation needed). */
  async signUp(email: string, password: string, displayName: string): Promise<boolean> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw authError(error);
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new AppError('validation', 'There is already an account with this email. Sign in instead.');
    }
    return !!data.session;
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw authError(error);
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw authError(error);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) throw authError(error);
    this.recovering.set(false);
  }

  async signOut(): Promise<void> {
    // 'local' clears this device's session even when offline.
    const { error } = await this.supabase.client.auth.signOut({ scope: 'local' });
    this.session.set(null);
    if (error && !/session/i.test(error.message)) throw authError(error);
  }
}

function authError(error: AuthError): AppError {
  const message = error.message ?? '';
  const code = (error as AuthError & { code?: string }).code ?? '';

  if (/failed to fetch|network/i.test(message) || error.status === 0) {
    return new AppError('network', "We couldn't reach the sign-in service. Check your connection and try again.", error);
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new AppError('auth', "That email and password don't match. Check them and try again.", error);
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return new AppError('auth', 'Confirm your email first. Open the link we sent when you registered, then sign in.', error);
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return new AppError('validation', 'There is already an account with this email. Sign in instead.', error);
  }
  if (code === 'weak_password' || /password should/i.test(message)) {
    return new AppError('validation', 'Choose a stronger password: at least 8 characters.', error);
  }
  if (code === 'same_password') {
    return new AppError('validation', 'Your new password must be different from the old one.', error);
  }
  if (code === 'over_email_send_rate_limit' || error.status === 429) {
    return new AppError('rate_limit', 'Too many emails or attempts in a short time. Wait a few minutes and try again.', error);
  }
  if (code === 'email_address_not_authorized' || /not authorized/i.test(message)) {
    return new AppError(
      'auth',
      "This library can't send email to that address yet. The site owner needs to set up email sending in Supabase (see README).",
      error,
    );
  }
  if (code === 'signup_disabled' || /signups not allowed/i.test(message)) {
    return new AppError('auth', 'New accounts are closed for this library.', error);
  }
  if (code === 'session_not_found' || code === 'session_expired') {
    return new AppError('auth', 'Your reset link has expired. Request a new one.', error);
  }
  return new AppError('unknown', message || 'Something went wrong. Please try again.', error);
}
