import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SRStatus   = 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
export type SRPriority = 'critical' | 'high' | 'normal' | 'low';

export interface SRCustomer { id: number; name: string; email?: string | null; }
export interface SRSite     { id: number; name: string; address?: string | null; customer_id?: number; }
export interface SRDevice   { id: number; serial_number: string; label?: string | null; firmware?: string | null; }
export interface SRUser     { id: number; name: string; email: string; }

export interface ServiceRequestHistory {
  id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  comment: string | null;
  changed_by: SRUser | null;
  created_at: string;
}

export interface ServiceRequest {
  id: number;
  reference: string;
  title: string;
  reason: string | null;
  description: string;
  status: SRStatus;
  priority: SRPriority;
  customer_id: number;
  site_id: number | null;
  device_id: number | null;
  assigned_to: number | null;
  desired_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  customer: SRCustomer | null;
  site: SRSite | null;
  device: SRDevice | null;
  assigned_to_user?: SRUser | null;
  histories?: ServiceRequestHistory[];
}

export interface SRPagination {
  data: ServiceRequest[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface SRFilter {
  status?:      SRStatus | '';
  priority?:    SRPriority | '';
  customer_id?: number | '';
  search?:      string;
  sort?:        'priority' | 'created_at' | 'desired_at' | 'updated_at';
  order?:       'asc' | 'desc';
  per_page?:    number;
  page?:        number;
}

export interface StoreServiceRequestPayload {
  customer_id:  number;
  site_id?:     number | null;
  device_id?:   number | null;
  assigned_to?: number | null;
  title:        string;
  reason?:      string;
  description:  string;
  priority?:    SRPriority;
  status?:      SRStatus;
  desired_at?:  string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ServiceRequestService {
  private readonly base = `${environment.apiUrl}/service-requests`;

  constructor(private http: HttpClient) {}

  getAll(filters: SRFilter = {}): Observable<SRPagination> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<SRPagination>(this.base, { params });
  }

  getById(id: number): Observable<ServiceRequest> {
    return this.http.get<ServiceRequest>(`${this.base}/${id}`);
  }

  create(payload: StoreServiceRequestPayload): Observable<ServiceRequest> {
    return this.http.post<ServiceRequest>(this.base, payload);
  }

  update(id: number, payload: Partial<StoreServiceRequestPayload> & { comment?: string }): Observable<ServiceRequest> {
    return this.http.patch<ServiceRequest>(`${this.base}/${id}`, payload);
  }

  updateStatus(id: number, status: SRStatus, comment?: string): Observable<ServiceRequest> {
    return this.http.patch<ServiceRequest>(`${this.base}/${id}/status`, { status, comment });
  }

  getHistories(id: number): Observable<ServiceRequestHistory[]> {
    return this.http.get<ServiceRequestHistory[]>(`${this.base}/${id}/histories`);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
