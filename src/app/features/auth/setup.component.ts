import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-form.scss',
  template: `
    <h1>Almost ready</h1>
    <p class="intro">This library isn't connected to its cloud database yet.</p>
    <div class="notice">
      <h2>For the site owner</h2>
      <p>Set <code>SUPABASE_URL</code> and <code>SUPABASE_PUBLISHABLE_KEY</code> as environment variables (or in a local <code>.env</code> file), then rebuild. The README walks through it.</p>
    </div>
  `,
})
export class SetupComponent {}
