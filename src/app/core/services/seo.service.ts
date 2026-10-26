import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { env } from '../config/env';

/** Pages anyone can see. Everything else is a private library page. */
const PUBLIC_PATHS = new Set(['/sign-in', '/register', '/forgot-password']);

/**
 * Keeps the canonical link, robots directive and og:url in step with the
 * current page: public pages are indexable, private library pages are not.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);
  private readonly siteUrl = env.siteUrl || this.document.location.origin;

  init(): void {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.update(e.urlAfterRedirects));
  }

  private update(url: string): void {
    const path = url.split(/[?#]/)[0] || '/';
    const isPublic = PUBLIC_PATHS.has(path);
    const canonical = `${this.siteUrl}${isPublic ? path : '/sign-in'}`;

    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = canonical;

    this.meta.updateTag({ name: 'robots', content: isPublic ? 'index, follow' : 'noindex, nofollow' });
    this.meta.updateTag({ property: 'og:url', content: canonical });
  }
}
