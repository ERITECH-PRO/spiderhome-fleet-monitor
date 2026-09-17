import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import {
  DashboardService,
  FleetEvent, HeapPoint, HeapThresholds,
  FleetHeapHistoryResponse, DeviceRef, pickDefaultHeapDevice
} from '../services/dashboard.service';
import { HeapChartComponent } from '../shared/components/heap-chart/heap-chart.component';
import { IconComponent } from '../shared/components/icon/icon.component';

@Component({
  selector: 'app-events',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, HeapChartComponent, IconComponent],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss']
})
export class EventsComponent implements OnInit, OnDestroy {

  // Events state
  events: FleetEvent[] = [];
  eventsLoading = false;
  eventsPage = 1;
  eventsLastPage = 1;
  eventsTotal = 0;
  eventsPerPage = 20;

  get criticalCount(): number { return this.events.filter(e => e.severity === 'critical').length; }
  get warningCount():  number { return this.events.filter(e => e.severity === 'warning').length; }

  // Filters
  filterPeriod   = 'all';
  filterType     = 'ALL';
  filterSeverity = 'ALL';
  filterDevice   = '';
  searchQuery    = '';

  private searchSubject = new Subject<string>();
  private subs = new Subscription();

  readonly supportedEventTypes = [
    { value: 'ALL',             label: 'Tous les types' },
    { value: 'BOOT',            label: 'BOOT (Demarrage)' },
    { value: 'WATCHDOG_RESET',  label: 'WATCHDOG_RESET (Redemarrage watchdog)' },
    { value: 'LOW_HEAP',        label: 'LOW_HEAP (Memoire faible)' },
    { value: 'WIFI_LOST',       label: 'WIFI_LOST (Perte Wi-Fi)' },
    { value: 'SUPLA_OFFLINE',   label: 'SUPLA_OFFLINE (Serveur hors ligne)' },
    { value: 'UPDATE_REQUIRED', label: 'UPDATE_REQUIRED (Mise a jour requise)' },
  ];

  readonly supportedSeverities = [
    { value: 'ALL',      label: 'Toutes gravites' },
    { value: 'critical', label: 'Critical' },
    { value: 'warning',  label: 'Warning' },
    { value: 'info',     label: 'Info' },
  ];

  readonly periods = [
    { value: 'all', label: 'Toute la periode' },
    { value: '1h',  label: 'Derniere heure' },
    { value: '24h', label: 'Dernieres 24h' },
    { value: '7d',  label: '7 jours' },
    { value: '30d', label: '30 jours' },
  ];

  // Heap state
  selectedHeapDevice = '';
  selectedHeapPeriod = '7d';
  heapPoints: HeapPoint[] = [];
  heapThresholds: HeapThresholds = { sain_min: 20.0, surveillance_min: 10.0, critique_max: 10.0 };
  heapDeviceMeta: FleetHeapHistoryResponse['device'] | null = null;
  heapChartLoading = false;
  devicesList: DeviceRef[] = [];

  readonly heapPeriods = [
    { value: '24h', label: '24h' },
    { value: '7d',  label: '7j'  },
    { value: '30d', label: '30j' },
  ];

  private heapInputTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private svc: DashboardService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.subs.add(
      this.searchSubject.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
        this.eventsPage = 1;
        this.fetchEvents();
      })
    );
    this.fetchEvents();
    this.fetchDevicesList();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.heapInputTimer) clearTimeout(this.heapInputTimer);
  }

  refreshAll(): void {
    this.svc.clearCache();
    this.fetchEvents();
    if (this.selectedHeapDevice) this.fetchHeapHistory();
  }

  fetchEvents(): void {
    this.eventsLoading = true;
    this.cdr.markForCheck();
    this.svc.getFleetEvents({
      page: this.eventsPage,
      limit: this.eventsPerPage,
      period: this.filterPeriod,
      type: this.filterType,
      severity: this.filterSeverity,
      device: this.filterDevice || undefined,
      search: this.searchQuery.trim() || undefined,
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
      error: () => { this.eventsLoading = false; this.cdr.markForCheck(); }
    });
  }

  onFilterChange(): void { this.eventsPage = 1; this.fetchEvents(); }
  onSearch(val: string): void { this.searchSubject.next(val); }
  clearSearch(): void { this.searchQuery = ''; this.eventsPage = 1; this.fetchEvents(); }

  resetFilters(): void {
    this.filterPeriod = 'all'; this.filterType = 'ALL'; this.filterSeverity = 'ALL';
    this.filterDevice = ''; this.searchQuery = ''; this.eventsPage = 1;
    this.fetchEvents();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.eventsLastPage && page !== this.eventsPage) {
      this.eventsPage = page; this.fetchEvents();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPageNumbers(): number[] {
    const total = this.eventsLastPage, cur = this.eventsPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (cur > 3) pages.push(-1);
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  fetchDevicesList(): void {
    this.svc.getFleetOverview().subscribe({
      next: (res) => {
        if (res.ok) {
          this.devicesList = res.devices;
          if (!this.selectedHeapDevice && res.devices.length > 0) {
            this.selectedHeapDevice = pickDefaultHeapDevice(res.devices)!.serial_number;
            this.fetchHeapHistory();
          }
        }
        this.cdr.markForCheck();
      }
    });
  }

  fetchHeapHistory(): void {
    if (!this.selectedHeapDevice) return;
    this.heapChartLoading = true;
    this.cdr.markForCheck();
    this.svc.getFleetHeapHistory(this.selectedHeapDevice, this.selectedHeapPeriod).subscribe({
      next: (res) => {
        this.heapChartLoading = false;
        if (res.ok) { this.heapPoints = res.points; this.heapThresholds = res.thresholds; this.heapDeviceMeta = res.device; }
        this.cdr.markForCheck();
      },
      error: () => { this.heapChartLoading = false; this.cdr.markForCheck(); }
    });
  }

  onHeapPeriodChange(period: string): void { this.selectedHeapPeriod = period; this.fetchHeapHistory(); }

  onHeapDeviceInput(value: string): void {
    if (this.heapInputTimer) clearTimeout(this.heapInputTimer);
    this.heapInputTimer = setTimeout(() => { if (value.trim().length >= 4) this.fetchHeapHistory(); }, 600);
  }

  getSeverityBadge(sev: string): string {
    const s = (sev || '').toLowerCase();
    if (s === 'critical' || s === 'error') return 'sev-badge badge-crit';
    if (s === 'warning') return 'sev-badge badge-warn';
    return 'sev-badge badge-info';
  }

  getSeverityDotClass(sev: string): string {
    if (sev === 'critical' || sev === 'error') return 'tl-dot dot-crit';
    if (sev === 'warning') return 'tl-dot dot-warn';
    return 'tl-dot dot-info';
  }

  getTypeBadge(type: string): string {
    switch (type) {
      case 'WATCHDOG_RESET': case 'SUPLA_OFFLINE':  return 'type-badge type-badge-danger';
      case 'LOW_HEAP':       case 'WIFI_LOST':       return 'type-badge type-badge-warning';
      case 'BOOT':           case 'UPDATE_REQUIRED': return 'type-badge type-badge-info';
      default: return 'type-badge type-badge-neutral';
    }
  }
}
