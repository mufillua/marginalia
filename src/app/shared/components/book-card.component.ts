import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideHeart } from '@lucide/angular';
import { progressPercent } from '../../core/data/books.service';
import { Book } from '../../core/models/models';
import { formatShortDate } from '../utils/dates';
import { authorLine } from '../utils/text';
import { BookCoverComponent } from './book-cover.component';
import { ProgressLineComponent } from './progress-line.component';
import { StarRatingComponent } from './star-rating.component';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-book-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BookCoverComponent, StatusBadgeComponent, StarRatingComponent, ProgressLineComponent, LucideHeart],
  host: { '[class]': "'card-' + view()" },
  template: `
    <div class="cover-link">
      <app-book-cover
        [title]="book().title"
        [authors]="book().authors"
        [coverUrl]="book().coverUrl"
        [decorative]="true"
        [ribbon]="book().status === 'reading'"
      />
    </div>
    <div class="body">
      <h3 class="title">
        <a [routerLink]="['/book', book().id]">{{ book().title }}</a>
        @if (book().isFavorite) {
          <svg lucideHeart class="fav" [size]="14" aria-label="Favourite" role="img"></svg>
        }
      </h3>
      <p class="author">{{ author() }}</p>
      <div class="meta">
        <app-status-badge [status]="book().status" [short]="view() === 'grid'" />
        @if (book().rating !== null) {
          <app-star-rating [value]="book().rating" [size]="12" />
        }
      </div>
      @if (book().status === 'reading' && percent() !== null) {
        <app-progress-line [percent]="percent()!" [label]="'Progress in ' + book().title" />
      }
      @if (view() === 'list') {
        <div class="list-extra">
          @if (book().genres.length) {
            <span class="genres">{{ book().genres.slice(0, 3).join(', ') }}</span>
          }
          <span class="added">{{ dateLine() }}</span>
        </div>
      } @else if (book().genres.length) {
        <p class="genre">{{ book().genres[0] }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .cover-link {
      display: block;
      border-radius: 4px;
      transition: transform var(--dur) var(--ease);
    }
    :host(.card-grid):hover .cover-link {
      transform: translateY(-4px) rotate(-0.6deg);
    }
    .body {
      display: grid;
      gap: 4px;
      padding-top: var(--s-3);
      min-width: 0;
    }
    .title {
      font-size: var(--step-1);
      font-weight: 460;
      line-height: 1.25;
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .title a {
      color: var(--ink);
      text-decoration: none;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .title a:hover {
      text-decoration: underline;
      text-decoration-color: var(--rose);
      text-decoration-thickness: 2px;
    }
    .title a::after {
      /* makes the whole card clickable while keeping one focus stop */
      content: '';
      position: absolute;
      inset: 0;
    }
    :host {
      position: relative;
    }
    .fav {
      flex: none;
      color: var(--rose-ink);
      fill: var(--rose);
      position: relative;
      top: 1px;
    }
    .author {
      font-size: var(--step--1);
      color: var(--ink-soft);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 10px;
      margin-top: 2px;
    }
    .genre {
      font-size: var(--step--1);
      color: var(--ink-faint);
      font-style: italic;
      font-family: var(--serif);
    }
    app-progress-line {
      margin-top: 4px;
    }

    /* list view */
    :host(.card-list) {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr);
      gap: var(--s-4);
      align-items: start;
      padding: var(--s-4) 0;
      border-bottom: 1px solid var(--rule);
    }
    :host(.card-list) .body {
      padding-top: 0;
    }
    :host(.card-list) .title {
      font-size: var(--step-2);
    }
    :host(.card-list) app-progress-line {
      max-width: 280px;
    }
    .list-extra {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      font-size: var(--step--1);
      color: var(--ink-faint);
    }
  `,
})
export class BookCardComponent {
  readonly book = input.required<Book>();
  readonly view = input<'grid' | 'list'>('grid');
  protected readonly author = computed(() => authorLine(this.book().authors));
  protected readonly percent = computed(() => progressPercent(this.book()));
  protected readonly dateLine = computed(() => {
    const b = this.book();
    if (b.status === 'completed' && b.finishedOn) return `Finished ${formatShortDate(b.finishedOn)}`;
    if (b.startedOn && b.status === 'reading') return `Started ${formatShortDate(b.startedOn)}`;
    return `Added ${formatShortDate(b.createdAt)}`;
  });
}
