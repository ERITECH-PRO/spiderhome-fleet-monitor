import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject, catchError, of, map } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY  = 'auth_user';

  private apiUrl = environment.apiUrl;

  private currentUserSubject = new BehaviorSubject<User | null>(this._readCachedUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    // If a token exists, silently refresh the user object from the server.
    // This does NOT affect routing — the guard uses only the localStorage token.
    if (this.getToken()) {
      this._refreshUserSilently();
    }
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private _readCachedUser(): User | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private _persistUser(user: User): void {
    try {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch { /* ignore */ }
  }

  /** Fire-and-forget: refresh user data in background without any redirect side-effects. */
  private _refreshUserSilently(): void {
    this.http.get<any>(`${this.apiUrl}/me`).subscribe({
      next: (res) => {
        if (res?.ok && res.user) {
          this._persistUser(res.user);
          this.currentUserSubject.next(res.user);
        }
        // If not ok but no 401 → leave current cached user as-is
      },
      // 401 errors are handled globally by the interceptor → clearSession()
      // Any other network error → silently ignore, keep cached user
      error: () => {}
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(response => {
        if (response.ok && response.access_token) {
          localStorage.setItem(this.TOKEN_KEY, response.access_token);
          if (response.user) {
            this._persistUser(response.user);
            this.currentUserSubject.next(response.user);
          }
        }
      })
    );
  }

  fetchUser(): Observable<User | null> {
    return this.http.get<any>(`${this.apiUrl}/me`).pipe(
      tap(res => {
        if (res?.ok && res.user) {
          this._persistUser(res.user);
          this.currentUserSubject.next(res.user);
        }
      }),
      map(r => (r?.ok ? r.user : null)),
      catchError(() => of(null))
    );
  }

  logout() {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      next:  () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // ── Password Reset Flow (Brevo OTP) ─────────────────────────────────────────

  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyOtp(email: string, otp: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verify-otp`, { email, otp });
  }

  resetPassword(payload: {
    email: string;
    password: string;
    password_confirmation: string;
    reset_token?: string;
    otp?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, payload);
  }

  /** Synchronous check — only looks at localStorage, no HTTP call.
   *  This is what the authGuard uses to avoid any race condition.
   */
  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }
}

