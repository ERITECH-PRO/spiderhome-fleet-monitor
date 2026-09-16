<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LegacyDashboardController extends Controller
{
    public function logs(Request $request)
    {
        $limit = max(1, min(200, (int) $request->query('limit', 50)));
        try {
            $rows = DB::table('heap_logs')
                ->select(['timestamp', 'device', 'heap_kb', 'uptime', 'event', 'status'])
                ->orderByDesc('timestamp')
                ->limit($limit)
                ->get();
            return response()->json(['ok' => true, 'limit' => $limit, 'rows' => $rows]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'error' => 'DB_QUERY_FAILED', 'detail' => $e->getMessage()], 500);
        }
    }

    public function chart(Request $request)
    {
        $limit = max(1, min(2000, (int) $request->query('limit', 100)));
        try {
            $rows = DB::table('heap_logs')
                ->select(['timestamp', 'device', 'heap_kb'])
                ->orderByDesc('timestamp')
                ->limit($limit)
                ->get();
            return response()->json(['ok' => true, 'limit' => $limit, 'rows' => $rows]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'error' => 'DB_QUERY_FAILED', 'detail' => $e->getMessage()], 500);
        }
    }

    public function stats()
    {
        try {
            $rows = DB::table('heap_logs')
                ->select([
                    'device',
                    DB::raw("SUM(CASE WHEN UPPER(COALESCE(status, '')) = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_24h"),
                    DB::raw("MIN(heap_kb) AS min_heap_kb_24h"),
                    DB::raw("MAX(heap_kb) AS max_heap_kb_24h")
                ])
                ->where('timestamp', '>=', DB::raw('NOW() - INTERVAL 1 DAY'))
                ->groupBy('device')
                ->orderBy('device', 'asc')
                ->get();
            return response()->json(['ok' => true, 'rows' => $rows]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'error' => 'DB_QUERY_FAILED', 'detail' => $e->getMessage()], 500);
        }
    }

    public function installations(Request $request)
    {
        $limit = max(1, min(500, (int) $request->query('limit', 100)));
        try {
            $rows = DB::table('module_installs')
                ->select(['timestamp', 'device', 'device_name', 'firmware', 'mac', 'supla_server', 'email', 'uptime_ms', 'reason'])
                ->orderByDesc('timestamp')
                ->limit($limit)
                ->get();
            return response()->json(['ok' => true, 'limit' => $limit, 'rows' => $rows]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'error' => 'DB_QUERY_FAILED', 'detail' => $e->getMessage()], 500);
        }
    }
}
