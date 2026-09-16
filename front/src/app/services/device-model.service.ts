import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { PageCacheService } from './page-cache.service';

export interface DeviceModel {
  id: number;
  name: string;
  mcu: string | null;
  ota_capable: boolean;
  manufacturer: string | null;
  min_firmware: string | null;
  description: string | null;
  devices_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceModelPage {
  data: DeviceModel[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class DeviceModelService {
  private readonly base = `${environment.apiUrl}/device-models`;

  constructor(private http: HttpClient, private cache: PageCacheService) {}

  getAll(params: { search?: string; ota_capable?: boolean; all?: boolean; per_page?: number } = {}): Observable<DeviceModelPage | DeviceModel[]> {
    let p = new HttpParams();
    if (params.search !== undefined)      p = p.set('search', params.search);
    if (params.ota_capable !== undefined) p = p.set('ota_capable', String(params.ota_capable));
    if (params.all)                       p = p.set('all', 'true');
    if (params.per_page)                  p = p.set('per_page', String(params.per_page));

    const cacheKey = `device-models:${p.toString()}`;
    return this.cache.wrap(cacheKey, this.http.get<DeviceModelPage | DeviceModel[]>(this.base, { params: p }));
  }

  getById(id: number): Observable<DeviceModel> {
    return this.http.get<DeviceModel>(`${this.base}/${id}`);
  }

  create(data: Partial<DeviceModel>): Observable<DeviceModel> {
    return this.http.post<DeviceModel>(this.base, data).pipe(tap(() => this._invalidateAll()));
  }

  update(id: number, data: Partial<DeviceModel>): Observable<DeviceModel> {
    return this.http.put<DeviceModel>(`${this.base}/${id}`, data).pipe(tap(() => this._invalidateAll()));
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`).pipe(tap(() => this._invalidateAll()));
  }

  private _invalidateAll(): void {
    ['device-models:', 'device-models:all=true'].forEach(k => this.cache.invalidate(k));
  }
}
