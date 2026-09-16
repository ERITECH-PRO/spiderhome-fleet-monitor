import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageCacheService } from './page-cache.service';

export interface Site {
  id: number;
  customer_id: number;
  name: string;
  address: string | null;
  timezone: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  lat: number | null;
  lng: number | null;
  customer?: { id: number; name: string };
  devices_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SitePage {
  data: Site[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly base = `${environment.apiUrl}/sites`;

  constructor(private http: HttpClient, private cache: PageCacheService) {}

  getAll(params: { search?: string; customer_id?: number; all?: boolean; per_page?: number } = {}): Observable<SitePage | Site[]> {
    let p = new HttpParams();
    if (params.search)      p = p.set('search', params.search);
    if (params.customer_id) p = p.set('customer_id', String(params.customer_id));
    if (params.all)         p = p.set('all', 'true');
    if (params.per_page)    p = p.set('per_page', String(params.per_page));

    const cacheKey = `sites:${p.toString()}`;
    return this.cache.wrap(cacheKey, this.http.get<SitePage | Site[]>(this.base, { params: p }));
  }

  getById(id: number): Observable<Site> {
    return this.http.get<Site>(`${this.base}/${id}`);
  }

  create(data: Partial<Site>): Observable<Site> {
    return this.http.post<Site>(this.base, data).pipe(tap(() => this._invalidateAll()));
  }

  update(id: number, data: Partial<Site>): Observable<Site> {
    return this.http.put<Site>(`${this.base}/${id}`, data).pipe(tap(() => this._invalidateAll()));
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`).pipe(tap(() => this._invalidateAll()));
  }

  private _invalidateAll(): void {
    ['sites:', 'sites:all=true', 'sites:per_page=20'].forEach(k => this.cache.invalidate(k));
  }
}
