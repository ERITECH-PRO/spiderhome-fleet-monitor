<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // ── Gestion sécurisée des erreurs API (Pas de fuite SQL / Stack Trace) ───
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                if ($e instanceof ValidationException) {
                    return response()->json([
                        'message' => 'Les données fournies sont invalides.',
                        'errors'  => $e->errors(),
                    ], 422);
                }

                if ($e instanceof ModelNotFoundException || ($e instanceof NotFoundHttpException && $e->getPrevious() instanceof ModelNotFoundException)) {
                    return response()->json([
                        'error'   => 'RESOURCE_NOT_FOUND',
                        'message' => 'La ressource demandée est introuvable.',
                    ], 404);
                }

                if ($e instanceof NotFoundHttpException) {
                    return response()->json([
                        'error'   => 'ENDPOINT_NOT_FOUND',
                        'message' => 'Point d\'accès API introuvable.',
                    ], 404);
                }

                if ($e instanceof AuthenticationException) {
                    return response()->json([
                        'error'   => 'UNAUTHENTICATED',
                        'message' => 'Non authentifié. Veuillez vous connecter.',
                    ], 401);
                }

                if ($e instanceof AuthorizationException) {
                    return response()->json([
                        'error'   => 'UNAUTHORIZED',
                        'message' => 'Accès refusé. Privilèges insuffisants.',
                    ], 403);
                }

                if ($e instanceof QueryException) {
                    // Masquer la requête SQL et les détails de schéma
                    return response()->json([
                        'error'   => 'DATABASE_ERROR',
                        'message' => 'Une erreur de base de données est survenue lors du traitement.',
                    ], 500);
                }

                if ($e instanceof HttpException) {
                    return response()->json([
                        'error'   => 'HTTP_ERROR',
                        'message' => $e->getMessage() ?: 'Une erreur HTTP est survenue.',
                    ], $e->getStatusCode());
                }

                // Erreur serveur 500 générique
                return response()->json([
                    'error'   => 'SERVER_ERROR',
                    'message' => config('app.debug') ? $e->getMessage() : 'Une erreur interne est survenue sur le serveur.',
                ], 500);
            }

            return null;
        });
    })->create();
