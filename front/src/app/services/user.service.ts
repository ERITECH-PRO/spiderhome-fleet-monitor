import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'support' | 'technician' | 'quality' | 'client';
  customer_id: number | null;
  phone?: string | null;
  customer?: { id: number; name: string } | null;
  created_at?: string;
}

export interface UserPayload {
  name: string;
  email: string;
  password?: string;
  role: string;
  customer_id?: number | null;
  phone?: string | null;
}

/** Rôles du cahier des charges §4 — doit rester synchronisé avec App\Models\User::ROLES. */
export const ROLE_OPTIONS: { value: AppUser['role']; label: string }[] = [
  { value: 'admin',      label: 'Administrateur — configuration, utilisateurs, audit' },
  { value: 'support',    label: 'Support — clients, modules, incidents, SAV' },
  { value: 'technician', label: 'Technicien — interventions assignées uniquement' },
  { value: 'quality',    label: 'Qualité — statistiques et rapports (lecture seule)' },
  { value: 'client',     label: 'Client — ses sites et modules uniquement' },
];

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly base = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(role?: string): Observable<{ ok: boolean; users: AppUser[] }> {
    const params = role ? { role } : {};
    return this.http.get<{ ok: boolean; users: AppUser[] }>(this.base, { params });
  }

  create(payload: UserPayload): Observable<AppUser> {
    return this.http.post<AppUser>(this.base, payload);
  }

  update(id: number, payload: UserPayload): Observable<AppUser> {
    return this.http.put<AppUser>(`${this.base}/${id}`, payload);
  }

  delete(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}`);
  }
}
