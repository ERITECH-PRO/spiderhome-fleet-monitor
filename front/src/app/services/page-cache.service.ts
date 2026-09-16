import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, shareReplay, catchError } from 'rxjs/operators';

/**
 * Shared in-memory cache service with true Stale-While-Revalidate (SWR).
 *
 * How it works:
 * 1. If cached data is present: emits the cached data SYNCHRONOUSLY to the subscriber.
 *    Result: The view renders instantly with 0ms delay and no loading spinner/skeleton.
 * 2. In the background, the fresh HTTP request runs. When it completes, it emits the updated
 *    data and updates the cache.
 * 3. If no cache is present: runs the HTTP request, stores in cache, and returns.
 */
@Injectable({ providedIn: 'root' })
export class PageCacheService {
  private cache = new Map<string, any>();

  /** Store data in cache. */
  set<T>(key: string, data: T): void {
    this.cache.set(key, data);
  }

  get<T>(key: string): T | null {
    return this.cache.has(key) ? this.cache.get(key) : null;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** Invalidate all cache keys matching the prefix. */
  invalidate(prefix: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /** Clear all cache entries. */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Wrap an Observable with Stale-While-Revalidate behavior:
   * - Emits cached value immediately (if available)
   * - Then executes the background HTTP call and emits fresh data when received
   */
  wrap<T>(key: string, source$: Observable<T>): Observable<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return new Observable<T>(observer => {
        // 1. Immediately emit cached data (synchronous 0ms response)
        observer.next(cached);

        // 2. Refresh in background seamlessly
        const sub = source$.subscribe({
          next: (freshData) => {
            this.set(key, freshData);
            observer.next(freshData);
            observer.complete();
          },
          error: () => {
            // Keep serving cached data silently if network hiccups
            observer.complete();
          }
        });

        return () => sub.unsubscribe();
      });
    }

    // First visit: fetch, cache, and return
    return source$.pipe(
      tap(data => this.set(key, data)),
      shareReplay(1)
    );
  }
}
