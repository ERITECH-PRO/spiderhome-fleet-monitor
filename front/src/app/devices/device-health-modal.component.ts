import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ChangeDetectorRef, ChangeDetectionStrategy, ViewEncapsulation,
  ViewChild, ElementRef, HostListener
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { HeapPoint } from '../services/dashboard.service';
import { DeviceHealthData } from '../services/device.service';
import { HeapChartComponent } from '../shared/components/heap-chart/heap-chart.component';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';

export type DiagTab = 'summary' | 'heap' | 'events' | 'all';

@Component({
  selector: 'app-device-health-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, DatePipe, HeapChartComponent, ButtonComponent, IconComponent],
  template: `
    <!-- Backdrop Overlay -->
    <div class="diag-backdrop" *ngIf="isOpen" (click)="onBackdropClick($event)" role="dialog" aria-modal="true">
      <div class="diag-panel" id="diag-panel">

        <!-- 1. HEADER (Fixed at top) -->
        <header class="diag-header">
          <div class="diag-header-left">
            <span class="diag-icon-wrap"><app-icon name="heart-pulse" [size]="20"></app-icon></span>
            <div>
              <div class="diag-title-row">
                <h2 class="diag-title">Fiche Diagnostic Unifiée — {{ data?.module?.info?.guid || data?.module?.serial_number || deviceId }}</h2>
                <span class="badge-status" *ngIf="data?.module" [ngClass]="'badge-' + data.module.status">
                  <span class="dot" [ngClass]="'dot-' + data.module.status"></span>
                  {{ data.module.status | uppercase }}
                </span>
              </div>
              <p class="diag-subtitle">Registre Métier, Installation & Télémétrie Legacy</p>
            </div>
          </div>
          <button class="diag-close-btn" (click)="onClose()" aria-label="Fermer la boîte de dialogue" title="Fermer (Échap)">
            <app-icon name="x" [size]="15" aria-hidden="true"></app-icon>
          </button>
        </header>

        <!-- NAVIGATION TABS -->
        <nav class="diag-tabs" *ngIf="!loading && !error && data?.module">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'summary'"
            (click)="setTab('summary')"
          >
            📊 Synthèse & Installation
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'heap'"
            (click)="setTab('heap')"
          >
            📈 Télémétrie Heap ({{ safePoints.length }} pts)
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'events'"
            (click)="setTab('events')"
          >
            📜 Événements & Logs ({{ data.module.recent_events.length }})
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'all'"
            (click)="setTab('all')"
          >
            📑 Vue Complète (Tout)
          </button>
        </nav>

        <!-- 2. LOADING STATE -->
        <div class="diag-body-loading" *ngIf="loading">
          <div class="loading-container">
            <div class="spinner-ring"></div>
            <p>Chargement des données de diagnostic unifiées…</p>
          </div>
        </div>

        <!-- 3. ERROR STATE -->
        <div class="diag-body-error" *ngIf="!loading && error">
          <div class="error-container">
            <span class="error-icon">⚠️</span>
            <h3>Erreur de chargement</h3>
            <p class="error-msg">{{ error }}</p>
            <button class="retry-btn" (click)="loadHealth()">↺ Réessayer</button>
          </div>
        </div>

        <!-- 4. SCROLLABLE CENTRAL BODY -->
        <main
          #scrollBody
          class="diag-body scrollable"
          tabindex="0"
          *ngIf="!loading && !error && data?.module"
          aria-label="Contenu diagnostic du module"
        >
          <!-- Status & Health Evaluation Banner -->
          <div class="status-banner" [ngClass]="'banner-' + data.module.health">
            <div class="banner-left">
              <span class="status-dot" [ngClass]="'dot-' + data.module.status"></span>
              <span class="serial-text">{{ data.module.serial_number }}</span>
              <span class="status-badge" [ngClass]="'badge-' + data.module.status">
                {{ data.module.status | uppercase }}
              </span>
              <span class="label-chip" *ngIf="data.module.label && data.module.label !== data.module.serial_number">
                {{ data.module.label }}
              </span>
            </div>
            <div class="health-pill" [ngClass]="'pill-' + data.module.health">
              <div class="pill-top">
                <span class="pill-badge">ÉVALUATION : {{ data.module.health | uppercase }}</span>
              </div>
              <span class="pill-desc">{{ data.module.health_reason }}</span>
            </div>
          </div>

          <!-- TAB 1 : 3 Synthesis Cards (Summary & Installation) -->
          <div class="cards-row" *ngIf="activeTab === 'summary' || activeTab === 'all'">
            <!-- Card 1: Informations Module -->
            <div class="info-card">
              <div class="card-header">
                <app-icon name="info" [size]="16"></app-icon>
                <strong>Informations Module</strong>
              </div>
              <div class="card-rows">
                <div class="kv"><span>Modèle</span><span class="v bold">{{ data.module.info.model }}</span></div>
                <div class="kv"><span>MCU</span><span class="v mono">{{ data.module.info.mcu || '—' }}</span></div>
                <div class="kv"><span>GUID</span><span class="v mono accent" style="font-size:0.75rem;">{{ data.module.info.guid || data.module.info.serial_number }}</span></div>
                <div class="kv" *ngIf="data.module.info.ip_address"><span>Adresse IP</span><span class="v mono">{{ data.module.info.ip_address }}</span></div>
                <div class="kv"><span>Adresse MAC</span><span class="v mono">{{ data.module.info.mac || '—' }}</span></div>
                <div class="kv"><span>Firmware</span><span class="v fw-badge">{{ data.module.info.firmware || '—' }}</span></div>
                <div class="kv"><span>Capacité OTA</span><span class="v">{{ data.module.info.ota_capable ? '✓ Compatible' : '✗ Flash Manuel' }}</span></div>
              </div>
            </div>

            <!-- Card 2: Installation -->
            <div class="info-card">
              <div class="card-header">
                <app-icon name="sites" [size]="16"></app-icon>
                <strong>Installation</strong>
              </div>
              <div class="card-rows">
                <div class="kv"><span>Client</span><span class="v bold blue">{{ data.module.installation.customer_name }}</span></div>
                <div class="kv"><span>Email</span><span class="v mono muted">{{ data.module.installation.customer_email || '—' }}</span></div>
                <div class="kv"><span>Site</span><span class="v bold">{{ data.module.installation.site_name }}</span></div>
                <div class="kv"><span>Adresse</span><span class="v muted">{{ data.module.installation.site_address || '—' }}</span></div>
                <div class="kv"><span>Date installation</span><span class="v mono">{{ data.module.installation.installed_at ? (data.module.installation.installed_at | date:'dd/MM/yyyy HH:mm') : '—' }}</span></div>
                <div class="kv"><span>Serveur SUPLA</span><span class="v mono muted">{{ data.module.installation.supla_server || '—' }}</span></div>
              </div>
            </div>

            <!-- Card 2 bis : Statut cloud (bloc publié par le module) -->
            <div class="info-card" *ngIf="data.module.supla_status as st">
              <div class="card-header">
                <app-icon name="signal" [size]="16"></app-icon>
                <strong>Statut</strong>
                <span class="v" *ngIf="st.connected !== null && st.connected !== undefined">
                  {{ st.connected ? 'CONNECTÉ' : 'DÉCONNECTÉ' }}
                </span>
              </div>
              <div class="card-rows">
                <div class="kv"><span>GUID</span><span class="v mono accent" style="font-size:0.75rem;">{{ st.guid || '—' }}</span></div>
                <div class="kv"><span>Firmware version</span><span class="v fw-badge">{{ st.firmware || '—' }}</span></div>
                <div class="kv"><span>Enregistré</span><span class="v mono">{{ st.registered_at ? (st.registered_at | date:'dd/MM/yyyy HH:mm') : '—' }}</span></div>
                <div class="kv"><span>Dernière connexion</span><span class="v mono">{{ st.last_connected_at ? (st.last_connected_at | date:'dd/MM/yyyy HH:mm') : '—' }}</span></div>
                <div class="kv"><span>IP</span><span class="v mono">{{ st.ip_address || '—' }}</span></div>
                <div class="kv"><span>MAC</span><span class="v mono">{{ st.mac || '—' }}</span></div>
                <div class="kv"><span>Wi-Fi RSSI</span><span class="v mono">{{ st.wifi_rssi !== null && st.wifi_rssi !== undefined ? st.wifi_rssi + ' dBm' : '—' }}</span></div>
                <div class="kv"><span>Wi-Fi signal strength</span><span class="v mono">{{ st.wifi_quality_pct !== null && st.wifi_quality_pct !== undefined ? st.wifi_quality_pct + '%' : '—' }}</span></div>
                <div class="kv"><span>Uptime</span><span class="v mono">{{ formatUptime(st.uptime_seconds) }}</span></div>
                <div class="kv"><span>Connection uptime</span><span class="v mono">{{ formatUptime(st.connection_uptime) }}</span></div>
              </div>
            </div>

            <!-- Card 3: Dernier État -->
            <div class="info-card">
              <div class="card-header">
                <app-icon name="signal" [size]="16"></app-icon>
                <strong>Dernier État</strong>
              </div>
              <div class="card-rows">
                <div class="kv"><span>Dernier contact</span><span class="v mono">{{ data.module.latest_state.last_contact ? (data.module.latest_state.last_contact | date:'dd/MM/yyyy HH:mm:ss') : '—' }}</span></div>
                <div class="kv"><span>Statut</span>
                  <span class="v status-badge" [ngClass]="'badge-' + data.module.latest_state.status">
                    {{ data.module.latest_state.status | uppercase }}
                  </span>
                </div>
                <div class="kv"><span>Heap actuel</span>
                  <span class="v mono bold" [ngClass]="'zone-' + data.module.latest_state.current_heap_zone">
                    {{ data.module.latest_state.current_heap_kb != null ? (data.module.latest_state.current_heap_kb + ' KB') : '—' }}
                  </span>
                </div>
                <div class="kv"><span>Zone Santé</span>
                  <span class="v mono font-medium" [ngClass]="'zone-' + data.module.latest_state.current_heap_zone">
                    {{ data.module.latest_state.current_heap_zone | uppercase }}
                  </span>
                </div>
                <div class="kv"><span>Uptime Système</span><span class="v mono muted">{{ formatUptime(data.module.latest_state.uptime_seconds) }}</span></div>
              </div>
            </div>
          </div>

          <!-- TAB 2 : Telemetry Heap Chart -->
          <div class="section-block" *ngIf="activeTab === 'heap' || activeTab === 'all'">
            <div class="section-label">
              <span>📈 Télémétrie Heap — Historique Temporel</span>
              <span class="section-hint">Sain &gt;20KB | Surveillance 10–20KB | Critique &lt;10KB</span>
            </div>
            <div class="chart-content-wrap">
              <app-heap-chart
                [points]="safePoints"
                [deviceSerial]="data.module.serial_number"
                [thresholds]="data.module.telemetry.thresholds"
              ></app-heap-chart>
            </div>
          </div>

          <!-- TAB 3 : Recent Diagnostic Events -->
          <div class="section-block" *ngIf="activeTab === 'events' || activeTab === 'all'">
            <div class="section-label">
              <span>📜 Événements & Télémétrie Récents</span>
              <span class="section-hint">{{ data.module.recent_events.length }} événements enregistrés</span>
            </div>
            <div class="events-wrap" *ngIf="data.module.recent_events.length > 0">
              <table class="events-table">
                <thead>
                  <tr>
                    <th>Horodatage</th>
                    <th>Type</th>
                    <th>Gravité</th>
                    <th>Message</th>
                    <th>Valeur Technique</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let ev of data.module.recent_events">
                    <td class="mono muted-text">{{ ev.occurred_at | date:'dd/MM HH:mm:ss' }}</td>
                    <td><span class="chip">{{ ev.type }}</span></td>
                    <td><span class="sev" [ngClass]="'sev-' + ev.severity">{{ ev.severity | uppercase }}</span></td>
                    <td>{{ ev.message || '—' }}</td>
                    <td class="mono muted-text small-text">{{ ev.valeur_technique || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="no-events" *ngIf="data.module.recent_events.length === 0">
              Aucun événement récent enregistré pour ce module.
            </div>
          </div>
        </main>

        <!-- 5. FOOTER (Fixed at bottom) -->
        <footer class="diag-footer">
          <div class="footer-meta" *ngIf="data?.module">
            <span>ID Base: #{{ data.module.id }}</span>
            <span *ngIf="data.module.info.mcu">• MCU: {{ data.module.info.mcu }}</span>
          </div>
          <app-button variant="secondary" size="md" (btnClick)="onClose()">Fermer</app-button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    /* ── Backdrop Overlay (aligned with ModalComponent) ──────────────────── */
    .diag-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: var(--modal-backdrop);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow: hidden;
      animation: backdropFade 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes backdropFade { from { opacity: 0; } to { opacity: 1; } }

    /* ── Modal Panel ───────────────────────────────────────────────────────── */
    .diag-panel {
      background: var(--modal-bg);
      border: 1px solid var(--border-card);
      border-radius: 1.25rem;
      box-shadow: var(--shadow-lg);
      width: 100%;
      max-width: 1100px;
      height: 92vh;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: diagSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes diagSlideIn {
      from { opacity: 0; transform: translateY(14px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .diag-backdrop { animation: none; }
      .diag-panel { animation: none; }
    }

    /* ── Fixed Header ─────────────────────────────────────────────────────── */
    .diag-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.1rem 1.5rem;
      border-bottom: 1px solid var(--border-card);
      background: var(--modal-header-bg);
      flex-shrink: 0;
      z-index: 10;
    }
    .diag-header-left { display: flex; align-items: center; gap: 0.75rem; }
    .diag-icon { font-size: 1.5rem; line-height: 1; }
    .diag-icon-wrap {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.6rem;
      background: var(--chip-bg);
      border: 1px solid var(--chip-border);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
      flex-shrink: 0;
    }
    .diag-title-row { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; }
    .diag-title { margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--heading); letter-spacing: -0.01em; }
    .diag-subtitle { margin: 0.15rem 0 0; font-size: 0.77rem; color: var(--text-muted); }
    .diag-close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .diag-close-btn:hover { color: var(--heading); background: var(--card-hover); }
    .diag-close-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

    /* ── Navigation Tabs Bar ─────────────────────────────────────────────── */
    .diag-tabs {
      display: flex;
      gap: 0.5rem;
      padding: 0.6rem 1.5rem;
      background: var(--modal-header-bg);
      border-bottom: 1px solid var(--border-card);
      flex-shrink: 0;
      overflow-x: auto;
    }
    .tab-btn {
      background: var(--card-hover);
      border: 1px solid var(--border-card);
      color: var(--text-muted);
      padding: 0.42rem 0.9rem;
      border-radius: 0.6rem;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .tab-btn:hover {
      border-color: var(--border-strong);
      color: var(--text);
    }
    .tab-btn.active {
      background: var(--chip-bg);
      border-color: var(--primary);
      color: var(--chip-text);
    }

    /* ── Scrollable Central Body ─────────────────────────────────────────── */
    .diag-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 1.5rem;
      outline: none;
      scrollbar-width: thin;
      scrollbar-color: var(--scrollbar-thumb) transparent;
    }
    .diag-body::-webkit-scrollbar { width: 6px; }
    .diag-body::-webkit-scrollbar-track { background: transparent; margin: 4px 0; }
    .diag-body::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 999px;
    }
    .diag-body::-webkit-scrollbar-thumb:hover {
      background: var(--scrollbar-hover);
    }
    .diag-body.scrollable {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ── Fixed Footer ─────────────────────────────────────────────────────── */
    .diag-footer {
      padding: 0.85rem 1.5rem;
      border-top: 1px solid var(--border-card);
      background: var(--modal-footer-bg);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      z-index: 10;
    }
    .footer-meta {
      font-size: 0.78rem;
      color: var(--text-muted);
      display: flex;
      gap: 0.75rem;
    }

    /* ── Loading State ────────────────────────────────────────────────────── */
    .diag-body-loading {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
    }
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      color: var(--text-muted);
    }
    .spinner-ring {
      width: 2.5rem;
      height: 2.5rem;
      border: 3px solid var(--chip-bg);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spinRing 0.8s linear infinite;
    }
    @keyframes spinRing { to { transform: rotate(360deg); } }

    /* ── Error State ──────────────────────────────────────────────────────── */
    .diag-body-error {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
    }
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      color: var(--text-muted);
      text-align: center;
    }
    .error-icon { font-size: 2.5rem; }
    .error-msg { color: var(--crit-text); font-size: 0.85rem; max-width: 420px; margin: 0; }
    .retry-btn {
      background: var(--chip-bg);
      border: 1px solid var(--chip-border);
      color: var(--chip-text);
      padding: 0.45rem 1.1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 0.85rem;
      font-family: inherit;
      transition: all 0.15s ease;
    }
    .retry-btn:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    /* ── Status Banner ────────────────────────────────────────────────────── */
    .status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 0.9rem 1.25rem;
      border-radius: 0.75rem;
      background: var(--card-hover);
      border: 1px solid var(--border-card);
    }
    .banner-left { display: flex; align-items: center; gap: 0.65rem; }
    .serial-text { font-family: 'JetBrains Mono', monospace; font-size: 1.2rem; font-weight: 700; color: var(--heading); }
    .label-chip {
      background: var(--chip-bg);
      color: var(--chip-text);
      border: 1px solid var(--chip-border);
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
    }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot-online  { background: var(--ok); box-shadow: 0 0 6px var(--ok); }
    .dot-offline { background: var(--text-muted); }
    .dot-alert   { background: var(--warn); box-shadow: 0 0 6px var(--warn); }

    .status-badge, .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.18rem 0.55rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .badge-online  { background: var(--ok-bg); color: var(--ok-text); border: 1px solid var(--ok-border); }
    .badge-offline { background: rgba(100,116,139,0.12); color: var(--text-muted); border: 1px solid rgba(100,116,139,0.25); }
    .badge-alert   { background: var(--warn-bg); color: var(--warn-text); border: 1px solid var(--warn-border); }

    .health-pill {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.5rem 1rem;
      border-radius: 0.65rem;
      border: 1px solid transparent;
      font-size: 0.82rem;
    }
    .pill-sain       { background: var(--ok-bg);   border-color: var(--ok-border);   color: var(--ok-text); }
    .pill-surveillance { background: var(--warn-bg); border-color: var(--warn-border); color: var(--warn-text); }
    .pill-critique   { background: var(--crit-bg); border-color: var(--crit-border); color: var(--crit-text); }
    .pill-badge { font-weight: 700; font-size: 0.74rem; letter-spacing: 0.05em; }
    .pill-desc  { font-size: 0.78rem; opacity: 0.9; }

    /* ── 3 Cards Row ─────────────────────────────────────────────────────── */
    .cards-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }
    .info-card {
      background: var(--card);
      border: 1px solid var(--border-card);
      border-radius: 0.75rem;
      overflow: hidden;
    }
    .card-header {
      padding: 0.6rem 1rem;
      background: var(--card-header-bg);
      border-bottom: 1px solid var(--border-card);
      font-size: 0.87rem;
      font-weight: 600;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .card-rows { padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .kv { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; gap: 0.5rem; }
    .kv > span:first-child { color: var(--text-muted); flex-shrink: 0; }
    .v { color: var(--text); text-align: right; }
    .bold  { font-weight: 600; }
    .mono  { font-family: 'JetBrains Mono', monospace; }
    .muted { color: var(--text-muted); }
    .accent { color: var(--primary); }
    .blue   { color: var(--info-text); }
    .fw-badge {
      background: var(--chip-bg);
      color: var(--chip-text);
      border: 1px solid var(--chip-border);
      padding: 0.1rem 0.4rem;
      border-radius: 0.3rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
    }
    .zone-sain       { color: var(--ok-text); }
    .zone-surveillance { color: var(--warn-text); }
    .zone-critique   { color: var(--crit-text); }

    /* ── Section Blocks ───────────────────────────────────────────────────── */
    .section-block {
      background: var(--card);
      border: 1px solid var(--border-card);
      border-radius: 0.75rem;
      overflow: hidden;
    }
    .section-label {
      padding: 0.75rem 1.25rem;
      background: var(--card-header-bg);
      border-bottom: 1px solid var(--border-card);
      font-size: 0.87rem;
      font-weight: 600;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .section-hint { font-size: 0.76rem; font-weight: 400; color: var(--text-muted); }
    .chart-content-wrap { padding: 1.25rem; }

    /* ── Events Table ─────────────────────────────────────────────────────── */
    .events-wrap { overflow-x: auto; }
    .events-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .events-table th,
    .events-table td {
      padding: 0.65rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .events-table th {
      background: var(--card-header-bg);
      color: var(--text-muted);
      font-weight: 700;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .events-table tr:last-child td { border-bottom: none; }
    .events-table tbody tr:hover td { background: var(--card-hover); }
    .chip {
      background: var(--chip-bg);
      color: var(--chip-text);
      border: 1px solid var(--chip-border);
      padding: 0.15rem 0.45rem;
      border-radius: 0.3rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
    }
    .sev { font-weight: 700; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 0.25rem; }
    .sev-info     { background: var(--info-bg);  color: var(--info-text); }
    .sev-warning  { background: var(--warn-bg);  color: var(--warn-text); }
    .sev-critical, .sev-error { background: var(--crit-bg); color: var(--crit-text); }
    .muted-text { color: var(--text-muted); }
    .small-text { font-size: 0.75rem; }
    .no-events { padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
  `]
})
export class DeviceHealthModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() deviceId: number | string | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('scrollBody') scrollBody?: ElementRef<HTMLElement>;

  activeTab: DiagTab = 'summary';
  loading = false;
  error: string | null = null;
  data: DeviceHealthData | null = null;

  get safePoints(): HeapPoint[] {
    return (this.data?.module?.telemetry?.points || []) as HeapPoint[];
  }

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isOpen && this.deviceId) {
      this.loadHealth();
    }
    if (!this.isOpen) {
      this.data = null;
      this.error = null;
      this.activeTab = 'summary';
    }
  }

  setTab(tab: DiagTab): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
    // Scroll body back to top on tab switch
    if (this.scrollBody?.nativeElement) {
      this.scrollBody.nativeElement.scrollTop = 0;
    }
  }

  loadHealth(): void {
    if (!this.deviceId) return;
    this.loading = true;
    this.error = null;
    this.data = null;
    this.cdr.markForCheck();

    const url = `${environment.apiUrl}/devices/${this.deviceId}/health`;

    this.http.get<DeviceHealthData>(url).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        this.error = null;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.scrollBody?.nativeElement?.focus();
        }, 50);
      },
      error: (err) => {
        console.error('[DeviceHealth] API Error:', err);
        this.loading = false;
        if (err.status === 404) {
          this.error = `Module introuvable : "${this.deviceId}"`;
        } else if (err.status === 0) {
          this.error = `Serveur backend inaccessible (${environment.apiUrl}).`;
        } else if (err.status === 401) {
          this.error = `Session expirée (401). Veuillez vous reconnecter.`;
        } else {
          this.error = `Erreur de communication (${err.status}): ${err.message}`;
        }
        this.cdr.detectChanges();
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardNav(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    if (event.key === 'Escape') {
      this.onClose();
      event.preventDefault();
      return;
    }

    const el = this.scrollBody?.nativeElement;
    if (!el) return;

    const scrollStep = 80;
    const pageStep = el.clientHeight * 0.85;

    switch (event.key) {
      case 'ArrowDown':
        el.scrollTop += scrollStep;
        event.preventDefault();
        break;
      case 'ArrowUp':
        el.scrollTop -= scrollStep;
        event.preventDefault();
        break;
      case 'PageDown':
      case ' ':
        if (!event.shiftKey) {
          el.scrollTop += pageStep;
          event.preventDefault();
        } else {
          el.scrollTop -= pageStep;
          event.preventDefault();
        }
        break;
      case 'PageUp':
        el.scrollTop -= pageStep;
        event.preventDefault();
        break;
      case 'Home':
        el.scrollTop = 0;
        event.preventDefault();
        break;
      case 'End':
        el.scrollTop = el.scrollHeight;
        event.preventDefault();
        break;
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('diag-backdrop')) {
      this.onClose();
    }
  }

  formatUptime(seconds: number | null): string {
    if (!seconds) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}j ${h}h ${m}m`;
  }
}
