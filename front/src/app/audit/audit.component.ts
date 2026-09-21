import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogService, AuditLogEntry } from '../services/audit-log.service';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

/**
 * Journal d'audit — cahier des charges §10 / REC-11.
 * Lecture seule : aucune action de modification n'existe sur cet écran,
 * à l'image de la table elle-même (voir back/app/Models/AuditLog.php).
 */
@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ButtonComponent, IconComponent],
  template: `
    <div class="page-header fade-up">
      <div>
        <h1 class="page-title"><app-icon name="warning" [size]="24"></app-icon> Journal d'audit</h1>
        <p class="page-sub">Trace immuable des actions sensibles — connexions, alertes, référentiel client (cahier §10)</p>
      </div>
      <div class="header-actions">
        <app-button variant="secondary" size="md" iconName="refresh" [isLoading]="refreshing" (btnClick)="refresh()">
          Actualiser
        </app-button>
      </div>
    </div>

    <div class="filter-bar fade-up">
      <input class="filter-input" placeholder="🔍 Filtrer par action (ex : alert.resolved, auth.login)…"
             [(ngModel)]="actionFilter" (ngModelChange)="onFilterChange($event)">
      <input class="filter-input" type="date" [(ngModel)]="fromFilter" (ngModelChange)="load()" title="À partir du">
      <input class="filter-input" type="date" [(ngModel)]="toFilter" (ngModelChange)="load()" title="Jusqu'au">
    </div>

    <div class="table-card fade-up">
      <div *ngIf="loading && entries.length === 0" class="table-loading">
        <div class="skeleton" style="height:2.6rem;margin-bottom:.5rem;" *ngFor="let i of [1,2,3,4,5,6,7,8]"></div>
      </div>

      <div *ngIf="hasError && !loading" class="empty-state">
        <span>⚠️</span>
        <p class="empty-title">Impossible de récupérer le journal</p>
        <app-button variant="secondary" size="sm" iconName="refresh" (btnClick)="refresh()">Réessayer</app-button>
      </div>

      <div class="table-scroll" *ngIf="(!loading || entries.length > 0) && !hasError">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:150px;">Date</th>
              <th>Action</th>
              <th>Auteur</th>
              <th>Objet concerné</th>
              <th>Détails</th>
              <th style="width:110px;">IP</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let e of entries">
              <td class="mono text-xs">{{ e.created_at | date:'dd/MM/yy HH:mm:ss' }}</td>
              <td><span class="action-pill">{{ e.action }}</span></td>
              <td>{{ e.user?.name || 'Système' }}</td>
              <td class="mono text-xs">{{ shortType(e.auditable_type) }}{{ e.auditable_id ? ' #' + e.auditable_id : '' }}</td>
              <td class="mono text-xs truncate-meta" [title]="e.meta ? (e.meta | json) : ''">{{ e.meta ? (e.meta | json) : '—' }}</td>
              <td class="mono text-xs">{{ e.ip_address || '—' }}</td>
            </tr>
            <tr *ngIf="!loading && entries.length === 0">
              <td colspan="6">
                <div class="empty-state">
                  <span>📋</span>
                  <p class="empty-title">Aucune entrée pour ces filtres</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-bar" *ngIf="totalPages > 1">
        <app-button variant="secondary" size="sm" iconName="chevron-left" [disabled]="page <= 1" (btnClick)="goPage(page - 1)">Précédent</app-button>
        <span class="page-info">Page {{ page }} / {{ totalPages }} — {{ total }} entrées</span>
        <app-button variant="secondary" size="sm" iconName="chevron-right" [disabled]="page >= totalPages" (btnClick)="goPage(page + 1)">Suivant</app-button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 1.75rem 2rem; max-width: 1440px; margin: 0 auto; }
    .header-actions { display: flex; align-items: center; gap: 0.75rem; }
    .text-xs { font-size: 0.72rem; }
    .truncate-meta { display: inline-block; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
    .action-pill {
      display: inline-flex; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
      background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--chip-text);
      font-family: 'JetBrains Mono', monospace;
    }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 1rem; color: var(--text-muted); text-align: center; }
    .empty-state span { font-size: 2rem; }
    .empty-title { font-size: 1rem; font-weight: 600; color: var(--text-secondary) !important; }
    .pagination-bar { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; }
    .page-info { font-size: 0.8rem; color: var(--text-muted); }
  `]
})
export class AuditComponent implements OnInit {
  entries: AuditLogEntry[] = [];
  loading = false;
  refreshing = false;
  hasError = false;
  actionFilter = '';
  fromFilter = '';
  toFilter = '';
  page = 1;
  totalPages = 1;
  total = 0;
  private filterSubject = new Subject<string>();

  constructor(private auditService: AuditLogService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.load();
    this.filterSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.load();
    });
  }

  onFilterChange(v: string) { this.filterSubject.next(v); }

  shortType(type: string | null): string {
    if (!type) return '—';
    return type.split('\\').pop() || type;
  }

  load() {
    this.loading = this.entries.length === 0;
    this.hasError = false;
    this.cdr.markForCheck();
    this.auditService.getAll({
      action: this.actionFilter || undefined,
      from: this.fromFilter || undefined,
      to: this.toFilter || undefined,
      page: this.page,
      per_page: 30,
    }).subscribe({
      next: (res) => {
        this.entries = res.data ?? [];
        this.totalPages = res.last_page ?? 1;
        this.total = res.total ?? this.entries.length;
        this.loading = false;
        this.refreshing = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.refreshing = false;
        this.hasError = true;
        this.cdr.markForCheck();
      }
    });
  }

  refresh() { this.refreshing = true; this.load(); }
  goPage(p: number) { this.page = p; this.load(); }
}
