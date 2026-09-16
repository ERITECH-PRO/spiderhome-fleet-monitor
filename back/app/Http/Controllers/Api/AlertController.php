<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Services\EventNormalizerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AlertController extends Controller
{
    private const RELATIONS = ['device:id,serial_number,mac,label,firmware,status'];

    /**
     * GET /api/alerts
     * Params: status, severity, device_id, hours (default 24), search, per_page, page
     */
    public function index(Request $request): JsonResponse
    {
        $hours   = min((int) ($request->get('hours', 24)), 720); // max 30 jours
        $since   = now()->subHours($hours);

        $query = Alert::with(self::RELATIONS)
            ->where('created_at', '>=', $since);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('severity')) {
            $query->where('severity', $request->severity);
        }
        if ($request->filled('device_id')) {
            $query->where('device_id', $request->device_id);
        }
        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('message', 'like', "%{$term}%")
                  ->orWhere('type', 'like', "%{$term}%")
                  ->orWhereHas('device', fn($dq) =>
                      $dq->where('serial_number', 'like', "%{$term}%")
                         ->orWhere('label', 'like', "%{$term}%")
                  );
            });
        }

        $sort  = in_array($request->sort, ['created_at', 'severity', 'status']) ? $request->sort : 'created_at';
        $order = $request->order === 'asc' ? 'asc' : 'desc';

        $perPage = min((int) ($request->per_page ?? 30), 100);

        $result = $query->orderBy($sort, $order)->paginate($perPage);

        // Normalise les types/sévérités pour l'affichage
        $result->getCollection()->transform(function ($alert) {
            return $this->formatAlert($alert);
        });

        return response()->json($result);
    }

    /**
     * POST /api/alerts — Créer une alerte manuellement (admin)
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_id' => ['required', 'integer', 'exists:devices,id'],
            'type'      => ['required', 'string', 'max:80'],
            'severity'  => ['required', 'string', Rule::in(['info', 'warning', 'critical'])],
            'message'   => ['nullable', 'string', 'max:1000'],
        ], [
            'device_id.required' => 'Le module est obligatoire.',
            'device_id.exists'   => 'Ce module n\'existe pas.',
            'type.required'      => 'Le type d\'alerte est obligatoire.',
            'severity.in'        => 'Sévérité invalide (info, warning, critical).',
        ]);

        $alert = Alert::create($data + ['status' => 'open']);

        return response()->json($this->formatAlert($alert->load(self::RELATIONS)), 201);
    }

    /**
     * GET /api/alerts/{id}
     */
    public function show(Alert $alert): JsonResponse
    {
        return response()->json($this->formatAlert($alert->load(self::RELATIONS)));
    }

    /**
     * PATCH /api/alerts/{id}/acknowledge — Accuser réception d'une alerte
     */
    public function acknowledge(Request $request, Alert $alert): JsonResponse
    {
        if ($alert->status !== 'open') {
            return response()->json(['message' => 'Cette alerte n\'est pas dans l\'état "open".'], 422);
        }

        $alert->update([
            'status'           => 'acknowledged',
            'acknowledged_by'  => $request->user()->id,
            'acknowledged_at'  => now(),
        ]);

        return response()->json($this->formatAlert($alert->load(self::RELATIONS)));
    }

    /**
     * PATCH /api/alerts/{id}/resolve — Résoudre une alerte
     */
    public function resolve(Alert $alert): JsonResponse
    {
        if ($alert->status === 'resolved') {
            return response()->json(['message' => 'Cette alerte est déjà résolue.'], 422);
        }

        $alert->update([
            'status'      => 'resolved',
            'resolved_at' => now(),
        ]);

        return response()->json($this->formatAlert($alert->load(self::RELATIONS)));
    }

    /**
     * PATCH /api/alerts/{id}/reopen — Réouvrir une alerte résolue/accusée
     */
    public function reopen(Alert $alert): JsonResponse
    {
        $alert->update([
            'status'           => 'open',
            'acknowledged_by'  => null,
            'acknowledged_at'  => null,
            'resolved_at'      => null,
        ]);

        return response()->json($this->formatAlert($alert->load(self::RELATIONS)));
    }

    /**
     * DELETE /api/alerts/{id}
     */
    public function destroy(Alert $alert): JsonResponse
    {
        $alert->delete();
        return response()->json(['message' => 'Alerte supprimée.']);
    }

    // ── Statistiques rapides ──────────────────────────────────────────────────

    /**
     * GET /api/alerts/stats — Compteurs par statut et sévérité (dernières 24h)
     */
    public function stats(): JsonResponse
    {
        $since = now()->subDays(7);

        $base = Alert::where('created_at', '>=', $since);

        return response()->json([
            'total'        => (clone $base)->count(),
            'open'         => (clone $base)->where('status', 'open')->count(),
            'acknowledged' => (clone $base)->where('status', 'acknowledged')->count(),
            'resolved'     => (clone $base)->where('status', 'resolved')->count(),
            'critical'     => (clone $base)->where('severity', 'critical')->count(),
            'warning'      => (clone $base)->where('severity', 'warning')->count(),
            'info'         => (clone $base)->where('severity', 'info')->count(),
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private function formatAlert(Alert $alert): array
    {
        return [
            'id'               => $alert->id,
            'type'             => EventNormalizerService::normalizeType($alert->type),
            'type_raw'         => $alert->type,
            'severity'         => EventNormalizerService::normalizeSeverity($alert->severity, $alert->type),
            'message'          => $alert->message,
            'status'           => $alert->status,
            'acknowledged_at'  => $alert->acknowledged_at?->toIso8601String(),
            'resolved_at'      => $alert->resolved_at?->toIso8601String(),
            'created_at'       => $alert->created_at?->toIso8601String(),
            'device'           => $alert->device ? [
                'id'            => $alert->device->id,
                'serial_number' => $alert->device->serial_number,
                'label'         => $alert->device->label ?? $alert->device->serial_number,
                'mac'           => $alert->device->mac,
                'firmware'      => $alert->device->firmware,
                'status'        => $alert->device->status,
            ] : null,
        ];
    }
}
