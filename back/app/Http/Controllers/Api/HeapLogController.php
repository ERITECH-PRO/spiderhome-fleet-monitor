<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HeapLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * HeapLogController — Lecture seule sur heap_logs
 *
 * Routes exposées :
 *   GET /api/heap-logs              → index()    liste paginée
 *   GET /api/heap-logs/{id}         → show()     détail d'un enregistrement
 *   GET /api/heap-logs/devices      → devices()  liste des devices distincts
 *   GET /api/heap-logs/stats        → stats()    agrégats par device
 *
 * Paramètres de l'index :
 *   ?limit=50        (max 500)
 *   ?device=ESP_A1
 *   ?status=CRITICAL
 *   ?hours=24        → fenêtre temporelle
 *   ?search=...      → recherche dans event/note/status
 */
class HeapLogController extends Controller
{
    private const MAX_LIMIT     = 500;
    private const DEFAULT_LIMIT = 50;

    // ──────────────────────────────────────────────
    // GET /api/heap-logs
    // ──────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $limit  = $this->clampLimit($request->query('limit', self::DEFAULT_LIMIT));
        $device = $request->query('device');
        $status = $request->query('status');
        $hours  = $request->query('hours');
        $search = $request->query('search');

        try {
            $query = HeapLog::orderByDesc('timestamp');

            if ($device) {
                $query->forDevice($device);
            }

            if ($status) {
                $query->withStatus(strtoupper($status));
            }

            if ($hours && is_numeric($hours)) {
                $query->lastHours((int) $hours);
            }

            if ($search) {
                $term = "%{$search}%";
                $query->where(function ($q) use ($term) {
                    $q->where('event',  'like', $term)
                      ->orWhere('note',   'like', $term)
                      ->orWhere('status', 'like', $term)
                      ->orWhere('level',  'like', $term);
                });
            }

            $rows = $query->limit($limit)->get();

            return response()->json([
                'ok'     => true,
                'count'  => $rows->count(),
                'limit'  => $limit,
                'rows'   => $rows,
            ]);
        } catch (\Exception $e) {
            return $this->dbError($e);
        }
    }

    // ──────────────────────────────────────────────
    // GET /api/heap-logs/{id}
    // ──────────────────────────────────────────────
    public function show(int $id): JsonResponse
    {
        try {
            $row = HeapLog::findOrFail($id);
            return response()->json(['ok' => true, 'row' => $row]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException) {
            return response()->json(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        } catch (\Exception $e) {
            return $this->dbError($e);
        }
    }

    // ──────────────────────────────────────────────
    // GET /api/heap-logs/devices
    // Retourne la liste des devices distincts avec
    // leur dernier timestamp et heap_kb moyen.
    // ──────────────────────────────────────────────
    public function devices(): JsonResponse
    {
        try {
            $rows = HeapLog::select([
                    'device',
                    DB::raw('COUNT(*) AS total_entries'),
                    DB::raw('MAX(timestamp) AS last_seen'),
                    DB::raw('ROUND(AVG(heap_kb), 2) AS avg_heap_kb'),
                    DB::raw('MIN(heap_kb) AS min_heap_kb'),
                    DB::raw('MAX(heap_kb) AS max_heap_kb'),
                ])
                ->groupBy('device')
                ->orderBy('device')
                ->get();

            return response()->json(['ok' => true, 'count' => $rows->count(), 'devices' => $rows]);
        } catch (\Exception $e) {
            return $this->dbError($e);
        }
    }

    // ──────────────────────────────────────────────
    // GET /api/heap-logs/stats
    // Agrégats sur les dernières 24h (configurable via ?hours=N)
    // ──────────────────────────────────────────────
    public function stats(Request $request): JsonResponse
    {
        $hours = max(1, min(720, (int) $request->query('hours', 24)));

        try {
            $rows = HeapLog::select([
                    'device',
                    DB::raw("SUM(CASE WHEN UPPER(COALESCE(status,'')) = 'CRITICAL'
                                    OR UPPER(COALESCE(level,''))  = 'CRITICAL'
                             THEN 1 ELSE 0 END) AS critical_count"),
                    DB::raw('COUNT(*) AS total_entries'),
                    DB::raw('ROUND(MIN(heap_kb), 2)  AS min_heap_kb'),
                    DB::raw('ROUND(MAX(heap_kb), 2)  AS max_heap_kb'),
                    DB::raw('ROUND(AVG(heap_kb), 2)  AS avg_heap_kb'),
                    DB::raw('MAX(timestamp)           AS last_seen'),
                ])
                ->lastHours($hours)
                ->groupBy('device')
                ->orderBy('device')
                ->get();

            return response()->json([
                'ok'    => true,
                'hours' => $hours,
                'count' => $rows->count(),
                'rows'  => $rows,
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
