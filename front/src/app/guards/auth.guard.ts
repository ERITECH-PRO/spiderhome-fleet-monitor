import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Synchronous guard — checks only the presence of a token in localStorage.
 *
 * WHY synchronous?
 * Waiting for the /me API call creates a race condition: if the network
 * is slow or the dev server is restarting, the guard can resolve to
 * "unauthenticated" and redirect to /login even though the user has a
 * perfectly valid token. That was the source of the "F5 = logout" bug.
 *
 * Instead, we trust the token at the guard level, and let the HTTP
 * interceptor handle actual 401 responses from the API (which correctly
 * clears the session and redirects to /login when the token truly expires).
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  return router.parseUrl('/login');
};
