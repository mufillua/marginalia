import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../shared/components/empty-state.component';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent],
  template: `
    <div class="page">
      <app-empty-state art="search" heading="This page has been torn out" message="The link may be old, or the page never existed.">
        <a routerLink="/" class="btn btn-primary">Go home</a>
        <a routerLink="/shelf" class="btn">My books</a>
      </app-empty-state>
    </div>
  `,
})
export class NotFoundComponent {}
