<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ModuleInstall;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * ModuleInstallController — Lecture seule sur module_installs
 *
 * Routes exposées :
 *   GET /api/module-installs            → index()     liste paginée
 *   GET /api/module-installs/{id}       → show()      détail d'un enregistrement
 *   GET /api/module-installs/summary    → summary()   résumé par firmware / email
 *
 * Paramètres de l'index :
 *   ?limit=100        (max 500)
 *   ?device=ESP_A1
 *   ?email=user@ex.com
 *   ?mac=AA:BB:CC:DD:EE:FF
 *   ?firmware=1.4
 *   ?hours=24         → fenêtre temporelle
 *   ?search=...       → recherche dans device_name/email/supla_server/reason
 */
class ModuleInstallController extends Controller
{
    private const MAX_LIMIT     = 500;
    private const DEFAULT_LIMIT = 100;

    // ──────────────────────────────────────────────
    // GET /api/module-installs
    // ──────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $limit    = $this->clampLimit($request->query('limit', self::DEFAULT_LIMIT));
        $device   = $request->query('device');
        $email    = $request->query('email');
        $mac      = $request->query('mac');
        $firmware = $request->query('firmware');
        $hours    = $request->query('hours');
        $search   = $request->query('search');

        try {
            $query = ModuleInstall::orderByDesc('timestamp');

            if ($device) {
                $query->forDevice($device);
            }

            if ($email) {
                $query->forEmail($email);
            }

            if ($mac) {
                $query->forMac($mac);
            }

            if ($firmware) {
                $query->forFirmware($firmware);
            }

            if ($hours && is_numeric($hours)) {
                $query->lastHours((int) $hours);
            }

            if ($search) {
                $term = "%{$search}%";
                $query->where(function ($q) use ($term) {
                    $q->where('device_name',  'like', $term)
                      ->orWhere('email',        'like', $term)
                      ->orWhere('supla_server', 'like', $term)
                      ->orWhere('reason',       'like', $term)
                      ->orWhere('device',       'like', $term);
                });
            }

            $rows = $query->limit($limit)->get();

            return response()->json([
                'ok'    => true,
                'count' => $rows->count(),
                'limit' => $limit,
                'rows'  => $rows,
            ]);
        } catch (\Exception $e) {
            return $this->dbError($e);
        }
    }

    // ──────────────────────────────────────────────
    // GET /api/module-installs/{id}
    // ──────────────────────────────────────────────
    public function show(int $id): JsonResponse
    {
        try {
            $row = ModuleInstall::findOrFail($id);
            return response()->json(['ok' => true, 'row' => $row]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return response()->json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        } catch (\Exception $e) {
            return $this->dbError($e);
        }
    }

    // ──────────────────────────────────────────────
    // GET /api/module-installs/summary
    // Résumé : nb installs par firmware, nb devices distincts,
    // nb emails distincts, dernière installation.
    // ──────────────────────────────────────────────
    public function summary(Request $request): JsonResponse
    {
        $hours = max(1, min(8760, (int) $request->query('hours', 168))); // défaut 7 jours

        try {
            // Agrégats par firmware
            $byFirmware = ModuleInstall::select([
                    'firmware',
                    DB::raw('COUNT(*)               AS install_count'),
                    DB::raw('COUNT(DISTINCT device) AS unique_devices'),
                    DB::raw('COUNT(DISTINCT email)  AS unique_emails'),
                    DB::raw('MAX(timestamp)         AS last_install'),
                ])
                ->lastHours($hours)
                ->groupBy('firmware')
                ->orderByDesc('install_count')
                ->get();

            // Compteurs globaux
            $totals = ModuleInstall::lastHours($hours)
                ->selectRaw('COUNT(*) AS total_installs, COUNT(DISTINCT device) AS unique_devices, COUNT(DISTINCT email) AS unique_emails, COUNT(DISTINCT mac) AS unique_macs')
                ->first();

            return response()->json([
                'ok'          => true,
                'hours'       => $hours,
                'totals'      => $totals,
                'by_firmware' => $byFirmware,
            ]);
        } catch (\Exception $e) {
            return $this->dbError($e);
        }
    }

    // ──────────────────────────────────────────────
    // Helpers privés
    // ──────────────────────────────────────────────

    private function clampLimit(mixed $value, int $max = self::MAX_LIMIT, int $default = self::DEFAULT_LIMIT): int
    {
        $n = (int) $value;
        return ($n > 0) ? min($n, $max) : $default;
    }

    private function dbError(\Exception $e): JsonResponse
    {
        return response()->json([
            'ok'     => false,
            'error'  => 'DB_QUERY_FAILED',
            'detail' => $e->getMessage(),
        ], 500);
    }
}
