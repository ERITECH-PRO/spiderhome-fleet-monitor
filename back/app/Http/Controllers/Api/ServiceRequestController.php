<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceRequestRequest;
use App\Http\Requests\UpdateServiceRequestRequest;
use App\Models\ServiceRequest;
use App\Models\ServiceRequestHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class ServiceRequestController extends Controller
{
    // ── Relations systématiquement chargées ───────────────────────────────────
    private const RELATIONS = ['customer', 'site', 'device', 'assignedTo'];

    // ────────────────────────────────────────────────────────────────────────────
    //  GET /api/service-requests
    //  Paramètres : status, priority, customer_id, search, sort (priority|created_at), order (asc|desc), per_page
    // ────────────────────────────────────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $query = ServiceRequest::with(self::RELATIONS)
            ->byStatus($request->status)
            ->byPriority($request->priority)
            ->search($request->search);

        if ($request->customer_id) {
            $query->where('customer_id', $request->customer_id);
        }

        // Tri
        $sort  = in_array($request->sort, ['priority', 'created_at', 'desired_at', 'updated_at'])
                    ? $request->sort : 'created_at';
        $order = $request->order === 'asc' ? 'asc' : 'desc';

        if ($sort === 'priority') {
            $query->orderByRaw("FIELD(priority, 'critical', 'high', 'normal', 'low')");
        } else {
            $query->orderBy($sort, $order);
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);

        return response()->json($query->paginate($perPage));
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  POST /api/service-requests
    // ────────────────────────────────────────────────────────────────────────────
    public function store(StoreServiceRequestRequest $request): JsonResponse
    {
        $sr = ServiceRequest::create($request->validated());

        // Historique : création initiale
        ServiceRequestHistory::create([
            'service_request_id' => $sr->id,
            'field'              => 'status',
            'old_value'          => null,
            'new_value'          => $sr->status,
            'changed_by'         => Auth::id(),
            'comment'            => 'Demande créée.',
        ]);

        return response()->json($sr->load(self::RELATIONS), 201);
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  GET /api/service-requests/{id}
    // ────────────────────────────────────────────────────────────────────────────
    public function show(ServiceRequest $serviceRequest): JsonResponse
    {
        return response()->json(
            $serviceRequest->load([...self::RELATIONS, 'histories.changedBy'])
        );
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  PUT/PATCH /api/service-requests/{id}
    // ────────────────────────────────────────────────────────────────────────────
    public function update(UpdateServiceRequestRequest $request, ServiceRequest $serviceRequest): JsonResponse
    {
        $data    = $request->validated();
        $comment = $data['comment'] ?? null;
        unset($data['comment']);

        // Enregistre l'historique pour les champs surveillés
        $watchedFields = ['status', 'priority', 'assigned_to'];
        foreach ($watchedFields as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== $serviceRequest->$field) {
                ServiceRequestHistory::create([
                    'service_request_id' => $serviceRequest->id,
                    'field'              => $field,
                    'old_value'          => $serviceRequest->$field,
                    'new_value'          => $data[$field],
                    'changed_by'         => Auth::id(),
                    'comment'            => $comment,
                ]);
            }
        }

        // Si on marque comme résolu, on enregistre resolved_at
        if (isset($data['status']) && $data['status'] === ServiceRequest::STATUS_RESOLVED && !$serviceRequest->resolved_at) {
            $data['resolved_at'] = now();
        }

        $serviceRequest->update($data);

        return response()->json($serviceRequest->load([...self::RELATIONS, 'histories.changedBy']));
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  PATCH /api/service-requests/{id}/status
    //  Body : { status: string, comment?: string }
    // ────────────────────────────────────────────────────────────────────────────
    public function updateStatus(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        $data = $request->validate([
            'status'  => ['required', Rule::in(ServiceRequest::STATUSES)],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $oldStatus = $serviceRequest->status;

        if ($oldStatus === $data['status']) {
            return response()->json(['message' => 'Le statut est déjà ' . $data['status'] . '.'], 422);
        }

        ServiceRequestHistory::create([
            'service_request_id' => $serviceRequest->id,
            'field'              => 'status',
            'old_value'          => $oldStatus,
            'new_value'          => $data['status'],
            'changed_by'         => Auth::id(),
            'comment'            => $data['comment'] ?? null,
        ]);

        $update = ['status' => $data['status']];
        if ($data['status'] === ServiceRequest::STATUS_RESOLVED && !$serviceRequest->resolved_at) {
            $update['resolved_at'] = now();
        }

        $serviceRequest->update($update);

        return response()->json($serviceRequest->load([...self::RELATIONS, 'histories.changedBy']));
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  GET /api/service-requests/{id}/histories
    // ────────────────────────────────────────────────────────────────────────────
    public function histories(ServiceRequest $serviceRequest): JsonResponse
    {
        return response()->json(
            $serviceRequest->histories()->with('changedBy')->get()
        );
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  DELETE /api/service-requests/{id}
    // ────────────────────────────────────────────────────────────────────────────
    public function destroy(ServiceRequest $serviceRequest): JsonResponse
    {
        $serviceRequest->delete();
        return response()->json(['message' => 'Demande d\'intervention supprimée.']);
    }
}
