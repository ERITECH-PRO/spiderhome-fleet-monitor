import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { SiteService, Site } from '../services/site.service';
import { CustomerService, Customer } from '../services/customer.service';
import { PageCacheService } from '../services/page-cache.service';
import { ConfirmModalComponent } from '../shared/components/confirm-modal/confirm-modal.component';
import { SiteFormModalComponent } from '../shared/components/site-form-modal/site-form-modal.component';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-sites',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmModalComponent, SiteFormModalComponent, ButtonComponent, IconComponent],
  template: `
    <!-- Header —— Supervision uniquement, pas de création manuelle -->
    <div class="page-header fade-up">
      <div>
        <h1 class="page-title"><app-icon name="sites" [size]="24"></app-icon> Sites d'Installation</h1>
        <p class="page-sub">Cartographie des emplacements physiques — les sites sont enregistrés automatiquement à l'installation d'un module</p>
      </div>
      <div class="header-actions">
        <app-button variant="secondary" size="md" iconName="refresh" [isLoading]="refreshing" (btnClick)="refresh()">
          Actualiser
        </app-button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar fade-up">
      <input class="filter-input" placeholder="🔍 Rechercher par nom de site, adresse, client…"
             [(ngModel)]="search" (ngModelChange)="onSearch($event)">
      <select class="filter-select" [(ngModel)]="customerFilter" (ngModelChange)="load()">
        <option value="">Tous les clients</option>
        <option *ngFor="let c of allCustomers" [value]="c.id">{{ c.name }}</option>
      </select>
    </div>

    <!-- Table Card -->
    <div class="table-card fade-up">
      <div *ngIf="loading && sites.length === 0" class="table-loading">
        <div class="skeleton" style="height:3.2rem;margin-bottom:.5rem;" *ngFor="let i of [1,2,3,4,5]"></div>
      </div>
      <!-- Error state -->
      <div *ngIf="hasError && !loading" class="empty-state">
        <span>⚠️</span>
        <p class="empty-title">Impossible de récupérer les données</p>
        <p class="empty-sub">Une erreur s'est produite lors du chargement des sites.</p>
        <app-button variant="secondary" size="sm" iconName="refresh" (btnClick)="refresh()">Réessayer</app-button>
      </div>
      <div class="table-scroll" *ngIf="(!loading || sites.length > 0) && !hasError">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 70px;">ID</th>
              <th>Client</th>
              <th>Nom du Site</th>
              <th>Adresse Physique</th>
              <th style="text-align: center; width: 130px;">Modules IoT</th>
              <th class="text-right" style="padding-right:1.25rem;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of sites" class="table-row">
              <!-- id -->
              <td>
                <span class="mono text-muted text-xs font-semibold">#{{ s.id }}</span>
              </td>

              <!-- customer -->
              <td>
                <div class="font-semibold text-primary-light" *ngIf="s.customer">{{ s.customer.name }}</div>
                <div class="text-muted" *ngIf="!s.customer">Non assigné</div>
              </td>

              <!-- name -->
              <td>
                <div class="font-semibold text-primary-light">{{ s.name }}</div>
                <div class="text-muted text-xs" *ngIf="s.contact_name">Contact: {{ s.contact_name }}</div>
              </td>

              <!-- address -->
              <td class="text-muted">{{ s.address || '—' }}</td>

              <!-- devices count -->
              <td style="text-align: center;">
                <a [routerLink]="['/devices']" [queryParams]="{site_id: s.id}" class="count-pill link-pill" title="Voir les modules IoT de ce site">
                  {{ s.devices_count ?? 0 }}
                </a>
              </td>

              <!-- actions -->
              <td class="text-right">
                <div class="table-actions">
                  <app-button variant="icon" size="sm" iconName="pencil" ariaLabel="Éditer le site" tooltip="Modifier" (btnClick)="openEdit(s)"></app-button>
                  <app-button variant="icon" size="sm" iconName="trash" ariaLabel="Supprimer le site" tooltip="Supprimer" [isDanger]="true" (btnClick)="promptDelete(s)"></app-button>
                </div>
              </td>
            </tr>
            <tr *ngIf="sites.length === 0 && !loading && !hasError">
              <td colspan="6" class="empty-state">
                <span>📍</span>
                <p class="empty-title" *ngIf="search || customerFilter">Aucun site trouvé avec ces critères.</p>
                <p class="empty-title" *ngIf="!search && !customerFilter">Aucun site enregistré pour le moment.</p>
                <p class="empty-sub" *ngIf="!search && !customerFilter">
                  Les sites sont créés automatiquement lors de l'association d'un module SpiderHome à une installation physique.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <app-button variant="secondary" size="sm" iconName="chevron-left" [disabled]="page <= 1" (btnClick)="goPage(page - 1)">Précédent</app-button>
        <span class="page-info">Page {{ page }} sur {{ totalPages }} — {{ total }} sites</span>
        <app-button variant="secondary" size="sm" iconName="chevron-right" [disabled]="page >= totalPages" (btnClick)="goPage(page + 1)">Suivant</app-button>
      </div>
    </div>

    <!-- Form Modal -->
    <app-site-form-modal [isOpen]="showModal" [siteToEdit]="editingSite" [customers]="allCustomers"
      [isSaving]="saving" [backendErrors]="errors"
      (formSubmit)="onFormSubmit($event)" (close)="closeModal()">
    </app-site-form-modal>

    <!-- Delete Confirmation Modal -->
    <app-confirm-modal [isOpen]="showDeleteModal" title="Supprimer le site"
      [message]="'Supprimer définitivement le site « ' + (deletingSite?.name || '') + ' » ?'"
      subMessage="Attention : tous les modules IoT associés à ce site seront affectés."
      confirmText="Supprimer définitivement" cancelText="Conserver le site" type="danger"
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
  `,
  styles: [`
    :host { display: block; padding: 1.75rem 2rem; max-width: 1440px; margin: 0 auto; }
    .header-actions { display: flex; align-items: center; gap: 0.75rem; }
    .text-primary-light { color: var(--heading); font-weight: 600; }
    .text-xs { font-size: 0.74rem; }
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
    .count-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--chip-bg);
      border: 1px solid var(--chip-border);
      color: var(--chip-text);
      font-size: 0.78rem;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }
    .link-pill {
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .link-pill:hover {
      background: var(--primary-dark, #0284c7);
      color: #ffffff;
      border-color: #38bdf8;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      color: var(--text-muted);
      text-align: center;
      span { font-size: 2rem; }
      p { margin: 0; }
    }
    .empty-title { font-size: 1rem; font-weight: 600; color: var(--text-secondary) !important; }
    .empty-sub { font-size: 0.875rem; color: var(--text-muted) !important; max-width: 420px; line-height: 1.5; }
  `]
})
export class SitesComponent implements OnInit {
  sites: Site[] = []; allCustomers: Customer[] = [];
  loading = false; refreshing = false; saving = false; showModal = false; hasError = false;
  editingSite: Site | null = null;
  search = ''; customerFilter: number | '' = '';
  page = 1; totalPages = 1; total = 0;
  errors: Record<string, any> = {};
  showDeleteModal = false; deletingSite: Site | null = null; deleting = false;
  showErrorModal = false;
  errorModalTitle = 'Suppression impossible';
  errorModalMessage = '';
  errorModalSubMessage = '';
  private searchSubject = new Subject<string>();

  constructor(
    private siteService: SiteService,
    private customerService: CustomerService,
    private cacheService: PageCacheService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['customer_id']) {
        this.customerFilter = +params['customer_id'];
      }
      this.load();
    });
    this.loadCustomers();
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => { this.page = 1; this.load(); });
  }

  onSearch(val: string) { this.searchSubject.next(val); }

  loadCustomers() {
    this.customerService.getAll({ all: true }).subscribe((res: any) => {
      this.allCustomers = Array.isArray(res) ? res : res.data;
      this.cdr.markForCheck();
    });
  }

  load() {
    this.loading = this.sites.length === 0;
    this.hasError = false;
    this.cdr.markForCheck();
    this.siteService.getAll({ search: this.search || undefined, customer_id: this.customerFilter ? +this.customerFilter : undefined, per_page: 20 }).subscribe({
      next: (res: any) => {
        this.sites = res.data ?? res;
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
    this.cacheService.invalidate('sites:');
    this.refreshing = true;
    this.load();
  }

  goPage(p: number) { this.page = p; this.load(); }
  /** Modification uniquement — les sites sont créés automatiquement par le système */
  openEdit(s: Site) { this.editingSite = s; this.errors = {}; this.showModal = true; this.cdr.markForCheck(); }
  closeModal() { this.showModal = false; this.editingSite = null; this.saving = false; this.cdr.markForCheck(); }

  onFormSubmit(formData: Partial<Site>) {
    this.saving = true;
    this.errors = {};
    this.cdr.markForCheck();

    const req = this.editingSite
      ? this.siteService.update(this.editingSite.id, formData)
      : this.siteService.create(formData);

    req.subscribe({
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

  promptDelete(s: Site) { this.deletingSite = s; this.showDeleteModal = true; this.cdr.markForCheck(); }

  executeDelete() {
    if (!this.deletingSite) return;
    this.deleting = true;
    this.cdr.markForCheck();
    this.siteService.delete(this.deletingSite.id).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.deletingSite = null;
        this.load();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.errorModalTitle = 'Suppression impossible';
        this.errorModalMessage = err.error?.message ?? 'Impossible de supprimer ce site.';
        this.errorModalSubMessage = 'Des modules IoT sont actuellement associés à ce site.';
        this.showErrorModal = true;
        this.cdr.markForCheck();
      }
    });
  }
}
