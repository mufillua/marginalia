import { ChangeDetectionStrategy, Component, computed, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBookmark,
  LucideBookPlus,
  LucideChartColumn,
  LucideCloud,
  LucideCloudOff,
  LucideEllipsis,
  LucideHouse,
  LucideLibrary,
  LucideLogOut,
  LucideNotebookPen,
  LucideRefreshCw,
  LucideSettings,
  LucidePlus,
} from '@lucide/angular';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LibraryService } from '../core/data/library.service';
import { ProfileService } from '../core/data/profile.service';
import { AuthService } from '../core/services/auth.service';
import { ConnectivityService } from '../core/services/connectivity.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideHouse,
    LucideLibrary,
    LucideBookmark,
    LucideNotebookPen,
    LucideChartColumn,
    LucideSettings,
    LucideBookPlus,
    LucidePlus,
    LucideCloud,
    LucideCloudOff,
    LucideRefreshCw,
    LucideEllipsis,
    LucideLogOut,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly library = inject(LibraryService);
  protected readonly profile = inject(ProfileService);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly moreOpen = signal(false);
  protected readonly signingOut = signal(false);
  private readonly moreButton = viewChild<ElementRef<HTMLButtonElement>>('moreButton');
  private readonly moreSheet = viewChild<ElementRef<HTMLElement>>('moreSheet');

  protected readonly sync = computed(() => {
    if (!this.connectivity.online()) {
      return { icon: 'off', text: 'Offline', detail: 'Changes need a connection' };
    }
    if (this.library.saving()) return { icon: 'busy', text: 'Saving…', detail: '' };
    if (this.library.refreshing()) return { icon: 'busy', text: 'Syncing…', detail: '' };
    if (this.library.liveState() === 'reconnecting') {
      return { icon: 'busy', text: 'Reconnecting…', detail: 'Changes still save' };
    }
    if (this.library.loadState() === 'error') return { icon: 'off', text: 'Not synced', detail: '' };
    return { icon: 'ok', text: 'Synced', detail: 'Across your devices' };
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.moreOpen.set(false));
  }

  protected toggleMore(): void {
    this.moreOpen.update((v) => !v);
    if (this.moreOpen()) {
      queueMicrotask(() => this.moreSheet()?.nativeElement.querySelector<HTMLElement>('a, button')?.focus());
    }
  }

  @HostListener('document:keydown.escape')
  protected closeMore(): void {
    if (!this.moreOpen()) return;
    this.moreOpen.set(false);
    this.moreButton()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.moreOpen()) return;
    const target = event.target as Node;
    if (this.moreSheet()?.nativeElement.contains(target) || this.moreButton()?.nativeElement.contains(target)) return;
    this.moreOpen.set(false);
  }

  protected retry(): void {
    void this.library.refresh();
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
