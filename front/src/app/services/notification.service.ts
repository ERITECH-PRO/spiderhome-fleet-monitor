import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, switchMap, startWith, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Notifications in-app — cahier §7.4 : « Une notification est envoyée à
 * chaque changement significatif. » Pas de push/e-mail : polling simple,
 * suffisant pour une équipe de cette taille et sans infra supplémentaire.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly base = `${environment.apiUrl}/notifications`;

  private readonly _notifications = new BehaviorSubject<AppNotification[]>([]);
  private readonly _unreadCount = new BehaviorSubject<number>(0);
  notifications$ = this._notifications.asObservable();
  unreadCount$ = this._unreadCount.asObservable();

  constructor(private http: HttpClient) {}

  /** À appeler une fois après connexion : démarre le rafraîchissement périodique (60s). */
  startPolling(): void {
    interval(60000).pipe(
      startWith(0),
      switchMap(() => this.fetch())
    ).subscribe();
  }

  fetch(): Observable<{ notifications: AppNotification[]; unread_count: number } | null> {
    return this.http.get<{ notifications: AppNotification[]; unread_count: number }>(this.base).pipe(
      catchError(() => of(null)),
      switchMap((res) => {
        if (res) {
          this._notifications.next(res.notifications);
          this._unreadCount.next(res.unread_count);
        }
        return of(res);
      })
    );
  }

  markRead(id: number): void {
    this.http.patch<AppNotification>(`${this.base}/${id}/read`, {}).subscribe(() => {
      const list = this._notifications.value.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n);
      this._notifications.next(list);
      this._unreadCount.next(Math.max(0, this._unreadCount.value - 1));
    });
  }

  markAllRead(): void {
    this.http.patch(`${this.base}/read-all`, {}).subscribe(() => {
      const list = this._notifications.value.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }));
      this._notifications.next(list);
      this._unreadCount.next(0);
    });
  }

  reset(): void {
    this._notifications.next([]);
    this._unreadCount.next(0);
  }
}
