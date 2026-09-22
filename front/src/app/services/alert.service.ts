import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface DeviceAlert {
  id: number;
  type: string;
  type_raw?: string;
  severity: AlertSeverity;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  message: string;
  diagnostic?: string | null;
  occurrences?: number;
  first_occurred_at?: string | null;
  last_occurred_at?: string | null;
  owner?: { id: number; name: string } | null;
  status: AlertStatus;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  created_at: string;
  device?: {
    id: number;
    serial_number: string;
    label: string;
    mac?: string;
    firmware?: string;
    status?: string;
  } | null;
}

export interface AlertFilter {
  status?: AlertStatus | '';
  severity?: AlertSeverity | '';
  priority?: string | '';
  device_id?: number | '';
  owner_id?: number | '';
  unassigned?: boolean;
  hours?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface AlertStats {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  warning: number;
  info: number;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly base = `${environment.apiUrl}/alerts`;

  constructor(private http: HttpClient) {}

  getAlerts(filters: AlertFilter = {}): Observable<{ data: DeviceAlert[]; total: number; current_page: number }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<{ data: DeviceAlert[]; total: number; current_page: number }>(this.base, { params });
  }

  getStats(): Observable<AlertStats> {
    return this.http.get<AlertStats>(`${this.base}/stats`);
  }

  acknowledge(id: number): Observable<DeviceAlert> {
    return this.http.patch<DeviceAlert>(`${this.base}/${id}/acknowledge`, {});
  }

  resolve(id: number): Observable<DeviceAlert> {
    return this.http.patch<DeviceAlert>(`${this.base}/${id}/resolve`, {});
  }

  reopen(id: number): Observable<DeviceAlert> {
    return this.http.patch<DeviceAlert>(`${this.base}/${id}/reopen`, {});
  }

  assign(id: number, ownerId: number | null): Observable<DeviceAlert> {
    return this.http.patch<DeviceAlert>(`${this.base}/${id}/assign`, { owner_id: ownerId });
  }

  setDiagnostic(id: number, diagnostic: string): Observable<DeviceAlert> {
    return this.http.patch<DeviceAlert>(`${this.base}/${id}/diagnostic`, { diagnostic });
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
