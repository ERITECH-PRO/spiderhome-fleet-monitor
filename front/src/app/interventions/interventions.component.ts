import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ServiceRequestService,
  ServiceRequest,
  ServiceRequestHistory,
  SRStatus,
  SRPriority,
  SRFilter,
  StoreServiceRequestPayload
} from '../services/service-request.service';
import { CustomerService, Customer } from '../services/customer.service';
import { SiteService, Site } from '../services/site.service';
import { DeviceService, Device } from '../services/device.service';
import { ModalComponent } from '../shared/components/modal/modal.component';
import { ConfirmModalComponent } from '../shared/components/confirm-modal/confirm-modal.component';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-interventions',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ConfirmModalComponent, ButtonComponent, IconComponent],
  template: `
    <div class="interventions-page">
      <!-- ── 1. HEADER ────────────────────────────────────────────────────────── -->
      <header class="page-header fade-up">
        <div class="header-titles">
          <h1 class="page-title">
            <app-icon name="wrench" [size]="24" class="title-icon"></app-icon>
            Demandes d'Intervention & SAV
          </h1>
          <p class="page-sub">
            Workflow de traitement SAV, qualification, priorisation et suivi d'interventions
          </p>
        </div>
        <div class="header-actions">
          <app-button variant="primary" size="md" iconName="plus" (btnClick)="openCreateModal()">
            Nouvelle demande
          </app-button>
        </div>
      </header>

      <!-- ── 2. KPI SUMMARY ROW ──────────────────────────────────────────────── -->
      <section class="kpi-grid fade-up" aria-label="Compteurs des demandes SAV">
        <div class="kpi-card kpi-all" (click)="clearStatusAndPriorityFilters()" [class.active-kpi]="!statusFilter && !priorityFilter">
          <div class="kpi-icon-badge">
            <app-icon name="wrench" [size]="18"></app-icon>
          </div>
          <div class="kpi-meta">
            <span class="kpi-val mono">{{ totalCount }}</span>
            <span class="kpi-lbl">Total demandes</span>
          </div>
        </div>

        <div class="kpi-card kpi-open" (click)="filterByStatus('open')" [class.active-kpi]="statusFilter === 'open'">
          <div class="kpi-icon-badge">
            <span class="dot dot-open"></span>
          </div>
          <div class="kpi-meta">
            <span class="kpi-val mono">{{ countByStatus('open') }}</span>
            <span class="kpi-lbl">Ouvertes</span>
          </div>
        </div>

        <div class="kpi-card kpi-progress" (click)="filterByStatus('in_progress')" [class.active-kpi]="statusFilter === 'in_progress'">
          <div class="kpi-icon-badge">
            <span class="dot dot-progress"></span>
          </div>
          <div class="kpi-meta">
            <span class="kpi-val mono">{{ countByStatus('in_progress') }}</span>
            <span class="kpi-lbl">En cours</span>
          </div>
        </div>

        <div class="kpi-card kpi-critical" (click)="filterByPriority('critical')" [class.active-kpi]="priorityFilter === 'critical'">
          <div class="kpi-icon-badge">
            <app-icon name="warning" [size]="16"></app-icon>
          </div>
          <div class="kpi-meta">
            <span class="kpi-val mono">{{ countByPriority('critical') }}</span>
            <span class="kpi-lbl">Critiques</span>
          </div>
        </div>

        <div class="kpi-card kpi-resolved" (click)="filterByStatus('resolved')" [class.active-kpi]="statusFilter === 'resolved'">
          <div class="kpi-icon-badge">
            <span class="dot dot-resolved"></span>
          </div>
          <div class="kpi-meta">
            <span class="kpi-val mono">{{ countByStatus('resolved') }}</span>
            <span class="kpi-lbl">Résolues</span>
          </div>
        </div>
      </section>

      <!-- ── 3. FILTER BAR ───────────────────────────────────────────────────── -->
      <section class="filter-card fade-up">
        <div class="filter-layout">
          <!-- Recherche textuelle -->
          <div class="filter-item filter-search">
            <div class="search-input-wrap">
              <span class="search-icon">🔍</span>
              <input
                type="text"
                class="filter-input"
                placeholder="Rechercher par référence, titre, motif, description…"
                [(ngModel)]="search"
                (ngModelChange)="onSearchInput($event)"
              />
              <button *ngIf="search" class="clear-search-btn" (click)="clearSearch()" title="Effacer la recherche">✕</button>
            </div>
          </div>

          <!-- Filtres Déroulants -->
          <div class="filter-item filter-control">
            <label class="filter-label">Statut</label>
            <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
              <option value="">Tous les statuts</option>
              <option value="open">Ouverte</option>
              <option value="in_progress">En cours</option>
              <option value="resolved">Résolue</option>
              <option value="closed">Clôturée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </div>

          <div class="filter-item filter-control">
            <label class="filter-label">Priorité</label>
            <select class="filter-select" [(ngModel)]="priorityFilter" (ngModelChange)="applyFilters()">
              <option value="">Toutes les priorités</option>
              <option value="critical">Critique (P0)</option>
              <option value="high">Élevée (P1)</option>
              <option value="normal">Normale (P2)</option>
              <option value="low">Basse (P3)</option>
            </select>
          </div>

          <div class="filter-item filter-control">
            <label class="filter-label">Client</label>
            <select class="filter-select" [(ngModel)]="customerFilter" (ngModelChange)="applyFilters()">
              <option value="">Tous les clients</option>
              <option *ngFor="let c of customers" [value]="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div class="filter-item filter-control">
            <label class="filter-label">Tri</label>
            <select class="filter-select" [(ngModel)]="sortField" (ngModelChange)="applyFilters()">
              <option value="created_at">Date de création</option>
              <option value="priority">Priorité (Critiques en 1er)</option>
              <option value="desired_at">Date souhaitée</option>
              <option value="updated_at">Dernière mise à jour</option>
            </select>
          </div>

          <!-- Bouton Refresh -->
          <div class="filter-item filter-action">
            <button
              type="button"
              class="btn-refresh"
              (click)="loadRequests()"
              title="Rafraîchir les demandes"
              [disabled]="loading"
            >
              <app-icon name="refresh" [size]="16" [class.spin-icon]="loading"></app-icon>
            </button>
          </div>
        </div>
      </section>

      <!-- ── 4. ALERT BANNER ─────────────────────────────────────────────────── -->
      <div *ngIf="alertMessage" class="alert-banner" [ngClass]="alertType">
        <span class="alert-text">{{ alertMessage }}</span>
        <button type="button" class="alert-close" (click)="alertMessage = ''">&times;</button>
      </div>

      <!-- ── 5. DATA TABLE / RESPONSIVE LIST ─────────────────────────────────── -->
      <div class="table-card fade-up">
        <!-- Loading Skeleton -->
        <div *ngIf="loading && requests.length === 0" class="table-loading">
          <div class="skeleton" style="height:3.5rem;margin-bottom:.5rem;" *ngFor="let i of [1,2,3,4,5]"></div>
        </div>

        <!-- Table Scroll Container -->
        <div class="table-scroll" *ngIf="!loading || requests.length > 0">
          <table class="data-table" style="min-width:1200px;">
            <thead>
              <tr>
                <th style="width: 70px;">ID</th>
                <th>Client (customer_id)</th>
                <th>Site (site_id)</th>
                <th>Module (device_id)</th>
                <th class="text-center">Priorité</th>
                <th class="text-center">Statut</th>
                <th>Description</th>
                <th>Date souhaitée</th>
                <th class="text-right" style="padding-right: 1.25rem;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let r of requests"
                class="table-row"
                (click)="openDetail(r)"
                tabindex="0"
                (keydown.enter)="openDetail(r)"
              >
                <!-- 1. ID -->
                <td>
                  <span class="mono text-muted text-xs font-semibold">#{{ r.id }}</span>
                </td>

                <!-- 2. Client -->
                <td>
                  <div class="font-semibold text-primary-light">{{ r.customer?.name || 'N/A' }}</div>
                  <div class="mono text-muted text-xs">customer_id: #{{ r.customer_id }}</div>
                </td>

                <!-- 3. Site -->
                <td>
                  <div class="font-medium" *ngIf="r.site">{{ r.site.name }}</div>
                  <div class="mono text-muted text-xs" *ngIf="r.site_id">site_id: #{{ r.site_id }}</div>
                  <div class="text-muted text-xs" *ngIf="!r.site_id">—</div>
                </td>

                <!-- 4. Module IoT -->
                <td>
                  <div class="font-bold mono text-primary-light" *ngIf="r.device">{{ r.device.serial_number || r.device.label }}</div>
                  <div class="mono text-muted text-xs" *ngIf="r.device_id">device_id: #{{ r.device_id }}</div>
                  <div class="text-muted text-xs" *ngIf="!r.device_id">—</div>
                </td>

                <!-- 5. Priorité -->
                <td class="text-center" (click)="$event.stopPropagation()">
                  <span class="badge badge-priority" [ngClass]="'prio-' + r.priority">
                    {{ getPriorityLabel(r.priority) }}
                  </span>
                </td>

                <!-- 6. Statut -->
                <td class="text-center" (click)="$event.stopPropagation()">
                  <div class="status-wrap">
                    <select
                      class="status-select-btn"
                      [ngClass]="'status-' + r.status"
                      [ngModel]="r.status"
                      (change)="quickChangeStatus(r, $event)"
                      title="Changer rapidement le statut"
                    >
                      <option value="open">🔵 Ouverte</option>
                      <option value="in_progress">🟡 En cours</option>
                      <option value="resolved">🟢 Résolue</option>
                      <option value="closed">⚪ Clôturée</option>
                      <option value="cancelled">🔴 Annulée</option>
                    </select>
                  </div>
                </td>

                <!-- 7. Description -->
                <td class="text-wrap" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" [title]="r.description">
                  {{ r.description }}
                </td>

                <!-- 8. Date souhaitée -->
                <td class="mono text-muted text-xs">
                  {{ r.desired_at ? (r.desired_at | date:'dd/MM/yyyy') : '—' }}
                </td>

                <!-- 9. Actions -->
                <td class="text-right" (click)="$event.stopPropagation()">
                  <div class="table-actions">
                    <button type="button" class="action-btn action-view" (click)="openDetail(r)" aria-label="Voir le détail" title="Détail & Historique"><app-icon name="info" [size]="15"></app-icon></button>
                    <button type="button" class="action-btn action-edit" (click)="openEditModal(r)" aria-label="Modifier" title="Modifier"><app-icon name="pencil" [size]="15"></app-icon></button>
                    <button type="button" class="action-btn action-delete" (click)="openDeleteConfirm(r)" aria-label="Supprimer" title="Supprimer"><app-icon name="trash" [size]="15"></app-icon></button>
                  </div>
                </td>
              </tr>

              <!-- État Vide -->
              <tr *ngIf="requests.length === 0 && !loading">
                <td colspan="9" class="empty-state">
                  <span>🔧</span>
                  <p class="empty-title">Aucune demande trouvée</p>
                  <p class="empty-sub">Aucune demande ne correspond à vos critères de recherche.</p>
                  <app-button variant="primary" size="sm" iconName="plus" (btnClick)="openCreateModal()">Créer une demande</app-button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Footer -->
        <div class="pagination" *ngIf="totalPages > 1">
          <div class="pagination-info">
            Affichage <strong>{{ paginationFrom }}-{{ paginationTo }}</strong> sur <strong>{{ totalCount }}</strong> demandes
          </div>
          <div class="pagination-controls">
            <app-button
              variant="secondary"
              size="sm"
              iconName="chevron-left"
              [disabled]="currentPage <= 1"
              (btnClick)="goToPage(currentPage - 1)"
            >
              Précédent
            </app-button>
            <span class="page-current mono">Page {{ currentPage }} / {{ totalPages }}</span>
            <app-button
              variant="secondary"
              size="sm"
              iconName="chevron-right"
              [disabled]="currentPage >= totalPages"
              (btnClick)="goToPage(currentPage + 1)"
            >
              Suivant
            </app-button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 6. MODAL CRÉATION / ÉDITION ──────────────────────────────────────── -->
    <app-modal
      [isOpen]="showFormModal"
      [title]="modalTitle"
      icon="🔧"
      size="2xl"
      [hasFooter]="true"
      (close)="closeFormModal()"
    >
      <form (ngSubmit)="saveRequest()" id="serviceRequestForm" class="popup-form-grid">
        <!-- Bannière d'erreur formulaire -->
        <div class="form-col-full" *ngIf="formError">
          <div class="popup-banner-error">
            <app-icon name="warning" [size]="16" class="banner-icon"></app-icon>
            <span>{{ formError }}</span>
          </div>
        </div>

        <!-- Client (Obligatoire) -->
        <div class="popup-field">
          <label class="popup-label">
            Client concerné <span class="required">*</span>
          </label>
          <select
            class="popup-select"
            [(ngModel)]="formData.customer_id"
            name="customer_id"
            required
            (change)="onCustomerSelectChange()"
          >
            <option [ngValue]="null" disabled>-- Choisir un client --</option>
            <option *ngFor="let c of customers" [ngValue]="c.id">{{ c.name }}</option>
          </select>
        </div>

        <!-- Site (Filtré) -->
        <div class="popup-field">
          <label class="popup-label">Site / Emplacement</label>
          <select
            class="popup-select"
            [(ngModel)]="formData.site_id"
            name="site_id"
            [disabled]="!formData.customer_id || availableSites.length === 0"
            (change)="onSiteSelectChange()"
          >
            <option [ngValue]="null">-- Aucun / Site non spécifié --</option>
            <option *ngFor="let s of availableSites" [ngValue]="s.id">📍 {{ s.name }}</option>
          </select>
          <span class="form-hint" *ngIf="formData.customer_id && availableSites.length === 0">
            Aucun site rattaché à ce client.
          </span>
        </div>

        <!-- Module IoT (Filtré) -->
        <div class="popup-field">
          <label class="popup-label">Module IoT rattaché</label>
          <select
            class="popup-select mono"
            [(ngModel)]="formData.device_id"
            name="device_id"
            [disabled]="!formData.customer_id"
          >
            <option [ngValue]="null">-- Aucun module particulier --</option>
            <option *ngFor="let d of availableDevices" [ngValue]="d.id">
              📶 {{ d.label || d.serial_number }}
            </option>
          </select>
        </div>

        <!-- Titre de la demande (Obligatoire) -->
        <div class="popup-field">
          <label class="popup-label">
            Titre de la demande <span class="required">*</span>
          </label>
          <input
            type="text"
            class="popup-input"
            placeholder="Ex: Déconnexion répétée module cuisine, alerte surchauffe…"
            [(ngModel)]="formData.title"
            name="title"
            required
          />
        </div>

        <!-- Motif / Type de panne -->
        <div class="popup-field">
          <label class="popup-label">Motif / Symptôme principal</label>
          <input
            type="text"
            class="popup-input"
            placeholder="Ex: Hors-ligne persistant, Capteur défaillant…"
            [(ngModel)]="formData.reason"
            name="reason"
          />
        </div>

        <!-- Priorité -->
        <div class="popup-field">
          <label class="popup-label">Niveau de priorité</label>
          <select class="popup-select" [(ngModel)]="formData.priority" name="priority">
            <option value="low">Basse (P3)</option>
            <option value="normal">Normale (P2)</option>
            <option value="high">Élevée (P1)</option>
            <option value="critical">Critique (P0 - Urgence)</option>
          </select>
        </div>

        <!-- Statut initial -->
        <div class="popup-field">
          <label class="popup-label">Statut</label>
          <select class="popup-select" [(ngModel)]="formData.status" name="status">
            <option value="open">Ouverte</option>
            <option value="in_progress">En cours</option>
            <option value="resolved">Résolue</option>
            <option value="closed">Clôturée</option>
            <option value="cancelled">Annulée</option>
          </select>
        </div>

        <!-- Date souhaitée -->
        <div class="popup-field">
          <label class="popup-label">Date souhaitée d'intervention</label>
          <input
            type="date"
            class="popup-input mono"
            [(ngModel)]="formData.desired_at"
            name="desired_at"
          />
        </div>

        <!-- Description complète (Obligatoire) -->
        <div class="popup-field form-col-full">
          <label class="popup-label">
            Description détaillée du problème <span class="required">*</span>
          </label>
          <textarea
            class="popup-textarea"
            rows="4"
            placeholder="Détaillez les observations, les tests effectués, l'impact sur l'installation…"
            [(ngModel)]="formData.description"
            name="description"
            required
          ></textarea>
        </div>
      </form>

      <!-- Footer Modal -->
      <div modal-footer class="popup-footer-actions">
        <app-button variant="secondary" size="md" (btnClick)="closeFormModal()" [disabled]="formSaving">
          Annuler
        </app-button>
        <app-button
          variant="primary"
          size="md"
          [isLoading]="formSaving"
          [disabled]="formSaving || !formData.customer_id || !formData.title || !formData.description"
          (btnClick)="saveRequest()"
        >
          {{ formSaving ? 'Enregistrement…' : (isEditing ? 'Mettre à jour' : 'Créer la demande') }}
        </app-button>
      </div>
    </app-modal>

    <!-- ── 7. MODAL DÉTAIL & TIMELINE HISTORIQUE ────────────────────────────── -->
    <app-modal
      [isOpen]="showDetailModal"
      [title]="detailModalTitle"
      icon="📋"
      size="2xl"
      [hasFooter]="true"
      (close)="closeDetailModal()"
    >
      <div class="detail-container" *ngIf="selectedItem">
        <!-- Top Status Banner -->
        <div class="detail-header-strip">
          <div class="detail-tags">
            <span class="badge badge-priority" [ngClass]="'prio-' + selectedItem.priority">
              Priorité : {{ getPriorityLabel(selectedItem.priority) }}
            </span>
            <span class="badge badge-status" [ngClass]="'status-' + selectedItem.status">
              Statut : {{ getStatusLabel(selectedItem.status) }}
            </span>
          </div>
          <h2 class="detail-heading">{{ selectedItem.title }}</h2>
          <p class="detail-reason-lead" *ngIf="selectedItem.reason">
            <strong>Motif :</strong> {{ selectedItem.reason }}
          </p>
        </div>

        <!-- Grid Cards Info -->
        <div class="detail-grid">
          <!-- Client & Site -->
          <div class="detail-card">
            <h4 class="detail-card-title">👤 Client & Emplacement</h4>
            <div class="detail-row">
              <span class="detail-lbl">Client :</span>
              <span class="detail-val font-semibold">{{ selectedItem.customer?.name || 'N/C' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">Site :</span>
              <span class="detail-val">{{ selectedItem.site?.name || 'Non rattaché à un site' }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedItem.site?.address">
              <span class="detail-lbl">Adresse :</span>
              <span class="detail-val text-muted text-xs">{{ selectedItem.site?.address }}</span>
            </div>
          </div>

          <!-- Module IoT & Dates -->
          <div class="detail-card">
            <h4 class="detail-card-title">📶 Équipement & Dates</h4>
            <div class="detail-row">
              <span class="detail-lbl">Module IoT :</span>
              <span class="detail-val mono font-semibold" *ngIf="selectedItem.device">
                {{ selectedItem.device.label || selectedItem.device.serial_number }}
              </span>
              <span class="detail-val text-muted" *ngIf="!selectedItem.device">Aucun module</span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">Date souhaitée :</span>
              <span class="detail-val mono">
                {{ selectedItem.desired_at ? (selectedItem.desired_at | date:'dd/MM/yyyy') : 'Non spécifiée' }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-lbl">Créée le :</span>
              <span class="detail-val mono text-xs">{{ selectedItem.created_at | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <div class="detail-row" *ngIf="selectedItem.resolved_at">
              <span class="detail-lbl">Résolue le :</span>
              <span class="detail-val mono text-ok font-semibold">{{ selectedItem.resolved_at | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
          </div>
        </div>

        <!-- Description Box -->
        <div class="detail-card">
          <h4 class="detail-card-title">📝 Description du problème</h4>
          <div class="detail-desc-content">{{ selectedItem.description }}</div>
        </div>

        <!-- Quick Status Progression Toolbar -->
        <div class="detail-card status-change-section">
          <h4 class="detail-card-title">⚡ Faire évoluer le statut</h4>
          <div class="status-btn-row">
            <button
              *ngFor="let st of availableStatuses"
              type="button"
              class="btn-status-step"
              [ngClass]="'step-' + st"
              [class.active-step]="selectedItem.status === st"
              (click)="openStatusCommentModal(st)"
            >
              {{ getStatusLabel(st) }}
            </button>
          </div>
        </div>

        <!-- Timeline Historique -->
        <div class="detail-card timeline-card">
          <h4 class="detail-card-title">⏳ Historique des événements</h4>
          
          <div *ngIf="loadingHistory" class="history-loading">
            <div class="skeleton" style="height:2rem;margin-bottom:.5rem;" *ngFor="let i of [1,2]"></div>
          </div>

          <div *ngIf="!loadingHistory && itemHistories.length === 0" class="history-empty text-muted text-xs">
            Aucun historique de changement enregistré pour le moment.
          </div>

          <div class="timeline-list" *ngIf="!loadingHistory && itemHistories.length > 0">
            <div class="timeline-entry" *ngFor="let h of itemHistories">
              <div class="timeline-dot"></div>
              <div class="timeline-body">
                <div class="timeline-top">
                  <span class="timeline-title">
                    Changement de {{ h.field === 'status' ? 'statut' : h.field }}
                  </span>
                  <span class="timeline-time mono text-muted text-xs">{{ h.created_at | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
                <div class="timeline-diff">
                  <span class="val-old" *ngIf="h.old_value">{{ h.old_value }}</span>
                  <span class="val-arrow" *ngIf="h.old_value">➔</span>
                  <span class="val-new">{{ h.new_value }}</span>
                </div>
                <div class="timeline-author" *ngIf="h.changed_by">
                  Par 👤 {{ h.changed_by.name || h.changed_by.email }}
                </div>
                <div class="timeline-quote" *ngIf="h.comment">
                  💬 <em>« {{ h.comment }} »</em>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail Modal Footer -->
      <div modal-footer class="popup-footer-actions">
        <app-button variant="secondary" size="md" (btnClick)="closeDetailModal()">
          Fermer
        </app-button>
        <app-button variant="primary" size="md" iconName="pencil" (btnClick)="switchToEditFromDetail()">
          Modifier cette demande
        </app-button>
      </div>
    </app-modal>

    <!-- ── 8. MODAL COMMENTAIRE CHANGEMENT DE STATUT ───────────────────────── -->
    <app-modal
      [isOpen]="showStatusModal"
      [title]="statusModalTitle"
      icon="⚡"
      size="md"
      [hasFooter]="true"
      (close)="showStatusModal = false"
    >
      <div class="status-change-preview-box" *ngIf="selectedItem">
        <div class="status-transition-strip">
          <div class="status-step-pill">
            <span class="status-step-label">Actuel</span>
            <span class="badge badge-status" [ngClass]="'status-' + selectedItem.status">
              {{ getStatusLabel(selectedItem.status) }}
            </span>
          </div>
          <span class="status-transition-arrow">➔</span>
          <div class="status-step-pill">
            <span class="status-step-label">Nouveau</span>
            <span class="badge badge-status" [ngClass]="'status-' + targetStatus">
              {{ getStatusLabel(targetStatus) }}
            </span>
          </div>
        </div>
      </div>

      <div class="popup-field">
        <label class="popup-label">Commentaire explicatif (optionnel)</label>
        <textarea
          class="popup-textarea"
          rows="3"
          placeholder="Ex: Intervention planifiée avec le client, pièce reçue, diagnostic confirmé…"
          [(ngModel)]="statusComment"
        ></textarea>
      </div>

      <div modal-footer class="popup-footer-actions">
        <app-button variant="secondary" size="md" (btnClick)="showStatusModal = false">
          Annuler
        </app-button>
        <app-button variant="primary" size="md" iconName="check" (btnClick)="confirmStatusChange()">
          Confirmer le statut
        </app-button>
      </div>
    </app-modal>

    <!-- ── 9. CONFIRM DELETE MODAL ─────────────────────────────────────────── -->
    <app-confirm-modal
      [isOpen]="showDeleteModal"
      title="Supprimer la demande SAV"
      [message]="'Êtes-vous sûr de vouloir supprimer définitivement la demande « ' + (itemToDelete?.reference || itemToDelete?.title || '') + ' » ?'"
      subMessage="Cette action est irréversible et supprimera également l'historique associé."
      confirmText="Supprimer définitivement"
      cancelText="Annuler"
      type="danger"
      (confirm)="confirmDelete()"
      (cancel)="showDeleteModal = false; itemToDelete = null"
    ></app-confirm-modal>
  `,
  styles: [`
    /* ════════════════════════════════════════════════════════════════════════════
       1. HOST & PAGE WRAPPER LAYOUT (Flawless Responsive Container)
       ════════════════════════════════════════════════════════════════════════════ */
    :host {
      display: block;
      width: 100%;
      box-sizing: border-box;
    }

    .interventions-page {
      width: 100%;
      max-width: 1440px;
      margin: 0 auto;
      padding: 1.75rem 2rem;
      box-sizing: border-box;
    }

    /* ════════════════════════════════════════════════════════════════════════════
       2. PAGE HEADER
       ════════════════════════════════════════════════════════════════════════════ */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1.25rem;
      margin-bottom: 1.65rem;
      flex-wrap: wrap;
    }

    .header-titles {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--heading);
      letter-spacing: -0.02em;
      display: inline-flex;
      align-items: center;
      gap: 0.65rem;
    }

    .title-icon {
      color: var(--primary);
    }

    .page-sub {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.85rem;
      line-height: 1.45;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    /* ════════════════════════════════════════════════════════════════════════════
       3. KPI STATS CARDS (Modern Compact Responsive Grid)
       ════════════════════════════════════════════════════════════════════════════ */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.85rem;
      margin-bottom: 1.35rem;
    }

    .kpi-card {
      background: var(--card);
      border: 1px solid var(--border-card);
      border-radius: var(--radius);
      padding: 1rem 1.15rem;
      display: flex;
      align-items: center;
      gap: 0.9rem;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      border-color: var(--border-strong);
      box-shadow: var(--shadow);
    }

    .kpi-card.active-kpi {
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary), 0 4px 18px var(--primary-glow);
      background: var(--card-hover);
    }

    .kpi-icon-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(148, 163, 184, 0.08);
      border: 1px solid var(--border);
      flex-shrink: 0;
    }

    .kpi-all .kpi-icon-badge      { color: var(--primary); background: var(--chip-bg); border-color: var(--chip-border); }
    .kpi-open .kpi-icon-badge     { color: var(--info-text); background: var(--info-bg); border-color: var(--info-border); }
    .kpi-progress .kpi-icon-badge { color: var(--warn-text); background: var(--warn-bg); border-color: var(--warn-border); }
    .kpi-critical .kpi-icon-badge { color: var(--crit-text); background: var(--crit-bg); border-color: var(--crit-border); }
    .kpi-resolved .kpi-icon-badge { color: var(--ok-text); background: var(--ok-bg); border-color: var(--ok-border); }

    .kpi-meta {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
    }

    .kpi-val {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--heading);
      line-height: 1.1;
    }

    .kpi-lbl {
      font-size: 0.74rem;
      color: var(--text-muted);
      font-weight: 500;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    /* Indicator Dots */
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-open     { background: #38bdf8; box-shadow: 0 0 6px rgba(56, 189, 248, 0.6); }
    .dot-progress { background: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.6); }
    .dot-resolved { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.6); }

    /* ════════════════════════════════════════════════════════════════════════════
       4. FILTER CARD (Responsive Multi-Filter Grid)
       ════════════════════════════════════════════════════════════════════════════ */
    .filter-card {
      background: var(--card);
      border: 1px solid var(--border-card);
      border-radius: var(--radius);
      padding: 0.95rem 1.15rem;
      margin-bottom: 1.35rem;
      box-shadow: var(--shadow-sm);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    .filter-layout {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .filter-search {
      flex: 2;
      min-width: 240px;
    }

    .filter-control {
      flex: 1;
      min-width: 140px;
    }

    .filter-action {
      flex: 0 0 auto;
    }

    .filter-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .search-icon {
      position: absolute;
      left: 0.85rem;
      font-size: 0.85rem;
      pointer-events: none;
      opacity: 0.7;
    }

    .search-input-wrap .filter-input {
      padding-left: 2.3rem;
      padding-right: 2rem;
      width: 100%;
    }

    .clear-search-btn {
      position: absolute;
      right: 0.65rem;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.8rem;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
    }
    .clear-search-btn:hover { color: var(--heading); }

    .btn-refresh {
      height: 2.5rem;
      width: 2.5rem;
      border-radius: 0.75rem;
      background: var(--input-bg);
      border: 1px solid var(--border-input);
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-refresh:hover {
      color: var(--primary);
      border-color: var(--border-strong);
      background: var(--input-bg-focus);
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* ════════════════════════════════════════════════════════════════════════════
       5. ALERT BANNER
       ════════════════════════════════════════════════════════════════════════════ */
    .alert-banner {
      padding: 0.75rem 1.15rem;
      border-radius: 0.75rem;
      margin-bottom: 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      animation: fadeUp 0.3s ease both;
    }
    .alert-banner.success { background: var(--ok-bg); color: var(--ok-text); border: 1px solid var(--ok-border); }
    .alert-banner.error   { background: var(--crit-bg); color: var(--crit-text); border: 1px solid var(--crit-border); }
    .alert-close {
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      color: inherit;
      padding: 0 0.25rem;
      opacity: 0.7;
    }
    .alert-close:hover { opacity: 1; }

    /* ════════════════════════════════════════════════════════════════════════════
       6. TABLE & CELL STYLING
       ════════════════════════════════════════════════════════════════════════════ */
    .th-ref     { width: 28%; min-width: 220px; }
    .th-client  { width: 20%; min-width: 170px; }
    .th-device  { width: 14%; min-width: 130px; }
    .th-prio    { width: 11%; min-width: 110px; }
    .th-status  { width: 13%; min-width: 120px; }
    .th-date    { width: 14%; min-width: 130px; }
    .th-actions { width: 10%; min-width: 110px; }

    .table-row {
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .table-row:focus {
      outline: 2px solid var(--primary);
      outline-offset: -2px;
    }

    .ref-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.2rem;
    }

    .ref-badge {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--primary);
      background: var(--chip-bg);
      border: 1px solid var(--chip-border);
      padding: 0.12rem 0.45rem;
      border-radius: 0.4rem;
      display: inline-block;
      letter-spacing: 0.02em;
    }

    .prio-dot-mini {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .dot-prio-critical { background: var(--crit); box-shadow: 0 0 6px var(--crit-glow); }
    .dot-prio-high     { background: var(--warn); box-shadow: 0 0 6px var(--warn-glow); }
    .dot-prio-normal   { background: var(--primary); }
    .dot-prio-low      { background: var(--text-dim); }

    .title-text {
      font-weight: 600;
      color: var(--heading);
      font-size: 0.875rem;
      line-height: 1.35;
      word-break: break-word;
    }

    .reason-text {
      font-size: 0.74rem;
      color: var(--text-muted);
      margin-top: 0.15rem;
      word-break: break-word;
    }

    .reason-tag {
      color: var(--text-dim);
      font-weight: 500;
    }

    .client-box {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      align-items: flex-start;
    }

    .site-sub {
      font-size: 0.75rem;
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      line-height: 1.2;
    }

    .site-pin { font-size: 0.7rem; }

    .device-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.76rem;
      padding: 0.2rem 0.55rem;
      background: var(--input-bg);
      border-radius: 0.5rem;
      border: 1px solid var(--border-input);
      color: var(--text-secondary);
      font-weight: 500;
    }

    .device-icon {
      color: var(--primary);
    }

    /* Badges Priorités */
    .badge-priority {
      padding: 0.22rem 0.65rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      display: inline-block;
      border: 1px solid transparent;
    }
    .prio-critical { background: var(--crit-bg); color: var(--crit-text); border-color: var(--crit-border); }
    .prio-high     { background: var(--warn-bg); color: var(--warn-text); border-color: var(--warn-border); }
    .prio-normal   { background: var(--chip-bg); color: var(--chip-text); border-color: var(--chip-border); }
    .prio-low      { background: rgba(148, 163, 184, 0.08); color: var(--text-muted); border-color: var(--border); }

    /* Statut Dropdown Compact */
    .status-wrap {
      display: inline-flex;
      justify-content: center;
      width: 100%;
    }

    .status-select-btn {
      padding: 0.25rem 0.65rem;
      border-radius: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      outline: none;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .status-open        { background: var(--info-bg); color: var(--info-text); border-color: var(--info-border); }
    .status-in_progress { background: var(--warn-bg); color: var(--warn-text); border-color: var(--warn-border); }
    .status-resolved    { background: var(--ok-bg); color: var(--ok-text); border-color: var(--ok-border); }
    .status-closed      { background: rgba(100, 116, 139, 0.12); color: var(--text-muted); border-color: var(--border); }
    .status-cancelled   { background: var(--crit-bg); color: var(--crit-text); border-color: var(--crit-border); }

    .date-desired {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text);
    }

    .date-created {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-top: 0.1rem;
    }

    /* Action Buttons */
    .action-btn {
      width: 30px;
      height: 30px;
      border-radius: 0.45rem;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--text-muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      padding: 0;
    }

    .action-view:hover   { color: var(--primary); border-color: var(--border-strong); background: var(--chip-bg); }
    .action-edit:hover   { color: var(--warn-text); border-color: var(--warn-border); background: var(--warn-bg); }
    .action-delete:hover { color: var(--crit-text); border-color: var(--crit-border); background: var(--crit-bg); }

    /* Empty State */
    .empty-row {
      padding: 0;
    }
    .empty-state {
      text-align: center;
      padding: 3.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.65rem;
    }
    .empty-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: rgba(148, 163, 184, 0.06);
      border: 1px solid var(--border-card);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-dim);
      margin-bottom: 0.5rem;
    }
    .empty-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--heading);
      margin: 0;
    }
    .empty-sub {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin: 0 0 0.75rem;
      max-width: 420px;
      line-height: 1.45;
    }

    /* Pagination */
    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .page-current {
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-weight: 600;
    }

    /* ════════════════════════════════════════════════════════════════════════════
       7. DETAIL MODAL STYLES
       ════════════════════════════════════════════════════════════════════════════ */
    .detail-container {
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }

    .detail-header-strip {
      background: var(--input-bg);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-sm);
      padding: 1.1rem 1.25rem;
    }

    .detail-tags {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.6rem;
      flex-wrap: wrap;
    }

    .detail-heading {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--heading);
      margin: 0 0 0.35rem;
      line-height: 1.3;
    }

    .detail-reason-lead {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .detail-card {
      background: var(--card);
      border: 1px solid var(--border-card);
      border-radius: var(--radius-sm);
      padding: 1.1rem 1.25rem;
    }

    .detail-card-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--heading);
      margin: 0 0 0.85rem;
      letter-spacing: -0.01em;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.825rem;
      padding: 0.35rem 0;
      border-bottom: 1px dashed var(--border);
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-lbl { color: var(--text-muted); }
    .detail-val { color: var(--text); }

    .detail-desc-content {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--text-secondary);
      white-space: pre-wrap;
      background: var(--input-bg);
      border: 1px solid var(--border-input);
      border-radius: 0.5rem;
      padding: 0.85rem 1rem;
    }

    /* Status Progression Step Buttons */
    .status-btn-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .btn-status-step {
      padding: 0.4rem 0.85rem;
      border-radius: 0.5rem;
      font-size: 0.78rem;
      font-weight: 600;
      border: 1px solid var(--border-input);
      background: var(--input-bg);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .btn-status-step:hover {
      border-color: var(--border-strong);
      color: var(--heading);
      transform: translateY(-1px);
    }

    .btn-status-step.active-step {
      font-weight: 700;
      box-shadow: 0 0 0 1px currentColor, 0 2px 10px rgba(0,0,0,0.2);
    }
    .active-step.step-open        { background: var(--info-bg); color: var(--info-text); border-color: var(--info-border); }
    .active-step.step-in_progress { background: var(--warn-bg); color: var(--warn-text); border-color: var(--warn-border); }
    .active-step.step-resolved    { background: var(--ok-bg); color: var(--ok-text); border-color: var(--ok-border); }
    .active-step.step-closed      { background: rgba(100, 116, 139, 0.2); color: var(--text); border-color: var(--border-strong); }
    .active-step.step-cancelled   { background: var(--crit-bg); color: var(--crit-text); border-color: var(--crit-border); }

    /* Timeline */
    .timeline-list {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      position: relative;
      padding-left: 1.25rem;
      border-left: 2px solid var(--border-card);
      margin-left: 0.35rem;
    }

    .timeline-entry { position: relative; }

    .timeline-dot {
      position: absolute;
      left: -1.6rem;
      top: 0.25rem;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 8px var(--primary-glow);
      border: 2px solid var(--card);
    }

    .timeline-body {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .timeline-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
    }
    .timeline-title { font-weight: 700; color: var(--heading); }

    .timeline-diff {
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .val-old   { text-decoration: line-through; color: var(--text-dim); }
    .val-arrow { color: var(--text-muted); font-size: 0.75rem; }
    .val-new   { font-weight: 700; color: var(--primary); }

    .timeline-author { font-size: 0.74rem; color: var(--text-muted); }
    .timeline-quote  { font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.15rem; background: var(--input-bg); padding: 0.3rem 0.6rem; border-radius: 4px; }

    /* Status change preview in modal */
    .status-change-preview-box {
      background: var(--card-hover);
      border: 1px solid var(--border-card);
      border-radius: 0.75rem;
      padding: 0.85rem 1rem;
      margin-bottom: 1rem;
    }
    .status-transition-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .status-step-pill {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .status-step-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status-transition-arrow {
      color: var(--primary);
      font-size: 1.1rem;
      font-weight: 700;
    }

    .form-hint {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    /* ════════════════════════════════════════════════════════════════════════════
       8. RESPONSIVE BREAKPOINTS (360px -> Tablet -> Desktop)
       ════════════════════════════════════════════════════════════════════════════ */
    @media (max-width: 1100px) {
      .kpi-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 840px) {
      .interventions-page {
        padding: 1.25rem 1rem;
      }
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
      .header-actions {
        width: 100%;
      }
      .header-actions app-button {
        width: 100%;
      }
      .kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 580px) {
      .interventions-page {
        padding: 1rem 0.75rem;
      }
      .page-title {
        font-size: 1.25rem;
      }
      .kpi-grid {
        grid-template-columns: 1fr;
      }
      .filter-layout {
        flex-direction: column;
        align-items: stretch;
      }
      .filter-search, .filter-control {
        min-width: 100%;
      }
      .filter-action {
        width: 100%;
      }
      .btn-refresh {
        width: 100%;
      }
    }
  `]
})
export class InterventionsComponent implements OnInit {
  // Data
  requests: ServiceRequest[] = [];
  customers: Customer[] = [];
  allSites: Site[] = [];
  allDevices: Device[] = [];
  availableSites: Site[] = [];
  availableDevices: Device[] = [];

  // Filter & Pagination State
  search = '';
  statusFilter: SRStatus | '' = '';
  priorityFilter: SRPriority | '' = '';
  customerFilter: number | '' = '';
  sortField: 'created_at' | 'priority' | 'desired_at' | 'updated_at' = 'created_at';
  currentPage = 1;
  totalPages = 1;
  totalCount = 0;
  paginationFrom = 0;
  paginationTo = 0;

  // Search RxJS Subject for debounce
  private searchSubject = new Subject<string>();

  // Load state
  loading = false;
  alertMessage = '';
  alertType: 'success' | 'error' = 'success';

  // Form Modal State
  showFormModal = false;
  isEditing = false;
  formSaving = false;
  formError = '';
  editingItem: ServiceRequest | null = null;

  formData: StoreServiceRequestPayload = {
    customer_id: null as any,
    site_id: null,
    device_id: null,
    title: '',
    reason: '',
    description: '',
    priority: 'normal',
    status: 'open',
    desired_at: ''
  };

  // Detail Modal State
  showDetailModal = false;
  selectedItem: ServiceRequest | null = null;
  itemHistories: ServiceRequestHistory[] = [];
  loadingHistory = false;

  // Status Change Modal State
  showStatusModal = false;
  targetStatus: SRStatus = 'open';
  statusComment = '';

  // Delete Confirm Modal State
  showDeleteModal = false;
  itemToDelete: ServiceRequest | null = null;

  availableStatuses: SRStatus[] = ['open', 'in_progress', 'resolved', 'closed', 'cancelled'];

  constructor(
    private srService: ServiceRequestService,
    private customerService: CustomerService,
    private siteService: SiteService,
    private deviceService: DeviceService,
    private cdr: ChangeDetectorRef
  ) {}

  get modalTitle(): string {
    return this.isEditing
      ? 'Modifier la Demande ' + (this.editingItem?.reference || '')
      : 'Nouvelle Demande d\'Intervention';
  }

  get detailModalTitle(): string {
    return 'Détail Demande — ' + (this.selectedItem?.reference || ('SAV-#' + (this.selectedItem?.id ?? '')));
  }

  get statusModalTitle(): string {
    return 'Changer le statut vers : ' + this.getStatusLabel(this.targetStatus);
  }

  ngOnInit(): void {
    this.loadPreloadData();
    this.loadRequests();

    // Debounce search input
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadRequests();
    });
  }

  // ── CHARGEMENT INITIAL DES DONNÉES DE SÉLECTION (CLIENTS, SITES, MODULES) ─
  loadPreloadData(): void {
    // Customers
    this.customerService.getAll({ per_page: 100 }).subscribe({
      next: (res: any) => {
        this.customers = Array.isArray(res) ? res : (res.data || []);
      }
    });

    // Sites
    this.siteService.getAll({ per_page: 200 }).subscribe({
      next: (res: any) => {
        this.allSites = Array.isArray(res) ? res : (res.data || []);
      }
    });

    // Devices
    this.deviceService.getAll({ per_page: 200 }).subscribe({
      next: (res: any) => {
        this.allDevices = Array.isArray(res) ? res : (res.data || []);
      }
    });
  }

  // ── CHARGEMENT DE LA LISTE PRINCIPALE DES DEMANDES DE SAV ────────────────
  loadRequests(): void {
    this.loading = true;
    const filter: SRFilter = {
      search: this.search,
      status: this.statusFilter,
      priority: this.priorityFilter,
      customer_id: this.customerFilter,
      sort: this.sortField,
      page: this.currentPage,
      per_page: 15
    };

    this.srService.getAll(filter).subscribe({
      next: (res) => {
        this.requests = res.data || [];
        this.currentPage = res.current_page || 1;
        this.totalPages = res.last_page || 1;
        this.totalCount = res.total || 0;
        this.paginationFrom = res.from || 0;
        this.paginationTo = res.to || 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.showAlert('Erreur lors du chargement des demandes d\'intervention.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  // ── RECHERCHE ET FILTRES ──────────────────────────────────────────────────
  onSearchInput(val: string): void {
    this.searchSubject.next(val);
  }

  clearSearch(): void {
    this.search = '';
    this.currentPage = 1;
    this.loadRequests();
  }

  clearStatusAndPriorityFilters(): void {
    this.statusFilter = '';
    this.priorityFilter = '';
    this.currentPage = 1;
    this.loadRequests();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadRequests();
  }

  filterByStatus(st: SRStatus): void {
    this.statusFilter = this.statusFilter === st ? '' : st;
    this.applyFilters();
  }

  filterByPriority(prio: SRPriority): void {
    this.priorityFilter = this.priorityFilter === prio ? '' : prio;
    this.applyFilters();
  }

  countByStatus(st: SRStatus): number {
    return this.requests.filter(r => r.status === st).length;
  }

  countByPriority(prio: SRPriority): number {
    return this.requests.filter(r => r.priority === prio).length;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
    this.loadRequests();
  }

  // ── LABELS UTILITAIRES ────────────────────────────────────────────────────
  getPriorityLabel(prio: string): string {
    switch (prio) {
      case 'critical': return 'Critique (P0)';
      case 'high':     return 'Élevée (P1)';
      case 'normal':   return 'Normale (P2)';
      case 'low':      return 'Basse (P3)';
      default:         return prio;
    }
  }

  getStatusLabel(st: string): string {
    switch (st) {
      case 'open':        return 'Ouverte';
      case 'in_progress': return 'En cours';
      case 'resolved':    return 'Résolue';
      case 'closed':      return 'Clôturée';
      case 'cancelled':   return 'Annulée';
      default:            return st;
    }
  }

  // ── CASCADING DROPDOWNS FORMULAIRE (Client -> Site -> Module) ─────────────
  onCustomerSelectChange(): void {
    const custId = this.formData.customer_id;
    if (!custId) {
      this.availableSites = [];
      this.availableDevices = [];
      this.formData.site_id = null;
      this.formData.device_id = null;
      return;
    }

    // Filtrer les sites par client
    this.availableSites = this.allSites.filter(s => s.customer_id === Number(custId));
    this.formData.site_id = null;

    // Filtrer les devices
    this.updateAvailableDevices();
  }

  onSiteSelectChange(): void {
    this.updateAvailableDevices();
  }

  private updateAvailableDevices(): void {
    const custId = Number(this.formData.customer_id);
    const siteId = Number(this.formData.site_id);

    if (siteId) {
      this.availableDevices = this.allDevices.filter(d => d.site_id === siteId);
    } else if (custId) {
      // Trouver tous les sites du client
      const siteIds = this.allSites.filter(s => s.customer_id === custId).map(s => s.id);
      this.availableDevices = this.allDevices.filter(d => siteIds.includes(d.site_id));
    } else {
      this.availableDevices = [];
    }
  }

  // ── CREATION / EDITION MODAL ──────────────────────────────────────────────
  openCreateModal(): void {
    this.isEditing = false;
    this.editingItem = null;
    this.formError = '';
    this.formData = {
      customer_id: null as any,
      site_id: null,
      device_id: null,
      title: '',
      reason: '',
      description: '',
      priority: 'normal',
      status: 'open',
      desired_at: ''
    };
    this.availableSites = [];
    this.availableDevices = [];
    this.showFormModal = true;
  }

  openEditModal(item: ServiceRequest): void {
    this.isEditing = true;
    this.editingItem = item;
    this.formError = '';

    const formattedDesiredAt = item.desired_at
      ? new Date(item.desired_at).toISOString().substring(0, 10)
      : '';

    this.formData = {
      customer_id: item.customer_id,
      site_id: item.site_id,
      device_id: item.device_id,
      title: item.title,
      reason: item.reason || '',
      description: item.description,
      priority: item.priority,
      status: item.status,
      desired_at: formattedDesiredAt
    };

    // Pre-populate cascading lists
    this.availableSites = this.allSites.filter(s => s.customer_id === item.customer_id);
    this.updateAvailableDevices();
    this.showFormModal = true;
  }

  closeFormModal(): void {
    this.showFormModal = false;
  }

  saveRequest(): void {
    if (!this.formData.customer_id) {
      this.formError = 'Veuillez sélectionner un client.';
      return;
    }
    if (!this.formData.title) {
      this.formError = 'Le titre de la demande est obligatoire.';
      return;
    }
    if (!this.formData.description) {
      this.formError = 'La description est obligatoire.';
      return;
    }

    this.formSaving = true;
    this.formError = '';

    if (this.isEditing && this.editingItem) {
      this.srService.update(this.editingItem.id, this.formData).subscribe({
        next: (updated) => {
          this.formSaving = false;
          this.showFormModal = false;
          this.showAlert(`Demande ${updated.reference || ''} mise à jour avec succès.`, 'success');
          this.loadRequests();
        },
        error: (err) => {
          this.formSaving = false;
          this.formError = err.error?.message || 'Erreur lors de la mise à jour de la demande.';
        }
      });
    } else {
      this.srService.create(this.formData).subscribe({
        next: (created) => {
          this.formSaving = false;
          this.showFormModal = false;
          this.showAlert(`Demande ${created.reference || ''} créée avec succès.`, 'success');
          this.loadRequests();
        },
        error: (err) => {
          this.formSaving = false;
          this.formError = err.error?.message || 'Erreur lors de la création de la demande.';
        }
      });
    }
  }

  // ── DETAIL & HISTORIQUE MODAL ─────────────────────────────────────────────
  openDetail(item: ServiceRequest): void {
    this.selectedItem = item;
    this.showDetailModal = true;
    this.loadingHistory = true;
    this.itemHistories = [];

    // Charger l'historique complet via l'API
    this.srService.getHistories(item.id).subscribe({
      next: (hists) => {
        this.itemHistories = hists;
        this.loadingHistory = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingHistory = false;
        this.cdr.markForCheck();
      }
    });
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedItem = null;
  }

  switchToEditFromDetail(): void {
    if (!this.selectedItem) return;
    const item = this.selectedItem;
    this.closeDetailModal();
    this.openEditModal(item);
  }

  // ── CHANGEMENT DE STATUT (QUICK + COMMENT) ────────────────────────────────
  quickChangeStatus(item: ServiceRequest, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStatus = select.value as SRStatus;
    if (newStatus === item.status) return;

    this.selectedItem = item;
    this.openStatusCommentModal(newStatus);
  }

  openStatusCommentModal(st: SRStatus): void {
    if (!this.selectedItem) return;
    if (this.selectedItem.status === st) return;

    this.targetStatus = st;
    this.statusComment = '';
    this.showStatusModal = true;
  }

  confirmStatusChange(): void {
    if (!this.selectedItem) return;

    const id = this.selectedItem.id;
    const st = this.targetStatus;
    const comment = this.statusComment;

    this.srService.updateStatus(id, st, comment).subscribe({
      next: () => {
        this.showStatusModal = false;
        this.showAlert(`Statut mis à jour vers "${this.getStatusLabel(st)}".`, 'success');
        
        // Mettre à jour l'élément en mémoire si la modal détail est ouverte
        if (this.selectedItem && this.selectedItem.id === id) {
          this.selectedItem.status = st;
          // Recharger l'historique
          this.srService.getHistories(id).subscribe(hists => this.itemHistories = hists);
        }

        this.loadRequests();
      },
      error: (err) => {
        this.showStatusModal = false;
        this.showAlert(err.error?.message || 'Erreur lors du changement de statut.', 'error');
      }
    });
  }

  // ── SUPPRESSION ────────────────────────────────────────────────────────────
  openDeleteConfirm(item: ServiceRequest): void {
    this.itemToDelete = item;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (!this.itemToDelete) return;
    const id = this.itemToDelete.id;
    const ref = this.itemToDelete.reference || `#${id}`;

    this.srService.delete(id).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.itemToDelete = null;
        this.showAlert(`Demande ${ref} supprimée avec succès.`, 'success');
        this.loadRequests();
      },
      error: (err) => {
        this.showDeleteModal = false;
        this.showAlert(err.error?.message || 'Erreur lors de la suppression.', 'error');
      }
    });
  }

  // ── HELPER ALERT ──────────────────────────────────────────────────────────
  showAlert(msg: string, type: 'success' | 'error'): void {
    this.alertMessage = msg;
    this.alertType = type;
    setTimeout(() => {
      if (this.alertMessage === msg) {
        this.alertMessage = '';
        this.cdr.markForCheck();
      }
    }, 5000);
  }
}
