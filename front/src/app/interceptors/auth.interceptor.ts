import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Attach Bearer token to all API requests
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((err: any) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // Skip automatic logout for the background /me refresh call.
        // That call is fire-and-forget — a 401 there simply means the
        // cached user data won't be updated, which is fine.
        // Real 401s on data endpoints (customers, sites, etc.) will
        // trigger the logout correctly.
        const isMeEndpoint = req.url.endsWith('/me');

        if (!isMeEndpoint) {
          authService.clearSession();
        }
      }
      return throwError(() => err);
    })
  );
};
