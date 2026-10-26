import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProfileService } from './core/data/profile.service';
import { SeoService } from './core/services/seo.service';
import { DialogHostComponent } from './shared/components/dialog-host.component';
import { ToastHostComponent } from './shared/components/toast-host.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHostComponent, DialogHostComponent],
  template: `
    <router-outlet />
    <app-toast-host />
    <app-dialog-host />
  `,
})
export class App {
  // Instantiated here so the reader's theme applies before any page renders.
  private readonly profile = inject(ProfileService);

  constructor() {
    inject(SeoService).init();
  }
}
