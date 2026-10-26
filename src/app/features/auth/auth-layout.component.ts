import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <div class="frame">
      <aside class="leaf-side" aria-hidden="true">
        <span class="mark">Marginalia</span>
        <figure>
          <blockquote>
            <span>There is no Frigate like a Book</span>
            <span>To take us Lands away</span>
          </blockquote>
          <figcaption>Emily Dickinson</figcaption>
        </figure>
        <svg class="botanical" viewBox="0 0 220 260">
          <path class="stem" d="M110 258C108 200 96 150 70 104 52 72 40 44 44 10" />
          <path class="stem" d="M104 190c14-30 40-52 76-60" />
          <path class="stem" d="M96 140c-20-14-44-18-70-12" />
          <path class="leaf" d="M44 10c-14 10-16 30-4 40 10-12 12-28 4-40z" />
          <path class="leaf" d="M58 64c-22-2-34 12-34 12s18 12 34-12z" />
          <path class="leaf" d="M72 92c20-8 36 2 36 2s-16 16-36-2z" />
          <path class="leaf" d="M180 130c-10 18-30 24-30 24s0-22 30-24z" />
          <path class="leaf" d="M150 150c-18-6-30 4-30 4s14 12 30-4z" />
          <path class="leaf" d="M26 128c-4 16 6 28 6 28s14-14-6-28z" />
          <path class="leaf" d="M64 132c10 14 4 28 4 28s-18-6-4-28z" />
          <circle class="bud" cx="181" cy="128" r="5" />
          <circle class="bud" cx="44" cy="9" r="4" />
        </svg>
      </aside>
      <main class="form-side">
        <div class="form-wrap">
          <span class="mark small">Marginalia</span>
          <router-outlet />
        </div>
        <footer class="credit">
          <a href="https://maimoondigital.vercel.app/" target="_blank" rel="noopener">
            Designed and developed by Maimoon Digital<span class="visually-hidden"> (opens in a new tab)</span>
          </a>
        </footer>
      </main>
    </div>
  `,
  styles: `
    .frame {
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
      min-height: 100dvh;
    }
    .leaf-side {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: var(--s-7);
      background: var(--forest);
      /* --on-forest is ivory in light mode and near-black in dark mode, where
         the panel turns light sage, so the text always contrasts. */
      color: var(--on-forest);
      overflow: hidden;
    }
    .mark {
      font-family: var(--serif);
      font-style: italic;
      font-size: 1.75rem;
      font-weight: 380;
      letter-spacing: -0.02em;
    }
    figure {
      margin: 0;
      position: relative;
      z-index: 1;
      container-type: inline-size;
    }
    blockquote span {
      display: block;
    }
    blockquote {
      margin: 0;
      font-family: var(--serif);
      font-size: clamp(1.2rem, 6.2cqi, 2.6rem);
      font-weight: 340;
      line-height: 1.22;
      letter-spacing: -0.015em;
    }
    figcaption {
      margin-top: var(--s-4);
      font-size: var(--step-0);
      color: color-mix(in srgb, var(--on-forest) 78%, var(--forest));
    }
    .botanical {
      position: absolute;
      right: -30px;
      bottom: -10px;
      width: min(52%, 300px);
      fill: none;
      stroke: color-mix(in srgb, var(--on-forest) 30%, var(--forest));
      stroke-width: 1.4;
      stroke-linecap: round;
    }
    .botanical .leaf {
      fill: color-mix(in srgb, var(--on-forest) 7%, transparent);
    }
    .botanical .bud {
      fill: #d8b9b4;
      stroke: none;
    }
    .form-side {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--s-7) clamp(20px, 6vw, 72px) var(--s-5);
    }
    .form-wrap {
      width: min(400px, 100%);
      margin-block: auto;
    }
    .credit {
      margin-top: var(--s-7);
      font-size: var(--step--1);
      text-align: center;
    }
    .credit a {
      color: var(--ink-soft);
      text-decoration-color: var(--rule-strong);
    }
    .credit a:hover {
      color: var(--ink);
      text-decoration-color: currentColor;
    }
    .mark.small {
      display: none;
      color: var(--ink);
      margin-bottom: var(--s-6);
    }
    @media (max-width: 820px) {
      .frame {
        grid-template-columns: 1fr;
      }
      .leaf-side {
        display: none;
      }
      .form-side {
        padding-top: var(--s-8);
      }
      .form-wrap {
        margin-block: 0 auto;
      }
      .mark.small {
        display: block;
      }
    }
  `,
})
export class AuthLayoutComponent {}
