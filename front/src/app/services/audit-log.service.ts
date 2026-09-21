import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuditLogEntry {
  id: number;
  action: string;
  auditable_type: string | null;
  auditable_id: number | null;
  meta: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
}

export interface AuditLogPage {
  data: AuditLogEntry[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly base = `${environment.apiUrl}/audit-logs`;

  constructor(private http: HttpClient) {}

  getAll(params: {
    action?: string;
    user_id?: number;
    auditable_type?: string;
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  } = {}): Observable<AuditLogPage> {
    const query: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query[k] = String(v);
    });
    return this.http.get<AuditLogPage>(this.base, { params: query });
  }
}
