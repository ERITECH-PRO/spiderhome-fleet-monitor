import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, AppUser, UserPayload, ROLE_OPTIONS } from '../services/user.service';
import { CustomerService, Customer } from '../services/customer.service';
import { AuthService } from '../services/auth.service';
import { ModalComponent } from '../shared/components/modal/modal.component';
import { ConfirmModalComponent } from '../shared/components/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ConfirmModalComponent, ButtonComponent, IconComponent],
  template: `
    <div class="page-header fade-up">
      <div>
        <h1 class="page-title"><app-icon name="customers" [size]="24"></app-icon> Comptes & Rôles</h1>
        <p class="page-sub">Administration des accès — cahier des charges §4 « Utilisateurs et droits »</p>
      </div>
      <div class="header-actions">
        <app-button variant="secondary" size="md" iconName="refresh" [isLoading]="refreshing" (btnClick)="refresh()">
          Actualiser
        </app-button>
        <app-button variant="primary" size="md" iconName="plus" (btnClick)="openCreate()">
          Nouveau compte
        </app-button>
      </div>
    </div>

    <div class="filter-bar fade-up">
      <select class="filter-select" [(ngModel)]="roleFilter" (ngModelChange)="load()">
        <option value="">Tous les rôles</option>
        <option *ngFor="let r of roleOptions" [value]="r.value">{{ r.label }}</option>
      </select>
    </div>

    <div class="table-card fade-up">
      <div *ngIf="loading && users.length === 0" class="table-loading">
        <div class="skeleton" style="height:3.2rem;margin-bottom:.5rem;" *ngFor="let i of [1,2,3,4,5]"></div>
      </div>

      <div *ngIf="hasError && !loading" class="empty-state">
        <span>⚠️</span>
        <p class="empty-title">Impossible de récupérer les comptes</p>
        <app-button variant="secondary" size="sm" iconName="refresh" (btnClick)="refresh()">Réessayer</app-button>
      </div>

      <div class="table-scroll" *ngIf="(!loading || users.length > 0) && !hasError">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Rôle</th>
              <th>Client rattaché</th>
              <th style="width:100px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users">
              <td>{{ u.name }}</td>
              <td class="mono text-xs">{{ u.email }}</td>
              <td><span class="role-pill" [ngClass]="'role-' + u.role">{{ roleLabel(u.role) }}</span></td>
              <td>{{ u.customer?.name || '—' }}</td>
              <td>
                <div class="row-actions">
                  <app-button variant="icon" size="sm" iconName="pencil" ariaLabel="Modifier ce compte" tooltip="Modifier" (btnClick)="openEdit(u)"></app-button>
                  <app-button variant="icon" size="sm" iconName="trash" ariaLabel="Supprimer ce compte" tooltip="Supprimer" [isDanger]="true"
                    [disabled]="u.id === self?.id" (btnClick)="promptDelete(u)"></app-button>
                </div>
              </td>
            </tr>
            <tr *ngIf="!loading && users.length === 0">
              <td colspan="5">
                <div class="empty-state">
                  <span>👤</span>
                  <p class="empty-title">Aucun compte</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL CRÉATION / ÉDITION -->
    <app-modal [isOpen]="showModal" [title]="editingId ? 'Modifier le compte' : 'Créer un compte'"
      icon="👤" size="lg" [hasFooter]="true" (close)="closeModal()">
      <form (ngSubmit)="save()" id="userForm">
        <div class="popup-banner-error" *ngIf="errors['global']">
          <app-icon name="warning" [size]="16" class="banner-icon"></app-icon>
          <span>{{ errors['global'] }}</span>
        </div>
        <div class="popup-form-grid">
          <div class="popup-field form-col-full">
            <label class="popup-label">Nom complet <span class="required">*</span></label>
            <input class="popup-input" [(ngModel)]="form.name" name="name" required [class.error]="errors['name']">
            <span class="popup-error-text" *ngIf="errors['name']">{{ errors['name'][0] }}</span>
          </div>
          <div class="popup-field">
            <label class="popup-label">E-mail <span class="required">*</span></label>
            <input class="popup-input mono" type="email" [(ngModel)]="form.email" name="email" required [class.error]="errors['email']">
            <span class="popup-error-text" *ngIf="errors['email']">{{ errors['email'][0] }}</span>
          </div>
          <div class="popup-field">
            <label class="popup-label">Téléphone</label>
            <input class="popup-input mono" [(ngModel)]="form.phone" name="phone">
          </div>
          <div class="popup-field">
            <label class="popup-label">Mot de passe {{ editingId ? '(laisser vide pour ne pas changer)' : '' }} <span class="required" *ngIf="!editingId">*</span></label>
            <input class="popup-input mono" type="password" [(ngModel)]="form.password" name="password" [required]="!editingId" [class.error]="errors['password']" autocomplete="new-password">
            <span class="popup-error-text" *ngIf="errors['password']">{{ errors['password'][0] }}</span>
          </div>
          <div class="popup-field">
            <label class="popup-label">Rôle <span class="required">*</span></label>
            <select class="popup-select" [(ngModel)]="form.role" name="role" required>
              <option *ngFor="let r of roleOptions" [value]="r.value">{{ r.label }}</option>
            </select>
          </div>
          <div class="popup-field form-col-full" *ngIf="form.role === 'client'">
            <label class="popup-label">Client rattaché <span class="required">*</span></label>
            <select class="popup-select" [(ngModel)]="form.customer_id" name="customer_id" required>
              <option [ngValue]="null">— Sélectionner —</option>
              <option *ngFor="let c of customers" [ngValue]="c.id">{{ c.name }}</option>
            </select>
            <span class="popup-error-text" *ngIf="errors['customer_id']">{{ errors['customer_id'][0] }}</span>
          </div>
          <div class="popup-field form-col-full" *ngIf="form.role === 'client'">
            <div class="auto-notice">
              <app-icon name="info" [size]="14"></app-icon>
              <span>Ce compte ne verra que les sites, modules et demandes SAV du client sélectionné (isolation automatique).</span>
            </div>
          </div>
        </div>
      </form>
      <div modal-footer class="popup-footer-actions">
        <app-button variant="secondary" size="md" [disabled]="saving" (btnClick)="closeModal()">Annuler</app-button>
        <app-button variant="primary" size="md" type="submit" [isLoading]="saving" [disabled]="saving" (btnClick)="save()">
          {{ saving ? 'Enregistrement…' : (editingId ? 'Mettre à jour' : 'Créer le compte') }}
        </app-button>
      </div>
    </app-modal>

    <app-confirm-modal [isOpen]="showDeleteModal" title="Supprimer le compte"
      [message]="'Supprimer définitivement le compte « ' + (deletingUser?.name || '') + ' » ?'"
      subMessage="Cette action est irréversible."
      confirmText="Supprimer définitivement" cancelText="Conserver" type="danger"
      [loading]="deleting" (confirm)="executeDelete()" (cancel)="showDeleteModal = false">
    </app-confirm-modal>

    <app-confirm-modal
      [isOpen]="showErrorModal" [title]="errorModalTitle" [message]="errorModalMessage"
      confirmText="Compris" [showCancel]="false" type="error"
      (cancel)="showErrorModal = false">
    </app-confirm-modal>
  `,
  styles: [`
    :host { display: block; padding: 1.75rem 2rem; max-width: 1440px; margin: 0 auto; }
    .header-actions { display: flex; align-items: center; gap: 0.75rem; }
    .row-actions { display: flex; gap: 0.35rem; }
    .text-xs { font-size: 0.74rem; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 1rem; color: var(--text-muted); text-align: center; }
    .empty-state span { font-size: 2rem; }
    .empty-title { font-size: 1rem; font-weight: 600; color: var(--text-secondary) !important; }
    .auto-notice {
      display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.65rem 0.9rem; border-radius: 0.5rem;
      background: var(--info-bg); border: 1px solid var(--info-border); color: var(--info-text);
      font-size: 0.8rem; line-height: 1.45;
    }
    .role-pill {
      display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 999px;
      font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
      background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--chip-text);
    }
    .role-admin      { background: rgba(239, 68, 68, 0.12);  border-color: rgba(239, 68, 68, 0.3);  color: #f87171; }
    .role-support    { background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.3); color: #60a5fa; }
    .role-technician { background: rgba(168, 85, 247, 0.12); border-color: rgba(168, 85, 247, 0.3); color: #c084fc; }
    .role-quality    { background: rgba(234, 179, 8, 0.12);  border-color: rgba(234, 179, 8, 0.3);  color: #facc15; }
    .role-client     { background: rgba(34, 197, 94, 0.12);  border-color: rgba(34, 197, 94, 0.3);  color: #4ade80; }
  `]
})
export class UsersComponent implements OnInit {
  users: AppUser[] = [];
  customers: Customer[] = [];
  loading = false;
  refreshing = false;
  saving = false;
  hasError = false;
  showModal = false;
  editingId: number | null = null;
  roleFilter = '';
  roleOptions = ROLE_OPTIONS;
  errors: Record<string, string[]> = {};
  showDeleteModal = false;
  deletingUser: AppUser | null = null;
  deleting = false;
  showErrorModal = false;
  errorModalTitle = 'Suppression impossible';
  errorModalMessage = '';
  form: Partial<UserPayload> & { customer_id?: number | null } = {};

  get self() { return this.authService.currentUserValue; }

  constructor(
    private userService: UserService,
    private customerService: CustomerService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
    // Nécessaire uniquement pour le sélecteur "client rattaché" du formulaire.
    this.customerService.getAll({ all: true, per_page: 500 }).subscribe({
      next: (res: any) => { this.customers = res.data ?? res; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  roleLabel(role: string): string {
    return this.roleOptions.find(r => r.value === role)?.label.split(' — ')[0] ?? role;
  }

  load() {
    this.loading = this.users.length === 0;
    this.hasError = false;
    this.cdr.markForCheck();
    this.userService.getAll(this.roleFilter || undefined).subscribe({
      next: (res) => {
        this.users = res.users ?? [];
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

  openCreate() {
    this.editingId = null;
    this.form = { role: 'support', customer_id: null };
    this.errors = {};
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openEdit(u: AppUser) {
    this.editingId = u.id;
    this.form = { name: u.name, email: u.email, role: u.role, customer_id: u.customer_id, phone: u.phone, password: '' };
    this.errors = {};
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal() { this.showModal = false; this.saving = false; this.cdr.markForCheck(); }

  save() {
    this.saving = true;
    this.errors = {};
    this.cdr.markForCheck();

    const payload: UserPayload = {
      name: this.form.name!,
      email: this.form.email!,
      role: this.form.role!,
      phone: this.form.phone || null,
      customer_id: this.form.role === 'client' ? (this.form.customer_id ?? null) : null,
    };
    if (this.form.password) payload.password = this.form.password;

    const req = this.editingId
      ? this.userService.update(this.editingId, payload)
      : this.userService.create(payload);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.load();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.saving = false;
        if (err.status === 422) this.errors = err.error.errors ?? { global: [err.error.message] };
        else this.errors = { global: ['Une erreur inattendue est survenue.'] };
        this.cdr.markForCheck();
      }
    });
  }

  promptDelete(u: AppUser) { this.deletingUser = u; this.showDeleteModal = true; this.cdr.markForCheck(); }

  executeDelete() {
    if (!this.deletingUser) return;
    this.deleting = true;
    this.cdr.markForCheck();
    this.userService.delete(this.deletingUser.id).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.deletingUser = null;
        this.load();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.errorModalTitle = 'Suppression impossible';
        this.errorModalMessage = err.error?.message ?? 'Impossible de supprimer ce compte.';
        this.showErrorModal = true;
        this.cdr.markForCheck();
      }
    });
  }
}
