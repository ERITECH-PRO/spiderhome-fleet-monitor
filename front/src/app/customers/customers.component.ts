import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService, Customer } from '../services/customer.service';
import { PageCacheService } from '../services/page-cache.service';
import { ModalComponent } from '../shared/components/modal/modal.component';
import { ConfirmModalComponent } from '../shared/components/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, ConfirmModalComponent, ButtonComponent, IconComponent],
  template: `
    <!-- Header — Supervision uniquement, pas de création manuelle -->
    <div class="page-header fade-up">
      <div>
        <h1 class="page-title"><app-icon name="customers" [size]="24"></app-icon> Registre des Clients</h1>
        <p class="page-sub">Consultation du parc client — les comptes sont créés automatiquement à l'enregistrement d'un module</p>
      </div>
      <div class="header-actions">
        <app-button variant="secondary" size="md" iconName="refresh" [isLoading]="refreshing" (btnClick)="refresh()">
          Actualiser
        </app-button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar fade-up">
      <input class="filter-input" placeholder="🔍 Rechercher par nom, email, ville, SIRET…"
             [(ngModel)]="search" (ngModelChange)="onSearch($event)">
      <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="load()">
        <option value="">Tous les statuts</option>
        <option value="active">Actif</option>
        <option value="inactive">Inactif</option>
        <option value="prospect">Prospect</option>
        <option value="suspended">Suspendu</option>
      </select>
    </div>

    <!-- Table Card -->
    <div class="table-card fade-up">
      <!-- Loading skeleton -->
      <div *ngIf="loading && customers.length === 0" class="table-loading">
        <div class="skeleton" style="height:3.2rem;margin-bottom:.5rem;" *ngFor="let i of [1,2,3,4,5]"></div>
      </div>

      <!-- Error state -->
      <div *ngIf="hasError && !loading" class="empty-state">
        <span>⚠️</span>
        <p class="empty-title">Impossible de récupérer les données</p>
        <p class="empty-sub">Une erreur s'est produite lors du chargement des clients.</p>
        <app-button variant="secondary" size="sm" iconName="refresh" (btnClick)="refresh()">Réessayer</app-button>
      </div>

      <div class="table-scroll" *ngIf="(!loading || customers.length > 0) && !hasError">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 70px;">ID</th>
              <th>Nom / Entreprise</th>
              <th class="text-center">Sites</th>
              <th class="text-center">Modules</th>
              <th>Adresse serveur</th>
              <th>Téléphone</th>
              <th>Email Professionnel</th>
              <th>Statut</th>
              <th>Notes</th>
              <th class="text-right" style="padding-right:1.25rem;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of customers" class="table-row">
              <!-- id -->
              <td>
                <span class="mono text-muted text-xs font-semibold">#{{ c.id }}</span>
              </td>

              <!-- name -->
              <td>
                <div class="font-semibold text-primary-light">{{ c.name }}</div>
                <div class="mono text-muted text-xs" *ngIf="c.siret">SIRET: {{ c.siret }}</div>
              </td>

              <!-- sites_count -->
              <td class="text-center">
                <a [routerLink]="['/sites']" [queryParams]="{customer_id: c.id}" class="count-pill link-pill" title="Voir les sites de ce client">
                  {{ c.sites_count ?? 0 }}
                </a>
              </td>

              <!-- devices_count -->
              <td class="text-center">
                <a [routerLink]="['/devices']" [queryParams]="{customer_id: c.id}" class="count-pill link-pill" title="Voir les modules IoT de ce client">
                  {{ c.devices_count ?? 0 }}
                </a>
              </td>

              <!-- server_address -->
              <td>
                <a [href]="c.server_address || 'https://cloud.spiderhome.org/'"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="server-link mono text-xs"
                   title="Ouvrir le serveur SpiderHome">
                  <span>{{ c.server_address || 'https://cloud.spiderhome.org/' }}</span>
                  <app-icon name="external-link" [size]="12" class="server-link-icon"></app-icon>
                </a>
              </td>

              <!-- phone -->
              <td class="mono text-muted text-xs">{{ c.phone || '—' }}</td>

              <!-- email -->
              <td class="mono text-muted">{{ c.email || '—' }}</td>

              <!-- status -->
              <td>
                <span class="status-badge" [ngClass]="'badge-' + (c.status || 'inactive')">
                  {{ c.status || 'inactif' }}
                </span>
              </td>

              <!-- notes -->
              <td class="text-muted text-xs">
                <span class="truncate-notes" [title]="c.notes || ''">{{ c.notes || '—' }}</span>
              </td>

              <!-- actions -->
              <td class="text-right">
                <div class="table-actions">
                  <app-button variant="icon" size="sm" iconName="pencil" ariaLabel="Modifier la fiche client" tooltip="Modifier les informations" (btnClick)="openEdit(c)"></app-button>
                  <app-button variant="icon" size="sm" iconName="trash" ariaLabel="Supprimer le client" tooltip="Supprimer" [isDanger]="true" (btnClick)="promptDelete(c)"></app-button>
                </div>
              </td>
            </tr>

            <!-- Empty state — aucun client -->
            <tr *ngIf="customers.length === 0 && !loading && !hasError">
              <td colspan="10" class="empty-state">
                <span>🏢</span>
                <p class="empty-title" *ngIf="search || statusFilter">Aucun client trouvé avec ces critères.</p>
                <p class="empty-title" *ngIf="!search && !statusFilter">Aucun client enregistré pour le moment.</p>
                <p class="empty-sub" *ngIf="!search && !statusFilter">
                  Les comptes clients apparaissent automatiquement après l'enregistrement d'un premier module SpiderHome.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <app-button variant="secondary" size="sm" iconName="chevron-left" [disabled]="page <= 1" (btnClick)="goPage(page - 1)">Précédent</app-button>
        <span class="page-info">Page {{ page }} sur {{ totalPages }} — {{ total }} clients</span>
        <app-button variant="secondary" size="sm" iconName="chevron-right" [disabled]="page >= totalPages" (btnClick)="goPage(page + 1)">Suivant</app-button>
      </div>
    </div>

    <!-- MODAL ÉDITION — Correction des informations d'un client existant -->
    <app-modal [isOpen]="showModal" title="Modifier la fiche client"
      icon="🏢" size="xl" [hasFooter]="true" (close)="closeModal()">
      <div class="auto-notice">
        <app-icon name="info" [size]="14" aria-hidden="true"></app-icon>
        <span>Ce client a été enregistré automatiquement par le système. Vous pouvez corriger ses informations de contact.</span>
      </div>
      <form (ngSubmit)="save()" id="customerForm">
        <div class="popup-banner-error" *ngIf="errors['global']">
          <app-icon name="warning" [size]="16" class="banner-icon"></app-icon>
          <span>{{ errors['global'] }}</span>
        </div>
        <div class="popup-form-grid">
          <div class="popup-field form-col-full">
            <label class="popup-label">Raison sociale ou nom du client <span class="required">*</span></label>
            <input class="popup-input" [(ngModel)]="form.name" name="name" required [class.error]="errors['name']" placeholder="Ex: Résidences du Parc">
            <span class="popup-error-text" *ngIf="errors['name']">
              <app-icon name="warning" [size]="13"></app-icon>
              <span>{{ errors['name'][0] }}</span>
            </span>
          </div>
          <div class="popup-field">
            <label class="popup-label">Email de contact principal</label>
            <input class="popup-input mono" type="email" [(ngModel)]="form.email" name="email" [class.error]="errors['email']" placeholder="contact@entreprise.fr">
            <span class="popup-error-text" *ngIf="errors['email']">
              <app-icon name="warning" [size]="13"></app-icon>
              <span>{{ errors['email'][0] }}</span>
            </span>
          </div>
          <div class="popup-field">
            <label class="popup-label">Téléphone professionnel</label>
            <input class="popup-input mono" [(ngModel)]="form.phone" name="phone" placeholder="+33 1 42 00 11 22">
          </div>
          <div class="popup-field">
            <label class="popup-label">Statut du compte</label>
            <select class="popup-select" [(ngModel)]="form.status" name="status">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="prospect">Prospect</option>
              <option value="suspended">Suspendu</option>
            </select>
          </div>
          <div class="popup-field">
            <label class="popup-label">Ville</label>
            <input class="popup-input" [(ngModel)]="form.city" name="city" placeholder="Paris">
          </div>
          <div class="popup-field">
            <label class="popup-label">Code Pays (ISO)</label>
            <input class="popup-input mono" [(ngModel)]="form.country" name="country" maxlength="3" placeholder="FR">
          </div>
          <div class="popup-field">
            <label class="popup-label">Numéro SIRET</label>
            <input class="popup-input mono" [(ngModel)]="form.siret" name="siret" maxlength="20" placeholder="123 456 789 00012">
          </div>
          <div class="popup-field form-col-full">
            <label class="popup-label">Adresse postale complète</label>
            <input class="popup-input" [(ngModel)]="form.address" name="address" placeholder="12 Allée des Roses">
          </div>
          <div class="popup-field form-col-full">
            <label class="popup-label">Notes & Observations</label>
            <textarea class="popup-textarea" [(ngModel)]="form.notes" name="notes" rows="3" placeholder="Informations contractuelles, interlocuteurs ou détails techniques…"></textarea>
          </div>
        </div>
      </form>
      <div modal-footer class="popup-footer-actions">
        <app-button variant="secondary" size="md" [disabled]="saving" (btnClick)="closeModal()">Annuler</app-button>
        <app-button variant="primary" size="md" type="submit" [isLoading]="saving" [disabled]="saving" (btnClick)="save()">
          {{ saving ? 'Enregistrement…' : 'Mettre à jour' }}
        </app-button>
      </div>
    </app-modal>

    <!-- Modal Confirmation Suppression -->
    <app-confirm-modal [isOpen]="showDeleteModal" title="Supprimer le client"
      [message]="'Supprimer définitivement le client « ' + (deletingCustomer?.name || '') + ' » ?'"
      subMessage="Attention : tous les sites et modules rattachés à ce client seront également impactés. Cette action est irréversible."
      confirmText="Supprimer définitivement" cancelText="Conserver le client" type="danger"
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
    .server-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--primary, #38bdf8);
      text-decoration: none;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.2);
      transition: all 0.2s ease;
      white-space: nowrap;

      &:hover {
        background: rgba(56, 189, 248, 0.16);
        border-color: rgba(56, 189, 248, 0.4);
        color: #7dd3fc;
        text-decoration: none;
      }
    }
    .server-link-icon {
      opacity: 0.75;
      flex-shrink: 0;
    }
    .truncate-notes {
      display: inline-block;
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
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
      transition: all 0.15s ease;
      &:hover {
        background: var(--primary, #3b82f6);
        color: #ffffff;
        border-color: var(--primary, #3b82f6);
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
      }
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
    /* Notice auto dans la modal d'édition */
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
  `]
})
export class CustomersComponent implements OnInit {
  customers: Customer[] = [];
  loading = false;
  refreshing = false;
  saving = false;
  showModal = false;
  hasError = false;
  editingId: number | null = null;
  search = '';
  statusFilter = '';
  page = 1;
  totalPages = 1;
  total = 0;
  errors: Record<string, string[]> = {};
  showDeleteModal = false;
  deletingCustomer: Customer | null = null;
  deleting = false;
  showErrorModal = false;
  errorModalTitle = 'Suppression impossible';
  errorModalMessage = '';
  errorModalSubMessage = '';
  form: Partial<Customer> = {};
  private searchSubject = new Subject<string>();

  constructor(
    private customerService: CustomerService,
    private cacheService: PageCacheService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.load();
    });
  }

  onSearch(val: string) { this.searchSubject.next(val); }

  load() {
    this.loading = this.customers.length === 0;
    this.hasError = false;
    this.cdr.markForCheck();
    this.customerService.getAll({
      search: this.search || undefined,
      status: this.statusFilter || undefined,
      per_page: 20
    }).subscribe({
      next: (res: any) => {
        this.customers = res.data ?? res;
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
    this.cacheService.invalidate('customers:');
    this.refreshing = true;
    this.load();
  }

  goPage(p: number) { this.page = p; this.load(); }

  /** Modification uniquement — pas de création manuelle */
  openEdit(c: Customer) {
    this.editingId = c.id;
    this.form = { ...c };
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

    const payload: Partial<Customer> = {
      name: this.form.name,
      email: this.form.email || null,
      phone: this.form.phone || null,
      status: this.form.status || 'active',
      notes: this.form.notes || null,
      address: this.form.address || null,
      city: this.form.city || null,
      country: this.form.country || 'FR',
      siret: this.form.siret || null
    };

    this.customerService.update(this.editingId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.load();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.saving = false;
        if (err.status === 422) this.errors = err.error.errors ?? {};
        else this.errors = { global: ['Une erreur inattendue est survenue.'] };
        this.cdr.markForCheck();
      }
    });
  }

  promptDelete(c: Customer) { this.deletingCustomer = c; this.showDeleteModal = true; this.cdr.markForCheck(); }

  executeDelete() {
    if (!this.deletingCustomer) return;
    this.deleting = true;
    this.cdr.markForCheck();
    this.customerService.delete(this.deletingCustomer.id).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.deletingCustomer = null;
        this.load();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.errorModalTitle = 'Suppression impossible';
        this.errorModalMessage = err.error?.message ?? 'Impossible de supprimer ce client.';
        this.errorModalSubMessage = 'Des sites ou modules IoT sont actuellement rattachés à ce client.';
        this.showErrorModal = true;
        this.cdr.markForCheck();
      }
    });
  }
}
