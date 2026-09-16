import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService, Device } from '../services/device.service';
import { SiteService, Site } from '../services/site.service';
import { DeviceModelService, DeviceModel } from '../services/device-model.service';
import { CustomerService, Customer } from '../services/customer.service';
import { PageCacheService } from '../services/page-cache.service';
import { ModalComponent } from '../shared/components/modal/modal.component';
import { ConfirmModalComponent } from '../shared/components/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';
import { DeviceHealthModalComponent } from './device-health-modal.component';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, ModalComponent, ConfirmModalComponent, ButtonComponent, IconComponent, DeviceHealthModalComponent],
  template: `
    <!-- Header —— Supervision uniquement, pas de création manuelle -->
    <div class="page-header fade-up">
      <div>
        <h1 class="page-title"><app-icon name="signal" [size]="24"></app-icon> Modules & Appareils IoT</h1>
        <p class="page-sub">Registre de supervision du parc — les modules apparaissent automatiquement lors de leur première communication</p>
      </div>
      <div class="header-actions">
        <app-button variant="secondary" size="md" iconName="refresh" [isLoading]="refreshing" (btnClick)="refresh()">
          Actualiser
        </app-button>
      </div>
    </div>

    <!-- Multi-Filter Bar -->
    <div class="filter-bar fade-up">
      <input class="filter-input" placeholder="🔍 GUID, IP, MAC, n° série, modèle, label…"
             [(ngModel)]="search" (ngModelChange)="onSearch($event)">
      <select class="filter-select" [(ngModel)]="customerFilter" (ngModelChange)="onCustomerChange()">
        <option value="">Tous les clients</option>
        <option *ngFor="let c of allCustomers" [value]="c.id">{{ c.name }}</option>
      </select>
      <select class="filter-select" [(ngModel)]="siteFilter" (ngModelChange)="onSiteChange()">
        <option value="">Tous les sites</option>
        <option *ngFor="let s of filteredSites" [value]="s.id">{{ s.name }}</option>
      </select>
      <select class="filter-select" [(ngModel)]="modelFilter" (ngModelChange)="onFilterChange()">
        <option value="">Tous les modèles</option>
        <option *ngFor="let m of allModels" [value]="m.id">{{ m.name }}</option>
      </select>
      <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
        <option value="">Tous les statuts</option>
        <option value="online">🟢 En ligne</option>
        <option value="offline">🔴 Hors ligne</option>
        <option value="alert">🟡 En alerte</option>
        <option value="retired">⚪ Retiré</option>
      </select>
      <app-button *ngIf="hasActiveFilters()" variant="secondary" size="sm" iconName="refresh" (btnClick)="resetFilters()">
        Réinitialiser
      </app-button>
    </div>

    <!-- Table Card -->
    <div class="table-card fade-up">
      <div *ngIf="loading" class="table-loading">
        <div class="skeleton" style="height:3.2rem;margin-bottom:.5rem;" *ngFor="let i of [1,2,3,4,5]"></div>
      </div>
      <!-- Error state -->
      <div *ngIf="hasError && !loading" class="empty-state">
        <span>⚠️</span>
        <p class="empty-title">Impossible de récupérer les données</p>
        <p class="empty-sub">Une erreur s'est produite lors du chargement des modules.</p>
        <app-button variant="secondary" size="sm" iconName="refresh" (btnClick)="refresh()">Réessayer</app-button>
      </div>
      <div class="table-scroll" *ngIf="!loading && !hasError">
        <table class="data-table" style="min-width:1320px;">
          <thead>
            <tr>
              <th style="width: 70px;">ID</th>
              <th style="min-width: 180px;">CLIENT / SITE</th>
              <th>Modèle</th>
              <th>GUID</th>
              <th>IP</th>
              <th>Adresse MAC</th>
              <th>Firmware</th>
              <th style="text-align: center; width: 140px; min-width: 140px;">Statut</th>
              <th>Dernier Contact</th>
              <th class="text-right" style="padding-right:1.25rem;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of devices" class="table-row">
              <!-- id -->
              <td>
                <span class="mono text-muted text-xs font-semibold">#{{ d.id }}</span>
              </td>

              <!-- client / site -->
              <td>
                <div class="client-site-group">
                  <div class="font-semibold text-primary-light client-name">
                    <a *ngIf="d.site?.customer" [routerLink]="['/customers']" class="entity-link" title="Voir les clients">{{ d.site?.customer?.name }}</a>
                    <span *ngIf="!d.site?.customer">{{ d.site ? 'Client non assigné' : 'Non assigné' }}</span>
                  </div>
                  <div class="site-sub-info" *ngIf="d.site">
                    <a [routerLink]="['/sites']" [queryParams]="{customer_id: d.site.customer?.id || d.site.customer_id}" class="site-link" title="Voir les sites de ce client">{{ d.site.name }}</a>
                    <span class="text-muted text-xs" *ngIf="d.site.address"> • {{ d.site.address }}</span>
                  </div>
                  <div class="text-xs text-muted" *ngIf="!d.site">
                    Aucun site rattaché
                  </div>
                </div>
              </td>

              <!-- model -->
              <td>
                <div class="font-medium">
                  <span *ngIf="d.model" class="font-semibold text-primary-light">{{ d.model.name }}</span>
                  <span *ngIf="!d.model">—</span>
                </div>
                <div class="mono text-muted text-xs" *ngIf="d.model?.mcu">
                  {{ d.model?.mcu }}
                </div>
              </td>

              <!-- guid -->
              <td>
                <div class="font-bold mono text-primary-light guid-text" [title]="d.guid || d.serial_number">{{ d.guid || d.serial_number }}</div>
                <div class="text-muted text-xs" *ngIf="d.label">{{ d.label }}</div>
              </td>

              <!-- ip -->
              <td>
                <span class="mono text-muted text-xs" *ngIf="d.ip_address">{{ d.ip_address }}</span>
                <span class="text-muted" *ngIf="!d.ip_address">—</span>
              </td>

              <!-- mac -->
              <td>
                <span class="mono text-muted text-xs" *ngIf="d.mac">{{ d.mac }}</span>
                <span class="text-muted" *ngIf="!d.mac">—</span>
              </td>

              <!-- firmware -->
              <td>
                <span class="fw-badge" *ngIf="d.firmware">v{{ d.firmware }}</span>
                <span class="text-muted" *ngIf="!d.firmware">—</span>
              </td>

              <!-- status -->
              <td class="status-cell">
                <span class="status-badge" [ngClass]="'badge-' + d.status">
                  <span class="status-dot-sm" [ngClass]="'dot-' + d.status"></span>
                  <span class="status-text">{{ labelStatus(d.status) }}</span>
                </span>
              </td>

              <!-- last_seen_at -->
              <td class="mono text-muted text-xs">
                {{ d.last_seen_at ? (d.last_seen_at | date:'dd/MM/yyyy HH:mm') : 'Jamais' }}
              </td>

              <!-- actions -->
              <td class="text-right">
                <div class="table-actions">
                  <a class="action-link-btn" [routerLink]="['/dashboard']" [queryParams]="{device: d.serial_number}" title="Chronologie des événements">
                    <app-icon name="dashboard" [size]="15"></app-icon>
                  </a>
                  <app-button variant="icon" size="sm" iconName="heart-pulse" ariaLabel="Fiche Diagnostic Unifiée" tooltip="Diagnostic Santé" [isHealth]="true" (btnClick)="openHealth(d)"></app-button>
                  <app-button variant="icon" size="sm" iconName="pencil" ariaLabel="Modifier l'emplacement" tooltip="Modifier l'emplacement" (btnClick)="openEdit(d)"></app-button>
                  <app-button variant="icon" size="sm" iconName="trash" ariaLabel="Supprimer le module" tooltip="Supprimer" [isDanger]="true" (btnClick)="promptDelete(d)"></app-button>
                </div>
              </td>
            </tr>
            <tr *ngIf="devices.length === 0 && !hasError">
              <td colspan="10" class="empty-state">
                <span>📡</span>
                <p class="empty-title" *ngIf="search || customerFilter || siteFilter || modelFilter || statusFilter">Aucun module trouvé avec les filtres sélectionnés.</p>
                <p class="empty-title" *ngIf="!search && !customerFilter && !siteFilter && !modelFilter && !statusFilter">Aucun module détecté pour le moment.</p>
                <p class="empty-sub" *ngIf="!search && !customerFilter && !siteFilter && !modelFilter && !statusFilter">
                  Les appareils apparaissent automatiquement lors de leur première communication avec la plateforme SpiderHome.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <app-button variant="secondary" size="sm" iconName="chevron-left" [disabled]="page <= 1" (btnClick)="goPage(page - 1)">Précédent</app-button>
        <span class="page-info">Page {{ page }} sur {{ totalPages }} — {{ total }} modules</span>
        <app-button variant="secondary" size="sm" iconName="chevron-right" [disabled]="page >= totalPages" (btnClick)="goPage(page + 1)">Suivant</app-button>
      </div>
    </div>

    <!-- Modal Reassignment — Edition partielle (label + site uniquement) -->
    <app-modal [isOpen]="showModal" title="Réassigner le module"
      icon="📡" size="lg" [hasFooter]="true" (close)="closeModal()">
      <div class="auto-notice">
        <app-icon name="info" [size]="14" aria-hidden="true"></app-icon>
        <span>Les données techniques (Serial, MAC, Firmware) sont injectées automatiquement par le module. Seul l'emplacement et le libellé sont modifiables.</span>
      </div>
      <!-- Read-only info panel -->
      <div class="device-readonly-panel" *ngIf="form.guid || form.serial_number">
        <div class="ro-item">
          <span class="ro-label">GUID</span>
          <span class="ro-value mono text-xs">{{ form.guid || form.serial_number }}</span>
        </div>
        <div class="ro-item" *ngIf="form.ip_address">
          <span class="ro-label">Adresse IP</span>
          <span class="ro-value mono">{{ form.ip_address }}</span>
        </div>
        <div class="ro-item" *ngIf="form.firmware">
          <span class="ro-label">Firmware</span>
          <span class="ro-value mono">v{{ form.firmware }}</span>
        </div>
        <div class="ro-item" *ngIf="form.mac">
          <span class="ro-label">Adresse MAC</span>
          <span class="ro-value mono">{{ form.mac }}</span>
        </div>
        <div class="ro-item">
          <span class="ro-label">Statut</span>
          <span class="ro-value">
            <span class="status-badge" [ngClass]="'badge-' + (form.status || 'offline')">{{ labelStatus(form.status || '') }}</span>
          </span>
        </div>
      </div>
      <form (ngSubmit)="save()" id="deviceForm">
        <div class="popup-banner-error" *ngIf="errors['global']">
          <app-icon name="warning" [size]="16" class="banner-icon"></app-icon>
          <span>{{ errors['global'] }}</span>
        </div>
        <div class="popup-form-grid">
          <div class="popup-field">
            <label class="popup-label">Filtrer les sites par Client</label>
            <select class="popup-select" [(ngModel)]="formCustomerId" name="form_customer" (ngModelChange)="onFormCustomerChange()">
              <option [value]="null">— Tous les clients —</option>
              <option *ngFor="let c of allCustomers" [value]="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="popup-field">
            <label class="popup-label">Site d'installation physique <span class="required">*</span></label>
            <select class="popup-select" [(ngModel)]="form.site_id" name="site_id" [class.error]="errors['site_id']">
              <option [value]="null">— Sélectionner un site —</option>
              <option *ngFor="let s of formSites" [value]="s.id">{{ s.name }}</option>
            </select>
            <span class="popup-error-text" *ngIf="errors['site_id']">
              <app-icon name="warning" [size]="13"></app-icon>
              <span>{{ errors['site_id'][0] }}</span>
            </span>
          </div>
          <div class="popup-field form-col-full">
            <label class="popup-label">Nom personnalisé / Emplacement</label>
            <input class="popup-input" [(ngModel)]="form.label" name="label" placeholder="Ex: Entrée Hall A">
          </div>
        </div>
      </form>
      <div modal-footer class="popup-footer-actions">
        <app-button variant="secondary" size="md" [disabled]="saving" (btnClick)="closeModal()">Annuler</app-button>
        <app-button variant="primary" size="md" type="submit" [isLoading]="saving" (btnClick)="save()">
          {{ saving ? 'Enregistrement…' : "Mettre à jour l'emplacement" }}
        </app-button>
      </div>
    </app-modal>

    <!-- Confirm Delete -->
    <app-confirm-modal [isOpen]="showDeleteModal" title="Supprimer le module"
      [message]="'Supprimer définitivement le module « ' + (deletingDevice?.serial_number || '') + ' » ?'"
      subMessage="Attention : l'historique télémétrique et les événements liés seront désynchronisés."
      confirmText="Supprimer définitivement" cancelText="Conserver le module" type="danger"
      [loading]="deleting" (confirm)="executeDelete()" (cancel)="showDeleteModal = false">
    </app-confirm-modal>

    <!-- Error Alert Modal -->
    <app-confirm-modal
      [isOpen]="showErrorModal"
      [title]="errorModalTitle"
      [message]="errorModalMessage"
      [subMessage]="errorModalSubMessage"
      confirmText="Compris"
      [showCancel]="false"
      type="error"
      (cancel)="showErrorModal = false"
    ></app-confirm-modal>

    <!-- Fiche Diagnostic Unifiée Modal -->
    <app-device-health-modal
      [isOpen]="showHealthModal"
      [deviceId]="healthDeviceId"
      (close)="closeHealth()"
    ></app-device-health-modal>
  `,
  styles: [`
    :host { display: block; padding: 1.75rem 2rem; max-width: 1600px; margin: 0 auto; }
    .header-actions { display: flex; align-items: center; gap: 0.75rem; }
    .text-primary-light { color: var(--heading); }
    .text-xs { font-size: 0.75rem; }
    .client-site-group {
      display: flex;
      flex-direction: column;
      gap: 0.18rem;
      line-height: 1.35;
    }
    .client-name {
      font-size: 0.88rem;
      letter-spacing: -0.01em;
    }
    .site-sub-info {
      font-size: 0.76rem;
      color: var(--text-secondary, #94a3b8);
    }
    .site-name {
      color: var(--text-secondary, #94a3b8);
      font-weight: 500;
    }
    .entity-link {
      color: var(--heading);
      text-decoration: none;
      transition: color 0.15s ease;
    }
    .entity-link:hover {
      color: var(--primary, #38bdf8);
      text-decoration: underline;
    }
    .site-link {
      color: var(--text-secondary, #94a3b8);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.15s ease;
    }
    .site-link:hover {
      color: var(--primary, #38bdf8);
      text-decoration: underline;
    }
    .guid-text {
      font-size: 0.76rem;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .fw-badge {
      display: inline-flex;
      padding: 0.15rem 0.5rem;
      border-radius: 0.35rem;
      background: var(--chip-bg);
      color: var(--chip-text);
      border: 1px solid var(--chip-border);
      font-size: 0.76rem;
      font-family: 'JetBrains Mono', monospace;
    }
    .badge-id {
      display: inline-flex;
      align-items: center;
      padding: 0.1rem 0.35rem;
      border-radius: 0.3rem;
      background: var(--chip-bg);
      border: 1px solid var(--chip-border);
      color: var(--text-muted);
      font-size: 0.72rem;
      font-family: 'JetBrains Mono', monospace;
    }
    .status-dot-sm {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .dot-online { background: #10b981; box-shadow: 0 0 6px #10b981; }
    .dot-offline { background: #64748b; }
    .dot-alert { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }
    .dot-retired { background: #475569; }

    .status-cell {
      text-align: center;
      vertical-align: middle;
      white-space: nowrap;
    }
    .status-badge {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.45rem !important;
      padding: 0.26rem 0.75rem !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      margin: 0 auto;
    }
    .status-text {
      white-space: nowrap !important;
      display: inline-block;
      line-height: 1;
    }

    .health-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 600;
      transition: all 0.15s ease;
    }
    .health-chip:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .chip-health-sain {
      background: var(--ok-bg);
      color: var(--ok-text);
      border: 1px solid var(--ok-border);
    }
    .chip-health-surveillance {
      background: var(--warn-bg);
      color: var(--warn-text);
      border: 1px solid var(--warn-border);
    }
    .chip-health-critique {
      background: var(--crit-bg);
      color: var(--crit-text);
      border: 1px solid var(--crit-border);
    }
    .health-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .dot-health-sain { background: #10b981; box-shadow: 0 0 4px #10b981; }
    .dot-health-surveillance { background: #f59e0b; box-shadow: 0 0 4px #f59e0b; }
    .dot-health-critique { background: #ef4444; box-shadow: 0 0 4px #ef4444; }

    .action-link-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 0.4rem;
      background: var(--chip-bg);
      color: var(--chip-text);
      border: 1px solid var(--chip-border);
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .action-link-btn:hover {
      background: var(--card-hover);
      color: var(--primary);
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 3.5rem 1rem;
      color: var(--text-muted);
      text-align: center;
      span { font-size: 2.2rem; }
      p { margin: 0; font-size: 0.95rem; }
    }
    .empty-title { font-size: 1rem; font-weight: 600; color: var(--text-secondary) !important; }
    .empty-sub { font-size: 0.875rem; color: var(--text-muted) !important; max-width: 480px; line-height: 1.5; }
    /* Panel info lecture seule dans la modal */
    .auto-notice {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.65rem 0.9rem;
      border-radius: 0.5rem;
      background: var(--info-bg);
      border: 1px solid var(--info-border);
      color: var(--info-text);
      font-size: 0.8rem;
      line-height: 1.45;
      margin-bottom: 1rem;
    }
    .device-readonly-panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.5rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
      background: var(--chip-bg);
      border: 1px solid var(--chip-border);
      margin-bottom: 1.25rem;
    }
    .ro-item { display: flex; flex-direction: column; gap: 0.15rem; }
    .ro-label { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .ro-value { font-size: 0.85rem; font-weight: 600; color: var(--heading); }
    .ro-value.mono { font-family: 'JetBrains Mono', monospace; }
  `]
})
export class DevicesComponent implements OnInit {
  devices: Device[] = []; allCustomers: Customer[] = [];
  allSites: Site[] = []; filteredSites: Site[] = [];
  formSites: Site[] = []; allModels: DeviceModel[] = [];
  loading = false; refreshing = false; hasError = false; saving = false; showModal = false;
  editingId: number | null = null;
  search = ''; customerFilter: number | '' = ''; siteFilter: number | '' = '';
  modelFilter: number | '' = ''; statusFilter = '';
  page = 1; totalPages = 1; total = 0;
  errors: Record<string, any> = {}; form: Partial<Device> = {};
  formCustomerId: number | null = null;
  showDeleteModal = false; deletingDevice: Device | null = null; deleting = false;
  showErrorModal = false;
  errorModalTitle = 'Suppression impossible';
  errorModalMessage = '';
  errorModalSubMessage = '';
  showHealthModal = false; healthDeviceId: number | string | null = null;
  private searchSubject = new Subject<string>();

  openHealth(d: Device): void {
    this.healthDeviceId = d.guid || d.serial_number || d.id;
    this.showHealthModal = true;
  }

  closeHealth(): void {
    this.showHealthModal = false;
    this.healthDeviceId = null;
  }

  constructor(
    private deviceService: DeviceService,
    private siteService: SiteService,
    private deviceModelService: DeviceModelService,
    private customerService: CustomerService,
    private cacheService: PageCacheService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadDropdowns();
    this.route.queryParams.subscribe(params => {
      if (params['customer_id']) {
        this.customerFilter = +params['customer_id'];
      }
      if (params['site_id']) {
        this.siteFilter = +params['site_id'];
      }
      if (params['model_id']) {
        this.modelFilter = +params['model_id'];
      }
      if (params['status']) {
        this.statusFilter = params['status'];
      }
      if (params['search']) {
        this.search = params['search'];
      }
      this.updateFilteredSites();
      this.load();
    });
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => { this.page = 1; this.load(); });
  }

  onSearch(val: string) { this.searchSubject.next(val); }

  loadDropdowns() {
    this.customerService.getAll({ all: true }).subscribe((res: any) => {
      this.allCustomers = Array.isArray(res) ? res : res.data;
      this.cdr.markForCheck();
    });
    this.siteService.getAll({ all: true }).subscribe((res: any) => {
      this.allSites = Array.isArray(res) ? res : res.data;
      this.updateFilteredSites();
      this.formSites = [...this.allSites];
      this.cdr.markForCheck();
    });
    this.deviceModelService.getAll({ all: true }).subscribe((res: any) => {
      this.allModels = Array.isArray(res) ? res : res.data;
      this.cdr.markForCheck();
    });
  }

  updateFilteredSites() {
    if (this.siteFilter && !this.customerFilter && this.allSites.length > 0) {
      const site = this.allSites.find(s => s.id === +this.siteFilter);
      if (site && site.customer_id) {
        this.customerFilter = site.customer_id;
      }
    }

    if (this.customerFilter) {
      this.filteredSites = this.allSites.filter(s => s.customer_id === +this.customerFilter);
      if (this.siteFilter && !this.filteredSites.some(s => s.id === +this.siteFilter)) {
        this.siteFilter = '';
      }
    } else {
      this.filteredSites = [...this.allSites];
    }
  }

  onCustomerChange() {
    this.siteFilter = '';
    this.updateFilteredSites();
    this.page = 1;
    this.load();
  }

  onSiteChange() {
    if (this.siteFilter && !this.customerFilter && this.allSites.length > 0) {
      const site = this.allSites.find(s => s.id === +this.siteFilter);
      if (site && site.customer_id) {
        this.customerFilter = site.customer_id;
        this.updateFilteredSites();
      }
    }
    this.page = 1;
    this.load();
  }

  onFilterChange() {
    this.page = 1;
    this.load();
  }

  hasActiveFilters(): boolean {
    return !!(this.search || this.customerFilter || this.siteFilter || this.modelFilter || this.statusFilter);
  }

  resetFilters() {
    this.search = '';
    this.customerFilter = '';
    this.siteFilter = '';
    this.modelFilter = '';
    this.statusFilter = '';
    this.updateFilteredSites();
    this.page = 1;
    this.load();
  }

  onFormCustomerChange() {
    if (this.formCustomerId) {
      this.formSites = this.allSites.filter(s => s.customer_id === +this.formCustomerId!);
    } else {
      this.formSites = [...this.allSites];
    }
    this.form.site_id = undefined;
    this.cdr.markForCheck();
  }

  load() {
    this.loading = this.devices.length === 0;
    this.hasError = false;
    this.cdr.markForCheck();
    this.deviceService.getAll({
      search: this.search || undefined,
      customer_id: this.customerFilter ? +this.customerFilter : undefined,
      site_id: this.siteFilter ? +this.siteFilter : undefined,
      model_id: this.modelFilter ? +this.modelFilter : undefined,
      status: this.statusFilter || undefined,
      per_page: 25
    }).subscribe({
      next: (res: any) => {
        this.devices = res.data ?? res;
        if (res.last_page) { this.totalPages = res.last_page; this.total = res.total; }
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

  /** Actualise les données en invalidant le cache */
  refresh() {
    this.cacheService.invalidate('devices:');
    this.refreshing = true;
    this.load();
  }

  goPage(p: number) { this.page = p; this.load(); }

  /** Modification uniquement — label et site d'installation seulement */
  openEdit(d: Device) {
    this.editingId = d.id;
    this.formCustomerId = d.site?.customer?.id ?? null;
    this.formSites = this.formCustomerId
      ? this.allSites.filter(s => s.customer_id === this.formCustomerId)
      : [...this.allSites];
    this.form = { ...d };
    this.errors = {};
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal() { this.showModal = false; this.saving = false; this.cdr.markForCheck(); }

  save() {
    if (!this.editingId) return; // Sécurité : édition uniquement
    this.saving = true;
    this.errors = {};
    this.cdr.markForCheck();

    // Seuls le label et le site_id sont modifiables — les données techniques viennent du module
    const payload: Partial<Device> = {
      site_id: this.form.site_id ? +this.form.site_id : undefined,
      label: this.form.label || null,
    };

    this.deviceService.update(this.editingId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.load();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.saving = false;
        if (err.status === 422) {
          this.errors = err.error.errors ?? {};
        } else {
          this.errors = { global: ['Une erreur inattendue est survenue.'] };
        }
        this.cdr.markForCheck();
      }
    });
  }

  promptDelete(d: Device) { this.deletingDevice = d; this.showDeleteModal = true; this.cdr.markForCheck(); }

  executeDelete() {
    if (!this.deletingDevice) return;
    this.deleting = true;
    this.cdr.markForCheck();
    this.deviceService.delete(this.deletingDevice.id).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.deletingDevice = null;
        this.load();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.errorModalTitle = 'Suppression impossible';
        this.errorModalMessage = err.error?.message ?? 'Impossible de supprimer ce module.';
        this.errorModalSubMessage = 'Veuillez vérifier l\'état de connexion et les dépendances du module.';
        this.showErrorModal = true;
        this.cdr.markForCheck();
      }
    });
  }

  labelStatus(s: string): string {
    const map: Record<string, string> = { online: 'En ligne', offline: 'Hors ligne', alert: 'En alerte', retired: 'Retiré' };
    return map[s] ?? s;
  }

  labelHealth(h?: string): string {
    const map: Record<string, string> = { sain: 'Sain', surveillance: 'Surveillance', critique: 'Critique' };
    return h ? (map[h] ?? h) : '—';
  }
}
