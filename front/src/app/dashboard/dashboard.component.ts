import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { ActivatedRoute } from '@angular/router';
import {
  DashboardService,
  FleetOverviewResponse, FleetCounters, FleetAlert, DeviceRef,
  FleetEvent, HeapPoint, HeapThresholds, pickDefaultHeapDevice
} from '../services/dashboard.service';
import { AlertService, DeviceAlert } from '../services/alert.service';
import { HeapChartComponent } from '../shared/components/heap-chart/heap-chart.component';
import { ButtonComponent } from '../shared/components/button/button.component';
import { IconComponent } from '../shared/components/icon/icon.component';
import { DeviceHealthModalComponent } from '../devices/device-health-modal.component';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, HeapChartComponent, ButtonComponent, IconComponent, DeviceHealthModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {

  showHealthModal = false;
  healthDeviceId: string | number | null = null;

  // ── Alert Filter State ──────────────────────────────────────────────────────
  alertStatusFilter: 'all' | 'open' | 'acknowledged' | 'resolved' = 'all';

  get filteredAlerts(): FleetAlert[] {
    if (this.alertStatusFilter === 'all') {
      return this.recentAlerts;
    }
    return this.recentAlerts.filter(a => a.status === this.alertStatusFilter);
  }

  countAlertsByStatus(st: string): number {
    return this.recentAlerts.filter(a => a.status === st).length;
  }

  setAlertStatusFilter(st: 'all' | 'open' | 'acknowledged' | 'resolved'): void {
    this.alertStatusFilter = st;
    this.cdr.markForCheck();
  }

  acknowledgeAlert(alert: FleetAlert, event?: Event): void {
    if (event) event.stopPropagation();
    this.alertService.acknowledge(alert.id).subscribe({
      next: () => {
        alert.status = 'acknowledged';
        this.fetchOverview(false);
        this.cdr.markForCheck();
      }
    });
  }

  resolveAlert(alert: FleetAlert, event?: Event): void {
    if (event) event.stopPropagation();
    this.alertService.resolve(alert.id).subscribe({
      next: () => {
        alert.status = 'resolved';
        this.fetchOverview(false);
        this.cdr.markForCheck();
      }
    });
  }

  reopenAlert(alert: FleetAlert, event?: Event): void {
    if (event) event.stopPropagation();
    this.alertService.reopen(alert.id).subscribe({
      next: () => {
        alert.status = 'open';
        this.fetchOverview(false);
        this.cdr.markForCheck();
      }
    });
  }

  openHealth(deviceId?: string | number): void {
    this.healthDeviceId = deviceId || this.selectedHeapDevice;
    this.showHealthModal = true;
  }

  closeHealth(): void {
    this.showHealthModal = false;
    this.healthDeviceId = null;
  }

  // ── Global Status ───────────────────────────────────────────────────────────
  loading       = true;
  apiStatus: 'ok' | 'warn' | 'crit' = 'warn';
  apiStatusText = 'Connexion…';
  lastUpdated   = new Date();

  // ── Overview Data ───────────────────────────────────────────────────────────
  counters: FleetCounters = {
    active_customers: 0,
    total_customers: 0,
    modules_status: { online: 0, offline: 0, alert: 0, retired: 0, total: 0 },
    interventions: { nouvelle: 0, en_analyse: 0, planifiee: 0, terminee: 0, total: 0 },
    health_summary: { sain: 0, surveillance: 0, critique: 0 },
  };

  recentAlerts: FleetAlert[] = [];
  devicesList: DeviceRef[] = [];

  // ── Heap Graph State ────────────────────────────────────────────────────────
  // Renseigné une fois la liste réelle des modules chargée (fetchOverview) —
  // jamais un numéro de série de démonstration fictif.
  selectedHeapDevice = '';
  selectedHeapPeriod = '7d';
  heapPoints: HeapPoint[] = [];
  heapThresholds: HeapThresholds = { sain_min: 20.0, surveillance_min: 10.0, critique_max: 10.0 };
  heapDeviceMeta: {
    label: string;
    firmware: string;
    status: string;
    current_health: 'sain' | 'surveillance' | 'critique';
    current_heap: number | null;
  } | null = null;
  heapChartLoading = false;

  // ── Events Logs State ───────────────────────────────────────────────────────
  events: FleetEvent[] = [];
  eventsLoading = false;
  eventsPage = 1;
  eventsLastPage = 1;
  eventsTotal = 0;
  eventsPerPage = 15;

  // Filters
  filterPeriod   = 'all';
  filterType     = 'ALL';
  filterSeverity = 'ALL';
  filterDevice   = '';
  searchQuery    = '';

  supportedEventTypes = [
    { value: 'ALL',             label: 'Tous les types' },
    { value: 'BOOT',            label: 'BOOT (Démarrage)' },
    { value: 'WATCHDOG_RESET',  label: 'WATCHDOG_RESET' },
    { value: 'LOW_HEAP',        label: 'LOW_HEAP (Mémoire)' },
    { value: 'WIFI_LOST',       label: 'WIFI_LOST' },
    { value: 'SUPLA_OFFLINE',   label: 'SUPLA_OFFLINE' },
    { value: 'UPDATE_REQUIRED', label: 'UPDATE_REQUIRED' },
  ];

  supportedSeverities = [
    { value: 'ALL',      label: 'Toutes gravités' },
    { value: 'info',     label: 'Info' },
    { value: 'warning',  label: 'Warning' },
    { value: 'critical', label: 'Critical' },
  ];

  periods = [
    { value: 'all', label: 'Toute la période' },
    { value: '1h',  label: 'Dernière heure' },
    { value: '24h', label: 'Dernières 24h' },
    { value: '7d',  label: '7 derniers jours' },
    { value: '30d', label: '30 derniers jours' },
  ];


  private routeSub!: Subscription;

  constructor(
    private svc: DashboardService,
    private alertService: AlertService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // 1. Initial overview and data loading
    this.fetchOverview();
    this.fetchHeapHistory();
    this.fetchEvents();

    // 2. Query param routing (deep-linking to device, type, severity, or section)
    this.routeSub = this.route.queryParams.subscribe(params => {
      let shouldRefetchEvents = false;
      let shouldRefetchHeap = false;

      if (params['device'] && params['device'] !== this.filterDevice) {
        this.filterDevice = params['device'];
        this.selectedHeapDevice = params['device'];
        shouldRefetchEvents = true;
        shouldRefetchHeap = true;
      }

      if (params['type'] && params['type'] !== this.filterType) {
        this.filterType = params['type'];
        shouldRefetchEvents = true;
      }

      if (params['severity'] && params['severity'] !== this.filterSeverity) {
        this.filterSeverity = params['severity'];
        shouldRefetchEvents = true;
      }

      if (shouldRefetchHeap) {
        this.fetchHeapHistory();
      }

      if (shouldRefetchEvents) {
        this.eventsPage = 1;
        this.fetchEvents();
      }

      if (params['section']) {
        setTimeout(() => {
          const el = document.getElementById(params['section']);
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      }
    });


  }

  ngOnDestroy(): void {

    this.routeSub?.unsubscribe();
  }

  /**
   * Forced manual refresh — clears cache and fetches fresh overview, heap history, and events.
   */
  refreshAll(): void {
    this.loading = true;
    this.svc.clearCache();
    this.cdr.markForCheck();

    forkJoin({
      overview: this.svc.getFleetOverview(),
      heap: this.selectedHeapDevice ? this.svc.getFleetHeapHistory(this.selectedHeapDevice, this.selectedHeapPeriod) : of(null),
      events: this.svc.getFleetEvents({
        page: this.eventsPage,
        limit: this.eventsPerPage,
        period: this.filterPeriod,
        type: this.filterType,
        severity: this.filterSeverity,
        device: this.filterDevice,
        search: this.searchQuery.trim() || undefined
      })
    }).subscribe({
      next: ({ overview, heap, events }) => {
        this.apiStatus = 'ok';
        this.apiStatusText = 'En ligne';
        this.lastUpdated = new Date();
        this.loading = false;

        if (overview && overview.ok) {
          this.counters = overview.counters;
          this.recentAlerts = overview.recent_alerts;
          this.devicesList = overview.devices;

          if (this.devicesList.length > 0 && !this.devicesList.some(d => d.serial_number === this.selectedHeapDevice)) {
            this.selectedHeapDevice = pickDefaultHeapDevice(this.devicesList)!.serial_number;
          }
        }

        if (heap && heap.ok) {
          this.heapPoints = heap.points;
          this.heapThresholds = heap.thresholds;
          this.heapDeviceMeta = heap.device;
        }

        if (events && events.ok) {
          this.events = events.rows;
          this.eventsPage = events.current_page;
          this.eventsLastPage = events.last_page;
          this.eventsTotal = events.total;
        }

        this.cdr.markForCheck();
      },
      error: () => {
        this.apiStatus = 'crit';
        this.apiStatusText = 'Erreur API';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Overview Fetch ──────────────────────────────────────────────────────────
  fetchOverview(setLoading = true): void {
    if (setLoading) this.loading = this.counters.total_customers === 0;
    this.cdr.markForCheck();

    this.svc.getFleetOverview().subscribe({
      next: (res) => {
        this.apiStatus = 'ok';
        this.apiStatusText = 'En ligne';
        this.lastUpdated = new Date();
        this.loading = false;

        if (res.ok) {
          this.counters = res.counters;
          this.recentAlerts = res.recent_alerts;
          this.devicesList = res.devices;

          // If current selected heap device is not in list, fallback to first
          if (this.devicesList.length > 0 && !this.devicesList.some(d => d.serial_number === this.selectedHeapDevice)) {
            this.selectedHeapDevice = pickDefaultHeapDevice(this.devicesList)!.serial_number;
            this.fetchHeapHistory();
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.apiStatus = 'crit';
        this.apiStatusText = 'Erreur API';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Heap History Fetch ──────────────────────────────────────────────────────
  fetchHeapHistory(setLoading = true): void {
    if (!this.selectedHeapDevice) return;
    if (setLoading) this.heapChartLoading = this.heapPoints.length === 0;
    this.cdr.markForCheck();

    this.svc.getFleetHeapHistory(this.selectedHeapDevice, this.selectedHeapPeriod).subscribe({
      next: (res) => {
        this.heapChartLoading = false;
        if (res.ok) {
          this.heapPoints = res.points;
          this.heapThresholds = res.thresholds;
          this.heapDeviceMeta = res.device;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.heapChartLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onHeapDeviceChange(serial: string): void {
    this.selectedHeapDevice = serial;
    this.fetchHeapHistory();
  }

  onHeapPeriodChange(period: string): void {
    this.selectedHeapPeriod = period;
    this.fetchHeapHistory();
  }

  // ── Events Logs Fetch ───────────────────────────────────────────────────────
  fetchEvents(setLoading = true): void {
    if (setLoading) this.eventsLoading = this.events.length === 0;
    this.cdr.markForCheck();

    this.svc.getFleetEvents({
      page: this.eventsPage,
      limit: this.eventsPerPage,
      period: this.filterPeriod,
      type: this.filterType,
      severity: this.filterSeverity,
      device: this.filterDevice,
      search: this.searchQuery.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.eventsLoading = false;
        if (res.ok) {
          this.events = res.rows;
          this.eventsPage = res.current_page;
          this.eventsLastPage = res.last_page;
          this.eventsTotal = res.total;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.eventsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onFilterChange(): void {
    this.eventsPage = 1;
    this.fetchEvents();
  }

  resetFilters(): void {
    this.filterPeriod = 'all';
    this.filterType = 'ALL';
    this.filterSeverity = 'ALL';
    this.filterDevice = '';
    this.searchQuery = '';
    this.eventsPage = 1;
    this.fetchEvents();
  }

  filterByDevice(serial: string): void {
    this.filterDevice = serial;
    this.eventsPage = 1;
    this.fetchEvents();

    // Scroll to events table
    const tableEl = document.getElementById('events-section');
    tableEl?.scrollIntoView({ behavior: 'smooth' });
  }

  selectDeviceForHeap(serial: string): void {
    this.selectedHeapDevice = serial;
    this.fetchHeapHistory();

    const chartEl = document.getElementById('heap-chart-section');
    chartEl?.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Pagination ──────────────────────────────────────────────────────────────
  goToPage(page: number): void {
    if (page >= 1 && page <= this.eventsLastPage && page !== this.eventsPage) {
      this.eventsPage = page;
      this.fetchEvents();
    }
  }

  // ── Formatting Helpers ──────────────────────────────────────────────────────
  getSeverityBadge(sev: string): string {
    const s = (sev || '').toLowerCase();
    if (s === 'critical') return 'badge-crit';
    if (s === 'warning') return 'badge-warn';
    if (s === 'error') return 'badge-crit';
    return 'badge-info';
  }

  getTypeBadge(type: string): string {
    switch (type) {
      case 'WATCHDOG_RESET':
      case 'SUPLA_OFFLINE':
        return 'type-badge-danger';
      case 'LOW_HEAP':
      case 'WIFI_LOST':
        return 'type-badge-warning';
      case 'BOOT':
      case 'UPDATE_REQUIRED':
        return 'type-badge-info';
      default:
        return 'type-badge-neutral';
    }
  }

  getHealthTone(health?: string): 'crit' | 'warn' | 'ok' | 'neutral' {
    if (health === 'critique') return 'crit';
    if (health === 'surveillance') return 'warn';
    if (health === 'sain') return 'ok';
    return 'neutral';
  }
}
