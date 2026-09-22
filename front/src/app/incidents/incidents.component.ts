import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService, DeviceAlert } from '../services/alert.service';
import { UserService, AppUser } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { ModalComponent } from '../shared/components/modal/modal.component';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';

/**
 * Incidents — cahier des charges §7.3 / §12 :
 * « Incidents : file priorisée, assignation et diagnostic. »
 *
 * Un incident EST une alerte (App\Models\Alert) : chaque occurrence
 * répétée d'un même type sur un module est regroupée côté backend
 * (voir FleetSyncService::upsertIncident) plutôt que dupliquée ici.
 */
@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ModalComponent, ButtonComponent, IconComponent],
  template: `
    <div class="page-header fade-up">
      <div>
        <h1 class="page-title"><app-icon name="warning" [size]="24"></app-icon> Incidents</h1>
        <p class="page-sub">File priorisée des incidents du parc — cahier §7.3 / §12</p>
      </div>
      <app-button variant="secondary" size="md" iconName="refresh" [isLoading]="refreshing" (btnClick)="refresh()">
        Actualiser
      </app-button>
    </div>

    <div class="filter-bar fade-up">
      <select class="filter-select" [(ngModel)]="filters.status" (ngModelChange)="load()">
        <option value="">Tous statuts</option>
        <option value="open">Ouvert</option>
        <option value="acknowledged">Accusé réception</option>
        <option value="resolved">Résolu</option>
      </select>
      <select class="filter-select" [(ngModel)]="filters.priority" (ngModelChange)="load()">
        <option value="">Toutes priorités</option>
        <option value="critical">Critique</option>
        <option value="high">Haute</option>
        <option value="normal">Normale</option>
        <option value="low">Basse</option>
      </select>
      <select class="filter-select" [(ngModel)]="filters.severity" (ngModelChange)="load()">
        <option value="">Toutes gravités</option>
        <option value="critical">Critique</option>
        <option value="warning">Avertissement</option>
        <option value="info">Information</option>
      </select>
      <label class="filter-checkbox">
        <input type="checkbox" [(ngModel)]="filters.unassigned" (ngModelChange)="load()">
        Non assignés uniquement
      </label>
    </div>

    <div class="table-card fade-up">
      <div *ngIf="loading && incidents.length === 0" class="table-loading">
        <div class="skeleton" style="height:3rem;margin-bottom:.5rem;" *ngFor="let i of [1,2,3,4,5,6]"></div>
      </div>

      <div *ngIf="hasError && !loading" class="empty-state">
        <span>⚠️</span>
        <p class="empty-title">Impossible de récupérer les incidents</p>
        <app-button variant="secondary" size="sm" iconName="refresh" (btnClick)="refresh()">Réessayer</app-button>
      </div>

      <div class="table-scroll" *ngIf="(!loading || incidents.length > 0) && !hasError">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:90px;">Priorité</th>
              <th>Type</th>
              <th>Module</th>
              <th style="width:70px;">Occ.</th>
              <th>Dernière occurrence</th>
              <th>Propriétaire</th>
              <th style="width:110px;">Statut</th>
              <th style="width:150px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let inc of incidents" [class.row-critical]="inc.priority === 'critical'">
              <td><span class="prio-pill" [ngClass]="'prio-' + (inc.priority || 'normal')">{{ priorityLabel(inc.priority) }}</span></td>
              <td>
                <div class="type-cell">{{ inc.type }}</div>
                <div class="msg-cell text-xs text-muted">{{ inc.message }}</div>
              </td>
              <td class="mono text-xs">{{ inc.device?.label || inc.device?.serial_number || '—' }}</td>
              <td class="text-center">{{ inc.occurrences || 1 }}</td>
              <td class="mono text-xs">{{ (inc.last_occurred_at || inc.created_at) | date:'dd/MM/yy HH:mm' }}</td>
              <td>
                <select class="owner-select" [ngModel]="inc.owner?.id ?? null" (ngModelChange)="assign(inc, $event)"
                        [disabled]="!auth.canManageAlerts()">
                  <option [ngValue]="null">— Non assigné —</option>
                  <option *ngFor="let u of staff" [ngValue]="u.id">{{ u.name }}</option>
                </select>
              </td>
              <td><span class="status-pill" [ngClass]="'status-' + inc.status">{{ statusLabel(inc.status) }}</span></td>
              <td>
                <div class="row-actions" *ngIf="auth.canManageAlerts()">
                  <app-button variant="icon" size="sm" iconName="note" ariaLabel="Diagnostic" tooltip="Diagnostic" (btnClick)="openDiagnostic(inc)"></app-button>
                  <app-button variant="icon" size="sm" iconName="check" ariaLabel="Acquitter" tooltip="Acquitter" *ngIf="inc.status === 'open'" (btnClick)="ack(inc)"></app-button>
                  <app-button variant="icon" size="sm" iconName="check-circle" ariaLabel="Résoudre" tooltip="Résoudre" *ngIf="inc.status !== 'resolved'" (btnClick)="resolveIt(inc)"></app-button>
                  <app-button variant="icon" size="sm" iconName="refresh" ariaLabel="Réouvrir" tooltip="Réouvrir" *ngIf="inc.status === 'resolved'" (btnClick)="reopenIt(inc)"></app-button>
                </div>
              </td>
            </tr>
            <tr *ngIf="!loading && incidents.length === 0">
              <td colspan="8">
                <div class="empty-state">
                  <span>✅</span>
                  <p class="empty-title">Aucun incident pour ces filtres</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL DIAGNOSTIC -->
    <app-modal [isOpen]="showDiagModal" title="Diagnostic de l'incident" icon="🩺" size="md" [hasFooter]="true" (close)="showDiagModal = false">
      <div class="popup-field form-col-full">
        <label class="popup-label">Notes de diagnostic</label>
        <textarea class="popup-input" rows="6" [(ngModel)]="diagnosticDraft" name="diagnostic"
                  placeholder="Cause identifiée, actions menées, recommandation…"></textarea>
      </div>
      <div modal-footer class="popup-footer-actions">
        <app-button variant="secondary" size="md" (btnClick)="showDiagModal = false">Annuler</app-button>
        <app-button variant="primary" size="md" [isLoading]="savingDiag" (btnClick)="saveDiagnostic()">Enregistrer</app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    :host { display: block; padding: 1.75rem 2rem; max-width: 1440px; margin: 0 auto; }
    .filter-checkbox { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--text-secondary); }
    .text-xs { font-size: 0.74rem; }
    .text-center { text-align: center; }
    .row-actions { display: flex; gap: 0.3rem; }
    .type-cell { font-weight: 600; font-size: 0.85rem; }
    .msg-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .owner-select { font-size: 0.78rem; padding: 0.3rem 0.5rem; border-radius: 0.4rem; border: 1px solid var(--border-color); background: var(--input-bg, transparent); color: inherit; max-width: 160px; }
    .row-critical { background: rgba(239, 68, 68, 0.04); }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 1rem; color: var(--text-muted); text-align: center; }
    .empty-state span { font-size: 2rem; }
    .empty-title { font-size: 1rem; font-weight: 600; color: var(--text-secondary) !important; }
    .prio-pill, .status-pill {
      display: inline-flex; padding: 2px 9px; border-radius: 999px; font-size: 0.7rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.03em;
    }
    .prio-critical { background: rgba(239,68,68,.15); color: #f87171; border: 1px solid rgba(239,68,68,.35); }
    .prio-high     { background: rgba(249,115,22,.15); color: #fb923c; border: 1px solid rgba(249,115,22,.35); }
    .prio-normal   { background: rgba(59,130,246,.15); color: #60a5fa; border: 1px solid rgba(59,130,246,.35); }
    .prio-low      { background: rgba(148,163,184,.15); color: #94a3b8; border: 1px solid rgba(148,163,184,.35); }
    .status-open         { background: rgba(239,68,68,.12); color: #f87171; }
    .status-acknowledged { background: rgba(234,179,8,.12); color: #facc15; }
    .status-resolved     { background: rgba(34,197,94,.12); color: #4ade80; }
  `]
})
export class IncidentsComponent implements OnInit {
  incidents: DeviceAlert[] = [];
  staff: AppUser[] = [];
  loading = false;
  refreshing = false;
  hasError = false;
  filters: { status: string; priority: string; severity: string; unassigned: boolean } = {
    status: 'open', priority: '', severity: '', unassigned: false
  };
  showDiagModal = false;
  diagnosticDraft = '';
  savingDiag = false;
  private diagTarget: DeviceAlert | null = null;

  constructor(
    private alertService: AlertService,
    private userService: UserService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
    this.userService.getAll().subscribe({
      next: (res) => {
        this.staff = (res.users || []).filter(u => u.role !== 'client');
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  priorityLabel(p?: string): string {
    return { critical: 'Critique', high: 'Haute', normal: 'Normale', low: 'Basse' }[p || 'normal'] || 'Normale';
  }

  statusLabel(s: string): string {
    return { open: 'Ouvert', acknowledged: 'Accusé', resolved: 'Résolu' }[s] || s;
  }

  load() {
    this.loading = this.incidents.length === 0;
    this.hasError = false;
    this.cdr.markForCheck();
    this.alertService.getAlerts({
      status: (this.filters.status as any) || undefined,
      priority: this.filters.priority || undefined,
      severity: (this.filters.severity as any) || undefined,
      unassigned: this.filters.unassigned || undefined,
      hours: 720,
      sort: 'created_at',
      order: 'desc',
      per_page: 100,
    }).subscribe({
      next: (res) => {
        this.incidents = res.data ?? [];
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

  assign(inc: DeviceAlert, ownerId: number | null) {
    this.alertService.assign(inc.id, ownerId).subscribe({
      next: (updated) => { inc.owner = updated.owner; this.cdr.markForCheck(); }
    });
  }

  openDiagnostic(inc: DeviceAlert) {
    this.diagTarget = inc;
    this.diagnosticDraft = inc.diagnostic || '';
    this.showDiagModal = true;
    this.cdr.markForCheck();
  }

  saveDiagnostic() {
    if (!this.diagTarget) return;
    this.savingDiag = true;
    this.cdr.markForCheck();
    this.alertService.setDiagnostic(this.diagTarget.id, this.diagnosticDraft).subscribe({
      next: (updated) => {
        if (this.diagTarget) this.diagTarget.diagnostic = updated.diagnostic;
        this.savingDiag = false;
        this.showDiagModal = false;
        this.cdr.markForCheck();
      },
      error: () => { this.savingDiag = false; this.cdr.markForCheck(); }
    });
  }

  ack(inc: DeviceAlert) {
    this.alertService.acknowledge(inc.id).subscribe({ next: () => this.load() });
  }

  resolveIt(inc: DeviceAlert) {
    this.alertService.resolve(inc.id).subscribe({ next: () => this.load() });
  }

  reopenIt(inc: DeviceAlert) {
    this.alertService.reopen(inc.id).subscribe({ next: () => this.load() });
  }
}
