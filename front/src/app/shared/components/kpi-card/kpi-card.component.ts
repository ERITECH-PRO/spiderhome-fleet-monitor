import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export type KpiTone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="kpi-card" [class]="'tone-' + tone" [class.loading]="loading">
      <!-- Ambient glow corner -->
      <div class="kpi-glow-corner"></div>
      <!-- Bottom accent line -->
      <div class="kpi-bottom-line"></div>

      <div class="kpi-top">
        <div class="kpi-icon-wrap">
          <span class="kpi-icon">{{ icon }}</span>
        </div>
        <span class="kpi-label">{{ label }}</span>
      </div>

      <div class="kpi-value-wrap">
        <ng-container *ngIf="!loading; else skeleton">
          <div class="kpi-value mono">{{ value }}</div>
        </ng-container>
        <ng-template #skeleton>
          <div class="kpi-skeleton skeleton"></div>
        </ng-template>
      </div>

      <div class="kpi-hint" [class.hint-loading]="loading">
        <span *ngIf="!loading">{{ hint }}</span>
        <div *ngIf="loading" class="skeleton hint-skel"></div>
      </div>

      <div *ngIf="delta !== null" class="kpi-delta"
           [class.delta-up]="(delta ?? 0) > 0"
           [class.delta-down]="(delta ?? 0) < 0">
        <span>{{ (delta ?? 0) > 0 ? '▲' : '▼' }}</span>
        <span>{{ delta | number:'1.0-1' }}%</span>
      </div>
    </article>
  `,
  styles: [`
    :host { display: contents; }

    .kpi-card {
      position: relative;
      overflow: hidden;
      padding: 1.35rem 1.5rem;
      border: 1px solid rgba(140, 165, 255, 0.12);
      border-radius: 1.1rem;
      background: linear-gradient(145deg, rgba(16, 26, 56, 0.94), rgba(10, 16, 36, 0.9));
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.38);
      backdrop-filter: blur(20px);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s, border-color 0.25s;
      cursor: default;
      animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;

      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
        border-color: rgba(140, 165, 255, 0.24);
      }
    }

    /* Tone color mapping */
    .tone-ok    { --tone: var(--ok);   --tone-glow: var(--ok-glow);   --tone-bg: var(--ok-bg); }
    .tone-warn  { --tone: var(--warn); --tone-glow: var(--warn-glow); --tone-bg: var(--warn-bg); }
    .tone-crit  { --tone: var(--crit); --tone-glow: var(--crit-glow); --tone-bg: var(--crit-bg); }
    .tone-info  { --tone: var(--info); --tone-glow: var(--info-glow); --tone-bg: var(--info-bg); }
    .tone-neutral {
      --tone: #6366f1;
      --tone-glow: rgba(99, 102, 241, 0.35);
      --tone-bg: rgba(99, 102, 241, 0.12);
    }

    /* Top corner ambient glow */
    .kpi-glow-corner {
      position: absolute;
      top: -30px;
      right: -30px;
      width: 110px;
      height: 110px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--tone-glow, rgba(99, 102, 241, 0.2)), transparent 70%);
      pointer-events: none;
      transition: opacity 0.25s;
      opacity: 0.6;
    }
    .kpi-card:hover .kpi-glow-corner { opacity: 1; }

    /* Bottom accent line */
    .kpi-bottom-line {
      position: absolute;
      inset: auto 0 0 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--tone, #6366f1), transparent);
      opacity: 0.65;
      transition: opacity 0.25s;
    }
    .kpi-card:hover .kpi-bottom-line { opacity: 1; }

    /* Top row: icon wrap + label */
    .kpi-top {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .kpi-icon-wrap {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.65rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--tone-bg, rgba(99, 102, 241, 0.12));
      border: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    }

    .kpi-icon {
      font-size: 1.1rem;
      line-height: 1;
      filter: drop-shadow(0 0 6px var(--tone-glow, rgba(255, 255, 255, 0.15)));
    }

    .kpi-label {
      color: var(--muted);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    /* Value */
    .kpi-value-wrap { margin-bottom: 0.6rem; }

    .kpi-value {
      font-size: clamp(1.9rem, 3vw, 2.5rem);
      font-weight: 800;
      letter-spacing: -0.05em;
      line-height: 1;
      color: #f0f4ff;
      transition: color 0.3s;
    }

    .tone-ok   .kpi-value { color: #a7f3d0; }
    .tone-warn .kpi-value { color: #fde68a; }
    .tone-crit .kpi-value { color: #fca5a5; }
    .tone-info .kpi-value { color: #bae6fd; }

    .kpi-skeleton { height: 2.5rem; width: 55%; }

    /* Hint */
    .kpi-hint {
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.4;
    }
    .hint-skel { height: 0.8rem; width: 80%; margin-top: 4px; }

    /* Delta badge */
    .kpi-delta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 0.65rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .delta-up   { background: rgba(16, 185, 129, 0.15); color: var(--ok); }
    .delta-down { background: rgba(239, 68, 68, 0.15);  color: var(--crit); }
  `]
})
export class KpiCardComponent implements OnChanges {
  @Input() label   = '';
  @Input() value: string | number = '—';
  @Input() hint    = '';
  @Input() icon    = '📊';
  @Input() tone: KpiTone = 'neutral';
  @Input() loading = false;
  @Input() delta: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    // Hook for future animation on value change
  }
}
