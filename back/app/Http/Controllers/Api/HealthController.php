<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

/**
 * Sonde de santé publique (monitoring / load balancer).
 *
 * ⚠️  Ne renvoie jamais le détail d'une erreur SQL : la version stage
 * exposait le message d'exception (nom de base, hôte, identifiants parfois),
 * sur un endpoint non authentifié.
 */
class HealthController extends Controller
{
    public function __invoke()
    {
        $business = $this->check(null);
        $legacy   = $this->check(config('database.heap_connection', 'heap_monitoring'));

        $ok = $business && $legacy;

        return response()->json([
            'status'    => $ok ? 'ok' : 'degraded',
            'timestamp' => now()->toIso8601String(),
            'services'  => [
                'database_business' => $business,
                'database_legacy'   => $legacy,
            ],
        ], $ok ? 200 : 503);
    }

    private function check(?string $connection): bool
    {
        try {
            DB::connection($connection)->select('SELECT 1');

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }
}
