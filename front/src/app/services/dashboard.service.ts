import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageCacheService } from './page-cache.service';

// ─── Business Models ──────────────────────────────────────────────────────────

export interface ModulesStatusCount {
  online: number;
  offline: number;
  alert: number;
  retired: number;
  total: number;
}

export interface InterventionsStatusCount {
  nouvelle: number;
  en_analyse: number;
  planifiee: number;
  terminee: number;
  total: number;
}

export interface HealthSummaryCount {
  sain: number;
  surveillance: number;
  critique: number;
}

export interface FleetCounters {
  active_customers: number;
  total_customers: number;
  modules_status: ModulesStatusCount;
  interventions: InterventionsStatusCount;
  health_summary: HealthSummaryCount;
}

export interface DeviceRef {
  id: number;
  serial_number: string;
  label: string;
  mac: string;
  firmware?: string;
  status?: string;
  health?: 'sain' | 'surveillance' | 'critique';
  health_reason?: string;
  current_heap?: number | null;
  last_seen_at?: string;
}

export interface FleetAlert {
  id: number;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  status: string;
  created_at: string;
  device: DeviceRef | null;
}

export interface FleetOverviewResponse {
  ok: boolean;
  timestamp: string;
  counters: FleetCounters;
  recent_alerts: FleetAlert[];
  devices: DeviceRef[];
}

export interface FleetEvent {
  id: number;
  device_id?: number | null;
  occurred_at: string;
  type: 'BOOT' | 'WATCHDOG_RESET' | 'LOW_HEAP' | 'WIFI_LOST' | 'SUPLA_OFFLINE' | 'UPDATE_REQUIRED' | string;
  severity: 'info' | 'warning' | 'critical' | 'error';
  value?: string | null;
  valeur_technique?: string | null;
  message: string;
  device: DeviceRef | null;
}

export interface FleetEventsResponse {
  ok: boolean;
  rows: FleetEvent[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface HeapPoint {
  timestamp: string;
  heap_kb: number;
  zone: 'sain' | 'surveillance' | 'critique';
  status: string;
  uptime: number | null;
  event: string | null;
}

export interface HeapThresholds {
  sain_min: number;
  surveillance_min: number;
  critique_max: number;
}

export interface FleetHeapHistoryResponse {
  ok: boolean;
  device: {
    serial_number: string;
    label: string;
    firmware: string;
    status: string;
    current_health: 'sain' | 'surveillance' | 'critique';
    current_heap: number | null;
  };
  thresholds: HeapThresholds;
  points: HeapPoint[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = environment.apiUrl;

  readonly selectedDevice$ = new BehaviorSubject<string>('');

  constructor(
    private http: HttpClient,
    private cache: PageCacheService
  ) {}

  setDevice(device: string): void {
    this.selectedDevice$.next(device);
  }

  clearCache(): void {
    this.cache.invalidate('fleet');
    this.cache.clear();
  }

  // ── Fleet Dashboard Endpoints ────────────────────────────────────────────────

  /**
   * Compteurs, état de santé global, alertes 24h et liste des devices.
   */
  getFleetOverview(): Observable<FleetOverviewResponse> {
    const source$ = this.http.get<FleetOverviewResponse>(`${this.api}/fleet/overview`);
    return this.cache.wrap('fleet:overview', source$);
  }

  /**
   * Liste des événements de la flotte avec filtres complets et pagination.
   */
  getFleetEvents(options: {
    page?: number;
    limit?: number;
    period?: string;
    type?: string;
    severity?: string;
    device?: string;
    search?: string;
  } = {}): Observable<FleetEventsResponse> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', options.page);
    if (options.limit) params = params.set('limit', options.limit);
    if (options.period && options.period !== 'all') params = params.set('period', options.period);
    if (options.type && options.type !== 'ALL') params = params.set('type', options.type);
    if (options.severity && options.severity !== 'ALL') params = params.set('severity', options.severity);
    if (options.device) params = params.set('device', options.device);
    if (options.search) params = params.set('search', options.search);

    const cacheKey = `fleet:events:${params.toString()}`;
    const source$ = this.http.get<FleetEventsResponse>(`${this.api}/fleet/events`, { params });
    return this.cache.wrap(cacheKey, source$);
  }

  /**
   * Historique temporel de Heap pour un module spécifique avec seuils de santé.
   */
  getFleetHeapHistory(deviceSerial: string, period = '7d'): Observable<FleetHeapHistoryResponse> {
    const params = new HttpParams()
      .set('device', deviceSerial)
      .set('period', period);

    const cacheKey = `fleet:heap:${deviceSerial}:${period}`;
    const source$ = this.http.get<FleetHeapHistoryResponse>(`${this.api}/fleet/heap-history`, { params });
    return this.cache.wrap(cacheKey, source$);
  }
}
