import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * J10 — Intercepteur HTTP Global pour la gestion sécurisée et uniforme des erreurs.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let userFriendlyMessage = 'Une erreur inattendue est survenue.';

      if (error.status === 401) {
        userFriendlyMessage = 'Session expirée ou non authentifié. Veuillez vous reconnecter.';
        // Si l'utilisateur n'est pas déjà sur la page de login, le rediriger
        if (!router.url.includes('/login')) {
          auth.logout();
          router.navigate(['/login']);
        }
      } else if (error.status === 403) {
        userFriendlyMessage = 'Accès interdit. Vos privilèges sont insuffisants pour cette action.';
      } else if (error.status === 404) {
        userFriendlyMessage = error.error?.message || 'La ressource demandée est introuvable.';
      } else if (error.status === 422) {
        userFriendlyMessage = error.error?.message || 'Certaines données saisies sont invalides.';
      } else if (error.status === 0) {
        userFriendlyMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion réseau.';
      } else if (error.status >= 500) {
        userFriendlyMessage = error.error?.message || 'Erreur interne du serveur. Veuillez réessayer plus tard.';
      }

      // Conserver les détails d'origine tout en garantissant un message sécurisé
      const enhancedError = {
        ...error,
        userMessage: userFriendlyMessage,
        originalError: error
      };

      return throwError(() => enhancedError);
    })
  );
};
