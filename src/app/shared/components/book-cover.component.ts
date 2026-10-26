import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { authorLine, hashString } from '../utils/text';

/** Cloth colours for books without a cover image. */
const CLOTHS = [
  { bg: '#34483b', fg: '#efe7da', accent: '#a8b5a0' }, // forest
  { bg: '#7d8c74', fg: '#f8f5ef', accent: '#e6dccb' }, // sage
  { bg: '#b48f88', fg: '#fbf6f2', accent: '#f1e3df' }, // rose
  { bg: '#79675b', fg: '#f3ebdf', accent: '#d8c7b3' }, // cocoa
  { bg: '#3e4c5e', fg: '#ece6dc', accent: '#b9c3cf' }, // ink blue
  { bg: '#5e4652', fg: '#f3e8ea', accent: '#d8b9b4' }, // plum
  { bg: '#9c8150', fg: '#fbf5e8', accent: '#efe2c4' }, // ochre
  { bg: '#e6dccb', fg: '#34483b', accent: '#79675b' }, // linen
];

/**
 * A book cover. Shows the real cover when there is one; otherwise draws a
 * cloth-bound edition in a colour and layout derived from the title, so
 * missing covers never all look the same.
 */
@Component({
  selector: 'app-book-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cover',
    '[class.has-ribbon]': 'ribbon()',
    '[style.--cloth-bg]': 'cloth().bg',
    '[style.--cloth-fg]': 'cloth().fg',
    '[style.--cloth-accent]': 'cloth().accent',
  },
  template: `
    @if (showImage()) {
      <img
        [src]="coverUrl()"
        [alt]="decorative() ? '' : altText()"
        [attr.loading]="eager() ? 'eager' : 'lazy'"
        decoding="async"
        referrerpolicy="no-referrer"
        (error)="failed.set(true)"
        (load)="onLoad($event)"
      />
    } @else {
      <div class="cloth" [class]="'layout-' + layout()" [attr.role]="decorative() ? null : 'img'" [attr.aria-label]="decorative() ? null : altText()">
        <div class="cloth-inner" aria-hidden="true">
          <span class="cloth-title">{{ title() }}</span>
          <span class="cloth-rule"></span>
          <span class="cloth-author">{{ author() }}</span>
        </div>
      </div>
    }
    @if (ribbon()) {
      <svg class="ribbon" viewBox="0 0 14 40" aria-hidden="true"><path d="M0 0h14v40l-7-6-7 6z" /></svg>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      aspect-ratio: 2 / 3;
      border-radius: 2px 4px 4px 2px;
      background: var(--leaf-deep);
      box-shadow: var(--shadow-book);
      container-type: inline-size;
      isolation: isolate;
    }
    /* spine shading and a hint of page edge, over image and cloth alike */
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background:
        linear-gradient(90deg, rgb(0 0 0 / 0.2) 0, rgb(0 0 0 / 0.04) 3.5%, rgb(255 255 255 / 0.16) 5%, rgb(255 255 255 / 0) 9%),
        linear-gradient(0deg, rgb(255 255 255 / 0.05), rgb(255 255 255 / 0));
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.06);
      z-index: 2;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
    }
    .cloth {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background-color: var(--cloth-bg);
      background-image: repeating-linear-gradient(45deg, rgb(255 255 255 / 0.025) 0 2px, transparent 2px 4px),
        repeating-linear-gradient(-45deg, rgb(0 0 0 / 0.03) 0 2px, transparent 2px 4px);
      color: var(--cloth-fg);
      padding: 9cqi 9cqi 9cqi 12cqi;
    }
    .cloth-inner {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 4cqi;
      border: 1px solid color-mix(in srgb, var(--cloth-accent) 55%, transparent);
      padding: 8cqi 7cqi;
      overflow: hidden;
    }
    .cloth-title {
      font-family: var(--serif);
      font-style: italic;
      font-weight: 420;
      font-size: max(9px, 11.5cqi);
      line-height: 1.12;
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .cloth-rule {
      width: 18cqi;
      height: 1px;
      background: var(--cloth-accent);
      flex: none;
    }
    .cloth-author {
      font-family: var(--sans);
      font-size: max(7px, 6.4cqi);
      letter-spacing: 0.04em;
      opacity: 0.85;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .layout-1 .cloth-inner {
      justify-content: flex-end;
    }
    .layout-2 .cloth-inner {
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .layout-2 .cloth-title {
      font-style: normal;
      font-weight: 500;
    }
    .ribbon {
      position: absolute;
      top: -2px;
      right: 14%;
      width: 9%;
      min-width: 9px;
      max-width: 16px;
      fill: var(--rose);
      z-index: 3;
      filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.18));
    }
  `,
})
export class BookCoverComponent {
  readonly title = input.required<string>();
  readonly authors = input<string[]>([]);
  readonly coverUrl = input<string | null>(null);
  /** True when a visible title sits next to the cover (alt text would repeat it). */
  readonly decorative = input(false);
  readonly eager = input(false);
  /** Rose bookmark ribbon for books in progress. */
  readonly ribbon = input(false);

  protected readonly failed = linkedSignal({ source: this.coverUrl, computation: () => false });
  protected readonly showImage = computed(() => !!this.coverUrl() && !this.failed());
  protected readonly author = computed(() => authorLine(this.authors()));
  protected readonly altText = computed(() =>
    this.author() ? `Cover of ${this.title()} by ${this.author()}` : `Cover of ${this.title()}`,
  );
  private readonly hash = computed(() => hashString(this.title() + this.author()));
  protected readonly cloth = computed(() => CLOTHS[this.hash() % CLOTHS.length]);
  protected readonly layout = computed(() => (this.hash() >> 3) % 3);

  protected onLoad(event: Event): void {
    // Google Books serves a tiny "image not available" placeholder for some volumes.
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth > 0 && img.naturalWidth < 20) this.failed.set(true);
  }
}
