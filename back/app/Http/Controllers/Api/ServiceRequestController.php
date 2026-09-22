<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceRequestRequest;
use App\Http\Requests\UpdateServiceRequestRequest;
use App\Models\ServiceRequest;
use App\Models\ServiceRequestHistory;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ServiceRequestController extends Controller
{
    // ── Relations systématiquement chargées ───────────────────────────────────
    private const RELATIONS = ['customer', 'site', 'device', 'assignedToUser'];

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
        $data = $request->validated();
        unset($data['attachment']);

        // Un compte client ne peut créer une demande que pour lui-même,
        // quoi que le payload contienne — l'isolation ne doit jamais
        // reposer sur la bonne foi du client.
        $user = $request->user();
        if ($user->role === User::ROLE_CLIENT) {
            if (! $user->customer_id) {
                return response()->json([
                    'error'   => 'NO_CUSTOMER_LINKED',
                    'message' => 'Ce compte client n\'est rattaché à aucun client.',
                ], 422);
            }
            $data['customer_id'] = $user->customer_id;
        }

        // Photo ou vidéo facultative — cahier §7.4.
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $path = $file->store('service-requests', 'local');
            $data['attachment_path'] = $path;
            $data['attachment_name'] = $file->getClientOriginalName();
            $data['attachment_mime'] = $file->getClientMimeType();
        }

        $sr = ServiceRequest::create($data);

        // Historique : création initiale
        ServiceRequestHistory::create([
            'service_request_id' => $sr->id,
            'field'              => 'status',
            'old_value'          => null,
            'new_value'          => $sr->status,
            'changed_by'         => Auth::id(),
            'comment'            => 'Demande créée.',
        ]);

        NotificationService::serviceRequestCreated($sr);

        return response()->json($sr->load(self::RELATIONS), 201);
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  GET /api/service-requests/{id}
    // ────────────────────────────────────────────────────────────────────────────
    public function show(ServiceRequest $serviceRequest): JsonResponse
    {
        $serviceRequest->load([...self::RELATIONS, 'histories.changedBy']);

        return response()->json($this->hideInternalNotesFromClient($serviceRequest));
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

        if (array_key_exists('status', $data) || array_key_exists('assigned_to', $data)) {
            NotificationService::serviceRequestChanged(
                $serviceRequest,
                'Mise à jour — ' . $serviceRequest->reference,
                $comment ?: 'La demande a été mise à jour.'
            );
        }

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

        NotificationService::serviceRequestChanged(
            $serviceRequest,
            'Statut mis à jour — ' . $serviceRequest->reference,
            'Nouveau statut : ' . $data['status'] . ($data['comment'] ?? '' ? ' — ' . $data['comment'] : '')
        );

        return response()->json($serviceRequest->load([...self::RELATIONS, 'histories.changedBy']));
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  GET /api/service-requests/{id}/histories
    // ────────────────────────────────────────────────────────────────────────────
    public function histories(ServiceRequest $serviceRequest): JsonResponse
    {
        $histories = $serviceRequest->histories()->with('changedBy')->get();

        if (Auth::user()?->role === User::ROLE_CLIENT) {
            $histories = $histories->where('is_internal', false)->values();
        }

        return response()->json($histories);
    }

    /**
     * POST /api/service-requests/{id}/comments
     * Ajoute une note à l'historique, sans changer le statut.
     * « Les notes internes restent invisibles au client » (cahier §7.4) :
     * seul un compte interne peut poser is_internal=true ; un client ne
     * peut jamais en créer, quoi qu'il envoie dans le payload.
     */
    public function addComment(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        $data = $request->validate([
            'comment'     => ['required', 'string', 'max:2000'],
            'is_internal' => ['nullable', 'boolean'],
        ]);

        $user = $request->user();
        $isInternal = $user->role !== User::ROLE_CLIENT && (bool) ($data['is_internal'] ?? false);

        $history = ServiceRequestHistory::create([
            'service_request_id' => $serviceRequest->id,
            'field'              => 'note',
            'old_value'          => null,
            'new_value'          => null,
            'changed_by'         => $user->id,
            'comment'            => $data['comment'],
            'is_internal'        => $isInternal,
        ]);

        if (! $isInternal) {
            NotificationService::serviceRequestChanged(
                $serviceRequest,
                'Nouveau message — ' . $serviceRequest->reference,
                $data['comment']
            );
        }

        return response()->json($history->load('changedBy'), 201);
    }

    /**
     * Retire les notes internes de la réponse quand l'appelant est un client.
     */
    private function hideInternalNotesFromClient(ServiceRequest $serviceRequest): ServiceRequest
    {
        if (Auth::user()?->role === User::ROLE_CLIENT && $serviceRequest->relationLoaded('histories')) {
            $serviceRequest->setRelation(
                'histories',
                $serviceRequest->histories->where('is_internal', false)->values()
            );
        }

        return $serviceRequest;
    }

    // ────────────────────────────────────────────────────────────────────────────
    //  DELETE /api/service-requests/{id}
    // ────────────────────────────────────────────────────────────────────────────
    public function destroy(ServiceRequest $serviceRequest): JsonResponse
    {
        $serviceRequest->delete();
        return response()->json(['message' => 'Demande d\'intervention supprimée.']);
    }

    /**
     * GET /api/service-requests/{id}/attachment
     * Le binding de route sur ServiceRequest applique déjà l'isolation
     * client (CustomerScoped) : un client ne peut pas atteindre la pièce
     * jointe d'une demande qui n'est pas la sienne — {id} résoudrait en 404.
     */
    public function attachment(ServiceRequest $serviceRequest)
    {
        if (! $serviceRequest->attachment_path || ! Storage::disk('local')->exists($serviceRequest->attachment_path)) {
            return response()->json(['message' => 'Aucune pièce jointe.'], 404);
        }

        return Storage::disk('local')->response(
            $serviceRequest->attachment_path,
            $serviceRequest->attachment_name,
            ['Content-Type' => $serviceRequest->attachment_mime ?? 'application/octet-stream']
        );
    }
}
