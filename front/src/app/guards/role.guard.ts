import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protège une route côté client selon le rôle de l'utilisateur.
 *
 * Ce n'est qu'un confort d'affichage (éviter d'atterrir sur un écran vide) :
 * la vraie protection est côté serveur (middleware `role:...` dans
 * routes/api.php). Un utilisateur qui force l'URL sans le bon rôle est
 * simplement renvoyé au tableau de bord ; l'API refuserait de toute façon
 * chaque appel avec un 403.
 *
 * Usage : { path: 'users', canActivate: [roleGuard(['admin'])], ... }
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const role = authService.currentUserValue?.role;

    if (role && allowedRoles.includes(role)) {
      return true;
    }

    return router.parseUrl('/dashboard');
  };
}
