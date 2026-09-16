import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageCacheService } from './page-cache.service';
import { HeapPoint } from './dashboard.service';

export interface Device {
  id: number;
  site_id: number;
  model_id: number;
  guid?: string | null;
  serial_number: string;
  legacy_device_key: string | null;
  mac: string | null;
  firmware: string | null;
  status: 'online' | 'offline' | 'alert' | 'retired';
  health?: 'sain' | 'surveillance' | 'critique';
  health_reason?: string;
  current_heap?: number | null;
  label: string | null;
  ip_address: string | null;
  supla_server: string | null;
  last_seen_at: string | null;
  site?: { id: number; customer_id?: number; name: string; address?: string | null; customer?: { id: number; name: string } };
  model?: { id: number; name: string; mcu: string | null; ota_capable: boolean };
  created_at: string;
  updated_at: string;
}

export interface DevicePage {
  data: Device[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly base = `${environment.apiUrl}/devices`;

  constructor(private http: HttpClient, private cache: PageCacheService) {}

  getAll(params: {
    search?: string;
    site_id?: number;
    model_id?: number;
    status?: string;
    customer_id?: number;
    all?: boolean;
    per_page?: number;
  } = {}): Observable<DevicePage | Device[]> {
    let p = new HttpParams();
    if (params.search)      p = p.set('search', params.search);
    if (params.site_id)     p = p.set('site_id', String(params.site_id));
    if (params.model_id)    p = p.set('model_id', String(params.model_id));
    if (params.status)      p = p.set('status', params.status);
    if (params.customer_id) p = p.set('customer_id', String(params.customer_id));
    if (params.all)         p = p.set('all', 'true');
    if (params.per_page)    p = p.set('per_page', String(params.per_page));

    const cacheKey = `devices:${p.toString()}`;
    return this.cache.wrap(cacheKey, this.http.get<DevicePage | Device[]>(this.base, { params: p }));
  }

  getById(id: number): Observable<Device> {
    return this.http.get<Device>(`${this.base}/${id}`);
  }

  getDeviceHealth(id: number | string): Observable<DeviceHealthData> {
    return this.http.get<DeviceHealthData>(`${this.base}/${id}/health`);
  }

  create(data: Partial<Device>): Observable<Device> {
    return this.http.post<Device>(this.base, data).pipe(tap(() => this._invalidateAll()));
  }

  update(id: number, data: Partial<Device>): Observable<Device> {
    return this.http.put<Device>(`${this.base}/${id}`, data).pipe(tap(() => this._invalidateAll()));
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`).pipe(tap(() => this._invalidateAll()));
  }

  private _invalidateAll(): void {
    ['devices:', 'devices:all=true', 'devices:per_page=25'].forEach(k => this.cache.invalidate(k));
  }
}

export interface DeviceHealthData {
  ok: boolean;
  module: {
    id: number;
    serial_number: string;
    label: string;
    status: 'online' | 'offline' | 'alert' | 'retired';
    health: 'sain' | 'surveillance' | 'critique';
    health_reason: string;
    info: {
      model: string;
      mcu: string;
      guid?: string;
      serial_number: string;
      ip_address?: string | null;
      legacy_key: string;
      mac: string;
      firmware: string;
      status: string;
      ota_capable: boolean;
    };
    installation: {
      customer_name: string;
      customer_email: string;
      site_name: string;
      site_address: string;
      installed_at: string;
      supla_server: string;
      location_label: string;
    };
    supla_status?: {
      connected: boolean | null;
      guid: string | null;
      firmware: string | null;
      registered_at: string | null;
      last_connected_at: string | null;
      ip_address: string | null;
      mac: string | null;
      wifi_rssi: number | null;
      wifi_quality_pct: number | null;
      uptime_seconds: number | null;
      connection_uptime: number | null;
    };
    latest_state: {
      last_contact: string;
      status: string;
      current_heap_kb: number | null;
      current_heap_zone: string;
      uptime_seconds: number | null;
    };
    telemetry: {
      thresholds: { sain_min: number; surveillance_min: number; critique_max: number };
      points: HeapPoint[];
    };
    recent_events: Array<{
      id: number;
      type: string;
      severity: string;
      message: string;
      valeur_technique: string | null;
      occurred_at: string;
    }>;
  };
}
