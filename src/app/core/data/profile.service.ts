import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { profileFromRow, ProfileRow } from '../models/mappers';
import { ThemePreference } from '../models/models';
import { toAppError } from '../services/app-error';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';
import { LibraryService } from './library.service';

const THEME_KEY = 'marginalia-theme';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly library = inject(LibraryService);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly profile = this.library.profile.asReadonly();
  readonly displayName = computed(() => {
    const name = this.profile()?.displayName?.trim();
    if (name) return name;
    const meta = this.auth.user()?.user_metadata?.['display_name'] as string | undefined;
    return meta?.trim() || null;
  });

  /** Theme is applied from local storage first (no flash), then from the profile. */
  readonly theme = signal<ThemePreference>(readStoredTheme());

  constructor() {
    effect(() => applyTheme(this.theme()));
    effect(() => {
      const fromProfile = this.profile()?.theme;
      if (fromProfile) untracked(() => this.setThemeLocally(fromProfile));
    });
  }

  async update(patch: { displayName?: string | null; theme?: ThemePreference }): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    const row: Partial<ProfileRow> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName?.trim().slice(0, 60) || null;
    if (patch.theme !== undefined) row.theme = patch.theme;
    await this.library.write(async () => {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .update(row)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw toAppError(error, 'save your settings');
      this.library.applyProfile(profileFromRow(data as ProfileRow));
    }, 'save your settings');
  }

  async setTheme(theme: ThemePreference): Promise<void> {
    this.setThemeLocally(theme);
    if (this.auth.userId()) await this.update({ theme });
  }

  private setThemeLocally(theme: ThemePreference): void {
    this.theme.set(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage may be unavailable (private mode); the theme still applies */
    }
  }
}

function readStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
