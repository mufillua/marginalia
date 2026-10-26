import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideDownload, LucideLogOut, LucideMonitor, LucideMoon, LucideRefreshCw, LucideSun } from '@lucide/angular';
import { GoalsService } from '../../core/data/goals.service';
import { LibraryService } from '../../core/data/library.service';
import { ProfileService } from '../../core/data/profile.service';
import { ThemePreference } from '../../core/models/models';
import { AppError } from '../../core/services/app-error';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { todayISO } from '../../shared/utils/dates';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, LucideSun, LucideMoon, LucideMonitor, LucideDownload, LucideLogOut, LucideRefreshCw],
  template: `
    <div class="page narrow">
      <div class="page-head">
        <div>
          <h1>Settings</h1>
          <p class="lede">Make the journal your own.</p>
        </div>
      </div>

      <section class="block" aria-labelledby="you-h">
        <h2 id="you-h">You</h2>
        <form class="row-form" (ngSubmit)="saveName()">
          <div class="field grow">
            <label for="display-name">Your name</label>
            <input id="display-name" name="name" class="input" maxlength="60" [(ngModel)]="name" placeholder="How the journal greets you" />
          </div>
          <button type="submit" class="btn btn-primary" [disabled]="savingName() || name() === (profile.displayName() ?? '')">Save name</button>
        </form>
        <p class="hint">Signed in as {{ auth.email() }}</p>
      </section>

      <section class="block" aria-labelledby="look-h">
        <h2 id="look-h">Reading light</h2>
        <div class="themes" role="radiogroup" aria-label="Theme">
          @for (t of themes; track t.value) {
            <button type="button" role="radio" class="theme" [class.on]="profile.theme() === t.value" [attr.aria-checked]="profile.theme() === t.value" (click)="setTheme(t.value)">
              <span class="swatch" [class]="'swatch sw-' + t.value" aria-hidden="true"></span>
              <span class="theme-name">
                @switch (t.value) {
                  @case ('light') { <svg lucideSun [size]="15"></svg> }
                  @case ('dark') { <svg lucideMoon [size]="15"></svg> }
                  @default { <svg lucideMonitor [size]="15"></svg> }
                }
                {{ t.label }}
              </span>
              <span class="hint">{{ t.hint }}</span>
            </button>
          }
        </div>
      </section>

      <section class="block" aria-labelledby="goal-h">
        <h2 id="goal-h">Reading goal</h2>
        <p>
          @if (goals.current()?.targetBooks; as t) {
            {{ t }} books in {{ goals.currentYear }}.
          } @else {
            No goal set for {{ goals.currentYear }}.
          }
          <a routerLink="/stats">{{ goals.current()?.targetBooks ? 'Change your goal' : 'Set a goal' }}</a>
        </p>
      </section>

      <section class="block" aria-labelledby="sync-h">
        <h2 id="sync-h">Sync</h2>
        <p>
          Your books, journal and goals are saved to the cloud and appear on every device where you sign in.
          @if (library.lastSyncedAt(); as at) {
            Last synced {{ syncTime(at) }}.
          }
        </p>
        <div class="actions">
          <button type="button" class="btn btn-sm" (click)="syncNow()" [disabled]="library.refreshing()">
            <svg lucideRefreshCw [size]="15"></svg> {{ library.refreshing() ? 'Syncing…' : 'Sync now' }}
          </button>
          <button type="button" class="btn btn-sm" (click)="exportData()"><svg lucideDownload [size]="15"></svg> Download my library</button>
        </div>
        <p class="hint">The download is a JSON file with every book, quote, journal entry and goal, for safekeeping.</p>
      </section>

      <section class="block" aria-labelledby="pw-h">
        <h2 id="pw-h">Password</h2>
        <form class="row-form" (ngSubmit)="changePassword()">
          <div class="field grow">
            <label for="new-password">New password</label>
            <input id="new-password" name="password" class="input" type="password" autocomplete="new-password" minlength="8" [(ngModel)]="password" aria-describedby="pw-hint" />
            <span id="pw-hint" class="hint">At least 8 characters.</span>
          </div>
          <button type="submit" class="btn" [disabled]="savingPassword() || password().length < 8">Change password</button>
        </form>
      </section>

      <section class="block" aria-labelledby="out-h">
        <h2 id="out-h">Sign out</h2>
        <p>Your library stays safe in the cloud. Sign in again on any device to pick up where you left off.</p>
        <div class="actions">
          <button type="button" class="btn btn-danger" (click)="signOut()" [disabled]="signingOut()"><svg lucideLogOut [size]="16"></svg> Sign out of this device</button>
        </div>
      </section>
    </div>
  `,
  styles: `
    .narrow {
      max-width: 760px;
      margin-left: 0;
    }
    .lede {
      margin-top: var(--s-2);
    }
    .block {
      display: grid;
      gap: var(--s-3);
      padding: var(--s-6) 0;
      border-top: 1px solid var(--rule);
    }
    .block h2 {
      font-style: italic;
      font-weight: 360;
    }
    .block p {
      color: var(--ink-soft);
      max-width: 60ch;
    }
    .row-form {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--s-3);
    }
    .row-form .btn {
      margin-top: 26px;
    }
    .grow {
      flex: 1;
      min-width: 220px;
    }
    .themes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--s-3);
    }
    .theme {
      display: grid;
      gap: 6px;
      justify-items: start;
      padding: var(--s-3);
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius);
      background: transparent;
      color: var(--ink);
      text-align: left;
    }
    .theme.on {
      border-color: var(--forest);
      box-shadow: inset 0 0 0 1px var(--forest);
    }
    .theme-name {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 560;
    }
    .swatch {
      width: 100%;
      height: 44px;
      border-radius: 4px;
      border: 1px solid var(--rule);
    }
    .sw-light {
      background: linear-gradient(90deg, #f8f5ef 60%, #34483b 60% 70%, #d8b9b4 70%);
    }
    .sw-dark {
      background: linear-gradient(90deg, #1d201c 60%, #b7c4ae 60% 70%, #b98f88 70%);
    }
    .sw-system {
      background: linear-gradient(135deg, #f8f5ef 50%, #1d201c 50%);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--s-2);
    }
    @media (max-width: 520px) {
      .themes {
        grid-template-columns: 1fr;
      }
      .swatch {
        height: 28px;
      }
      .row-form .btn {
        margin-top: 0;
        width: 100%;
      }
    }
  `,
})
export class SettingsComponent {
  protected readonly auth = inject(AuthService);
  protected readonly profile = inject(ProfileService);
  protected readonly library = inject(LibraryService);
  protected readonly goals = inject(GoalsService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly themes: { value: ThemePreference; label: string; hint: string }[] = [
    { value: 'light', label: 'Daylight', hint: 'Ivory paper' },
    { value: 'dark', label: 'Lamplight', hint: 'For reading at night' },
    { value: 'system', label: 'Match device', hint: 'Follows your system' },
  ];

  protected readonly name = signal('');
  protected readonly password = signal('');
  protected readonly savingName = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly signingOut = signal(false);
  private readonly timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

  constructor() {
    effect(() => {
      const n = this.profile.displayName() ?? '';
      untracked(() => this.name.set(n));
    });
  }

  protected syncTime(d: Date): string {
    return `at ${this.timeFormat.format(d)}`;
  }

  protected async saveName(): Promise<void> {
    this.savingName.set(true);
    try {
      await this.profile.update({ displayName: this.name() });
      this.toasts.success('Name saved.');
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.savingName.set(false);
    }
  }

  protected async setTheme(theme: ThemePreference): Promise<void> {
    try {
      await this.profile.setTheme(theme);
    } catch (error) {
      this.toasts.error(error);
    }
  }

  protected async syncNow(): Promise<void> {
    await this.library.refresh();
    if (this.library.loadError()) this.toasts.error(new AppError('network', this.library.loadError()!));
    else this.toasts.success('Everything is up to date.');
  }

  protected exportData(): void {
    const data = {
      exportedAt: new Date().toISOString(),
      profile: this.library.profile(),
      books: this.library.books.all(),
      quotes: this.library.quotes.all(),
      journalEntries: this.library.journal.all(),
      readingGoals: this.library.goals.all(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marginalia-library-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected async changePassword(): Promise<void> {
    if (this.password().length < 8) return;
    this.savingPassword.set(true);
    try {
      await this.auth.updatePassword(this.password());
      this.password.set('');
      this.toasts.success('Password changed.');
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.savingPassword.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/sign-in');
      this.toasts.info('You’ve signed out. Your library stays safe in the cloud.');
    } catch (error) {
      this.toasts.error(error);
    } finally {
      this.signingOut.set(false);
    }
  }
}
