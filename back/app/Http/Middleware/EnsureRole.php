<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restreint une route à une liste de rôles.
 *
 * Usage : ->middleware('role:admin,support')
 *
 * Cahier des charges §4 (Utilisateurs et droits) : chaque rôle n'a accès
 * qu'à ses propres actions. Ce middleware fait respecter cette table
 * côté serveur — jusqu'ici aucune route ne le faisait, tout compte
 * authentifié pouvait tout lire et tout écrire.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, $roles, true)) {
            return response()->json([
                'error'   => 'UNAUTHORIZED',
                'message' => 'Accès refusé. Privilèges insuffisants.',
            ], 403);
        }

        return $next($request);
    }
}
