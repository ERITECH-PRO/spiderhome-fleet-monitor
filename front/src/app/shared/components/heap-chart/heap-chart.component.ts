import {
  Component, Input, OnChanges, SimpleChanges,
  AfterViewInit, OnDestroy, ViewChild, ElementRef, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { Subscription } from 'rxjs';
import { HeapPoint, HeapThresholds } from '../../../services/dashboard.service';
import { ThemeService, AppTheme } from '../../../services/theme.service';

@Component({
  selector: 'app-heap-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <!-- Thresholds indicators -->
      <div class="thresholds-bar">
        <div class="thresh-pill thresh-sain">
          <span class="thresh-dot"></span>
          <span>Sain (&gt; 20 KB)</span>
        </div>
        <div class="thresh-pill thresh-surv">
          <span class="thresh-dot"></span>
          <span>Surveillance (10 - 20 KB)</span>
        </div>
        <div class="thresh-pill thresh-crit">
          <span class="thresh-dot"></span>
          <span>Critique (&lt; 10 KB)</span>
        </div>
      </div>

      <div class="chart-canvas-wrap">
        <div class="chart-empty" *ngIf="points.length === 0 && !loading">
          <span>📉</span>
          <span>Aucun relevé de mémoire disponible pour ce module</span>
        </div>
        <div class="chart-loading" *ngIf="loading">
          <div class="skeleton loading-bar"></div>
        </div>
        <canvas #chartCanvas [class.hidden]="points.length === 0 && !loading"></canvas>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .chart-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .thresholds-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .thresh-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid var(--border-card);
      background: var(--input-bg);
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }

    .thresh-sain {
      color: var(--ok-text);
      border-color: var(--ok-border);
      background: var(--ok-bg);
      .thresh-dot { background: var(--ok); box-shadow: 0 0 6px var(--ok-glow); }
    }

    .thresh-surv {
      color: var(--warn-text);
      border-color: var(--warn-border);
      background: var(--warn-bg);
      .thresh-dot { background: var(--warn); box-shadow: 0 0 6px var(--warn-glow); }
    }

    .thresh-crit {
      color: var(--crit-text);
      border-color: var(--crit-border);
      background: var(--crit-bg);
      .thresh-dot { background: var(--crit); box-shadow: 0 0 6px var(--crit-glow); }
    }

    .thresh-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }

    .chart-canvas-wrap {
      position: relative;
      height: 310px;
      width: 100%;
    }

    .chart-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 100%;
      color: var(--text-muted);
      font-size: 0.9rem;
      span:first-child { font-size: 2.2rem; }
    }

    .chart-loading {
      height: 100%;
      display: flex;
      align-items: flex-end;
    }

    .loading-bar {
      height: 100%;
      width: 100%;
      border-radius: var(--radius);
    }

    canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
      &.hidden { display: none; }
    }
  `]
})
export class HeapChartComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() points: HeapPoint[] = [];
  @Input() deviceSerial = '';
  @Input() thresholds: HeapThresholds = { sain_min: 20.0, surveillance_min: 10.0, critique_max: 10.0 };
  @Input() loading = false;

  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart: any;
  private themeSub!: Subscription;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.theme$.subscribe((theme) => {
      if (this.chart) {
        this.applyThemeToChart(theme);
        this.chart.update();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initChart();
    if (this.points.length) this.updateChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['points'] || changes['loading'] || changes['deviceSerial']) && this.chart) {
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.chart?.destroy();
  }

  private initChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const isLight = this.themeService.currentTheme === 'light';

    this.chart = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450, easing: 'easeInOutQuart' },
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(10, 16, 36, 0.96)',
            borderColor: isLight ? 'rgba(203, 213, 225, 0.9)' : 'rgba(140, 165, 255, 0.25)',
            borderWidth: 1,
            padding: 12,
            titleColor: isLight ? '#0f172a' : '#cbd5e1',
            bodyColor: isLight ? '#334155' : '#e2e8f0',
            callbacks: {
              title: (ctx: any) => `Date : ${ctx[0].label}`,
              label: (ctx: any) => {
                const y = ctx.parsed.y;
                let zone = 'Sain 🟢';
                if (y < 10) zone = 'Critique 🔴';
                else if (y < 20) zone = 'Surveillance 🟡';
                return [
                  ` Heap Libre : ${y.toFixed(2)} KB`,
                  ` État santé : ${zone}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: isLight ? '#64748b' : '#7a8caf', autoSkip: true, maxRotation: 0, font: { size: 10 } },
            grid: { color: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)' }
          },
          y: {
            min: 0,
            suggestedMax: 32,
            ticks: {
              color: isLight ? '#64748b' : '#7a8caf',
              font: { size: 10 },
              callback: (val) => `${val} KB`
            },
            grid: { color: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)' },
            title: { display: true, text: 'Mémoire Heap (KB)', color: isLight ? '#475569' : '#7a8caf', font: { size: 11, weight: 'bold' } }
          }
        }
      }
    });
  }

  private applyThemeToChart(theme: AppTheme): void {
    if (!this.chart) return;
    const isLight = theme === 'light';

    this.chart.options.scales.x.ticks.color = isLight ? '#64748b' : '#7a8caf';
    this.chart.options.scales.x.grid.color = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)';
    this.chart.options.scales.y.ticks.color = isLight ? '#64748b' : '#7a8caf';
    this.chart.options.scales.y.grid.color = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
    this.chart.options.scales.y.title.color = isLight ? '#475569' : '#7a8caf';

    this.chart.options.plugins.tooltip.backgroundColor = isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(10, 16, 36, 0.96)';
    this.chart.options.plugins.tooltip.borderColor = isLight ? 'rgba(203, 213, 225, 0.9)' : 'rgba(140, 165, 255, 0.25)';
    this.chart.options.plugins.tooltip.titleColor = isLight ? '#0f172a' : '#cbd5e1';
    this.chart.options.plugins.tooltip.bodyColor = isLight ? '#334155' : '#e2e8f0';
  }

  private updateChart(): void {
    if (!this.chart || this.loading || !this.points.length) return;

    const labels = this.points.map(p => {
      const d = new Date(p.timestamp);
      return isNaN(d.getTime()) ? p.timestamp : d.toLocaleString('fr-FR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    });

    const values = this.points.map(p => p.heap_kb);

    // Dynamic gradient under the curve based on current level
    const latestValue = values[values.length - 1] ?? 25;
    let strokeColor = '#10b981';
    let glowColor = 'rgba(16, 185, 129, 0.15)';

    if (latestValue < 10.0) {
      strokeColor = '#ef4444';
      glowColor = 'rgba(239, 68, 68, 0.18)';
    } else if (latestValue < 20.0) {
      strokeColor = '#f59e0b';
      glowColor = 'rgba(245, 158, 11, 0.18)';
    }

    const datasets = [
      {
        label: this.deviceSerial || 'Heap (KB)',
        data: values,
        borderColor: strokeColor,
        backgroundColor: glowColor,
        fill: true,
        borderWidth: 2.5,
        pointRadius: this.points.length > 50 ? 1 : 3,
        pointHoverRadius: 6,
        pointBackgroundColor: strokeColor,
        tension: 0.35,
        spanGaps: true,
      },
      // Seuil Surveillance 20 KB
      {
        label: 'Seuil Sain (20 KB)',
        data: this.points.map(() => 20.0),
        borderColor: 'rgba(16, 185, 129, 0.35)',
        borderDash: [5, 5],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
      // Seuil Critique 10 KB
      {
        label: 'Seuil Critique (10 KB)',
        data: this.points.map(() => 10.0),
        borderColor: 'rgba(239, 68, 68, 0.45)',
        borderDash: [4, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      }
    ];

    this.chart.data.labels = labels;
    this.chart.data.datasets = datasets;
    this.applyThemeToChart(this.themeService.currentTheme);
    this.chart.update();
  }
}
