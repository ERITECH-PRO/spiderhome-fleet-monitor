<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Lecture seule — le journal d'audit ne s'écrit que via AuditLog::record().
 * Aucune route update/destroy n'existe pour cette table (cahier §10 :
 * journal immuable).
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::query()->with('user:id,name,email')->latest('created_at');

        if ($action = $request->query('action')) {
            $query->where('action', 'like', "%{$action}%");
        }
        if ($userId = $request->query('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($type = $request->query('auditable_type')) {
            $query->where('auditable_type', 'like', "%{$type}%");
        }
        if ($from = $request->query('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('created_at', '<=', $to);
        }

        return response()->json($query->paginate((int) $request->query('per_page', 50)));
    }
}
