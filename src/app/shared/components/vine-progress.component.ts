import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';

interface Leaf {
  x: number;
  y: number;
  angle: number;
  at: number; // 0–100 position along the stem
  side: 1 | -1;
}

const STEM =
  'M4 32 C 60 10, 110 50, 170 30 S 280 10, 340 30 S 450 52, 510 28 S 580 18, 616 26';
const LEAF_COUNT = 9;

/**
 * Reading progress drawn as a growing sprig: the stem is drawn to the
 * current percentage and leaves unfurl along the way.
 */
@Component({
  selector: 'app-vine-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'clamped()',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuetext]': 'valueText() || null',
  },
  template: `
    <svg viewBox="0 0 620 60" aria-hidden="true">
      <path class="track" [attr.d]="stem" pathLength="100" />
      <path #stemPath class="stem" [attr.d]="stem" pathLength="100" [style.stroke-dashoffset]="100 - clamped()" />
      @for (leaf of leaves(); track leaf.at) {
        <g
          class="leaf"
          [class.shown]="leaf.at <= clamped()"
          [attr.transform]="'translate(' + leaf.x + ' ' + leaf.y + ') rotate(' + (leaf.angle + leaf.side * 38) + ')'"
        >
          <path d="M0 0 C 5 -7, 15 -7, 20 0 C 15 7, 5 7, 0 0 Z" />
          <path class="vein" d="M2 0 L 16 0" />
        </g>
      }
      @if (tip(); as t) {
        <circle class="bud" [attr.cx]="t.x" [attr.cy]="t.y" r="4.5" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      aspect-ratio: 620 / 60;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .track {
      fill: none;
      stroke: var(--rule-strong);
      stroke-width: 1.2;
      stroke-dasharray: 0.5 1;
    }
    .stem {
      fill: none;
      stroke: var(--forest);
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-dasharray: 100;
      transition: stroke-dashoffset 900ms var(--ease);
    }
    .leaf {
      opacity: 0;
      transition: opacity 400ms var(--ease);
    }
    .leaf path:first-child {
      fill: var(--sage);
      stroke: var(--forest);
      stroke-width: 0.8;
      transform-box: fill-box;
      transform-origin: left center;
      transform: scale(0.2);
      transition: transform 500ms var(--ease);
    }
    .leaf .vein {
      fill: none;
      stroke: var(--forest);
      stroke-width: 0.6;
      opacity: 0.6;
    }
    .leaf.shown {
      opacity: 1;
    }
    .leaf.shown path:first-child {
      transform: scale(1);
    }
    .bud {
      fill: var(--rose);
      stroke: var(--rose-ink);
      stroke-width: 1;
      transition:
        cx 900ms var(--ease),
        cy 900ms var(--ease);
    }
  `,
})
export class VineProgressComponent {
  readonly percent = input.required<number>();
  readonly label = input('Reading progress');
  readonly valueText = input<string>('');

  protected readonly stem = STEM;
  private readonly stemPath = viewChild<ElementRef<SVGPathElement>>('stemPath');
  protected readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.percent() || 0))));
  protected readonly leaves = signal<Leaf[]>([]);
  private readonly points = signal<{ x: number; y: number }[]>([]);
  protected readonly tip = computed(() => {
    const pts = this.points();
    if (!pts.length || this.clamped() <= 0) return null;
    return pts[Math.min(pts.length - 1, Math.round((this.clamped() / 100) * (pts.length - 1)))];
  });

  constructor() {
    afterNextRender(() => {
      const path = this.stemPath()?.nativeElement;
      if (!path || typeof path.getTotalLength !== 'function') return;
      const total = path.getTotalLength();
      const samples: { x: number; y: number }[] = [];
      for (let i = 0; i <= 100; i++) {
        const p = path.getPointAtLength((total * i) / 100);
        samples.push({ x: p.x, y: p.y });
      }
      this.points.set(samples);
      const leaves: Leaf[] = [];
      for (let i = 1; i <= LEAF_COUNT; i++) {
        const at = Math.round((i / (LEAF_COUNT + 1)) * 100);
        const a = samples[Math.max(0, at - 1)];
        const b = samples[Math.min(100, at + 1)];
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
        leaves.push({ x: samples[at].x, y: samples[at].y, angle, at, side });
      }
      this.leaves.set(leaves);
    });
  }
}
