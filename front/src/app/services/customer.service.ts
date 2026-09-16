import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageCacheService } from './page-cache.service';

export interface Customer {
  id: number;
  name: string;
  server_address?: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  notes: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  sites_count?: number;
  devices_count?: number;
  sites?: any[];
  created_at: string;
  updated_at: string;
}

export interface CustomerPage {
  data: Customer[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly base = `${environment.apiUrl}/customers`;

  constructor(private http: HttpClient, private cache: PageCacheService) {}

  getAll(params: { search?: string; status?: string; all?: boolean; per_page?: number } = {}): Observable<CustomerPage | Customer[]> {
    let p = new HttpParams();
    if (params.search)   p = p.set('search', params.search);
    if (params.status)   p = p.set('status', params.status);
    if (params.all)      p = p.set('all', 'true');
    if (params.per_page) p = p.set('per_page', String(params.per_page));

    const cacheKey = `customers:${p.toString()}`;
    const source$ = this.http.get<CustomerPage | Customer[]>(this.base, { params: p });
    return this.cache.wrap(cacheKey, source$);
  }

  getById(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.base}/${id}`);
  }

  create(data: Partial<Customer>): Observable<Customer> {
    this.cache.invalidate(`customers:`);
    return this.http.post<Customer>(this.base, data).pipe(
      tap(() => this._invalidateAll())
    );
  }

  update(id: number, data: Partial<Customer>): Observable<Customer> {
    return this.http.put<Customer>(`${this.base}/${id}`, data).pipe(
      tap(() => this._invalidateAll())
    );
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`).pipe(
      tap(() => this._invalidateAll())
    );
  }

  private _invalidateAll(): void {
    // Invalidate all customer cache entries
    ['customers:', 'customers:all=true', 'customers:per_page=20'].forEach(k =>
      this.cache.invalidate(k)
    );
  }
}
