import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TwoFactorEnableResponse {
  secret: string;
  qr_svg: string;
  otpauth: string;
}

@Injectable({ providedIn: 'root' })
export class TwoFactorService {
  private readonly base = `${environment.apiUrl}/two-factor`;

  constructor(private http: HttpClient) {}

  status(): Observable<{ enabled: boolean }> {
    return this.http.get<{ enabled: boolean }>(`${this.base}/status`);
  }

  enable(): Observable<TwoFactorEnableResponse> {
    return this.http.post<TwoFactorEnableResponse>(`${this.base}/enable`, {});
  }

  confirm(code: string): Observable<{ recovery_codes: string[] }> {
    return this.http.post<{ recovery_codes: string[] }>(`${this.base}/confirm`, { code });
  }

  disable(password: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/disable`, { password });
  }
}
