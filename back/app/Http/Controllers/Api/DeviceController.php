<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeviceRequest;
use App\Models\Device;
use App\Services\EventNormalizerService;
use App\Services\HealthRuleEngine;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    /**
     * GET /api/devices
     * Liste avec filtres: site_id, model_id, status, customer_id, search.
     */
    public function index(Request $request)
    {
        $query = Device::with(['site.customer', 'model']);

        if ($siteId = $request->get('site_id')) {
            $query->where('site_id', $siteId);
        }

        if ($modelId = $request->get('model_id')) {
            $query->where('model_id', $modelId);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($customerId = $request->get('customer_id')) {
            $query->whereHas('site', fn($q) => $q->where('customer_id', $customerId));
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('guid', 'like', "%{$search}%")
                  ->orWhere('serial_number', 'like', "%{$search}%")
                  ->orWhere('ip_address', 'like', "%{$search}%")
                  ->orWhere('legacy_device_key', 'like', "%{$search}%")
                  ->orWhere('label', 'like', "%{$search}%")
                  ->orWhere('mac', 'like', "%{$search}%")
                  ->orWhere('firmware', 'like', "%{$search}%")
                  ->orWhereHas('site', function ($s) use ($search) {
                      $s->where('name', 'like', "%{$search}%")
                        ->orWhereHas('customer', fn($c) => $c->where('name', 'like', "%{$search}%"));
                  });
            });
        }

        if ($request->boolean('all')) {
            $devices = $query->orderBy('serial_number')->get();
            $this->enrichWithHealth($devices);
            return response()->json($devices);
        }

        $perPage = min((int) $request->get('per_page', 25), 200);
        $paginated = $query->latest()->paginate($perPage);
        $this->enrichWithHealth($paginated->getCollection());

        return response()->json($paginated);
    }

    /**
     * Enrichit une collection de Device avec l'état de santé unifié (sain, surveillance, critique)
     */
    private function enrichWithHealth($devices): void
    {
        if ($devices->isEmpty()) {
            return;
        }

        $serials = $devices->pluck('serial_number')->filter()->values()->toArray();
        $deviceIds = $devices->pluck('id')->filter()->values()->toArray();

        $fifteenMinutesAgo = now()->subMinutes(15);
        $twentyFourHoursAgo = now()->subHours(24);

        $latestHeapLogs = \App\Models\HeapLog::select('device', 'heap_kb')
            ->whereIn('device', $serials)
            ->whereIn('id', function ($query) use ($serials) {
                $query->selectRaw('MAX(id)')->from('heap_logs')->whereIn('device', $serials)->groupBy('device');
            })
            ->pluck('heap_kb', 'device');

        $recentOfflineEvents = \App\Models\DeviceEvent::whereIn('type', [
                EventNormalizerService::TYPE_SUPLA_OFFLINE,
                EventNormalizerService::TYPE_WATCHDOG_RESET
            ])
            ->whereIn('device_id', $deviceIds)
            ->where('occurred_at', '>=', $fifteenMinutesAgo)
            ->pluck('device_id')
            ->unique()
            ->toArray();

        $activeAlertDeviceIds = \App\Models\Alert::where('status', 'open')
            ->whereIn('device_id', $deviceIds)
            ->where('created_at', '>=', $twentyFourHoursAgo)
            ->pluck('device_id')
            ->unique()
            ->toArray();

        $options = [
            'recent_offline_device_ids' => $recentOfflineEvents,
            'active_alert_device_ids'   => $activeAlertDeviceIds,
        ];

        foreach ($devices as $dev) {
            $heapKb = isset($latestHeapLogs[$dev->serial_number]) ? (float) $latestHeapLogs[$dev->serial_number] : null;
            $eval = HealthRuleEngine::evaluateDevice($dev, $heapKb, $options);
            $dev->health = $eval['health'];
            $dev->health_reason = $eval['health_reason'];
            $dev->current_heap = $heapKb;
        }
    }

    /**
     * POST /api/devices
     */
    public function store(DeviceRequest $request)
    {
        $device = Device::create($request->validated());
        return response()->json($device->load(['site.customer', 'model']), 201);
    }

    /**
     * GET /api/devices/{device}
     */
    public function show(Device $device)
    {
        return response()->json(
            $device->load(['site.customer', 'model', 'events' => fn($q) => $q->latest()->limit(20)])
        );
    }

    /**
     * PUT/PATCH /api/devices/{device}
     */
    public function update(DeviceRequest $request, Device $device)
    {
        $device->update($request->validated());
        return response()->json($device->load(['site.customer', 'model']));
    }

    /**
     * GET /api/devices/{device}/qr
     * Génère le QR code vectoriel SVG et la charge utile pour impression/scan.
     */
    public function qr(Device $device)
    {
        $device->load(['site.customer', 'model']);

        $payload = [
            'id'            => $device->id,
            'serial_number' => $device->serial_number,
            'legacy_key'    => $device->legacy_device_key,
            'mac'           => $device->mac,
            'firmware'      => $device->firmware,
            'status'        => $device->status,
            'model'         => $device->model?->name,
            'mcu'           => $device->model?->mcu,
            'site'          => $device->site?->name,
            'customer'      => $device->site?->customer?->name,
            'app_url'       => url("/devices?search={$device->serial_number}"),
        ];

        // Format compact encodé dans le QR code pour scan rapide
        $qrContent = json_encode([
            'spdr' => $device->serial_number,
            'key'  => $device->legacy_device_key,
            'mac'  => $device->mac,
            'site' => $device->site?->name,
            'cust' => $device->site?->customer?->name,
        ], JSON_UNESCAPED_SLASHES);

        $svg = \App\Services\QrCodeService::generateSvg($qrContent, 260);
        $dataUrl = \App\Services\QrCodeService::generateDataUrl($qrContent, 260);

        return response()->json([
            'device'     => $device,
            'payload'    => $payload,
            'qr_content' => $qrContent,
            'svg'        => $svg,
            'data_url'   => $dataUrl,
        ]);
    }

    /**
     * DELETE /api/devices/{device}
     */
    public function destroy(Device $device)
    {
        $device->delete();
        return response()->json(['message' => 'Module supprimé avec succès.'], 200);
    }

    /**
     * GET /api/devices/{id}/health
     * Vue diagnostic unifiée : informations du module, installation, dernier état, télémétrie et événements récents.
     */
    public function health($id)
    {
        $device = Device::where('id', $id)
            ->orWhere('guid', $id)
            ->orWhere('serial_number', $id)
            ->orWhere('mac', $id)
            ->orWhere('legacy_device_key', $id)
            ->with(['site.customer', 'model'])
            ->first();

        if (!$device) {
            return response()->json([
                'ok' => false,
                'error' => 'DEVICE_NOT_FOUND',
                'message' => "Le module avec l'identifiant '{$id}' est introuvable."
            ], 404);
        }

        // 1. Données d'installation (recherche dans module_installs legacy)
        $install = \App\Models\ModuleInstall::where('device', $device->serial_number)
            ->orWhere('mac', $device->mac)
            ->orWhere('device_name', $device->serial_number)
            ->latest('timestamp')
            ->first();

        $installationInfo = [
            'customer_name'  => $device->site?->customer?->name ?? 'Non assigné',
            'customer_email' => $device->site?->customer?->email ?? $install?->email ?? '—',
            'site_name'      => $device->site?->name ?? 'Site non défini',
            'site_address'   => $device->site?->address ?? '—',
            'installed_at'   => $install?->timestamp?->toIso8601String() ?? $device->created_at?->toIso8601String(),
            'supla_server'   => $device->supla_server ?? $install?->supla_server ?? '—',
            'location_label' => $device->label ?? $device->site?->name ?? 'Emplacement standard',
        ];

        // 2. Données de télémétrie Heap (recherche dans heap_logs legacy)
        $targetSerials = array_filter(array_unique([
            $device->serial_number,
            $device->mac,
            $device->legacy_device_key
        ]));

        $logs = \App\Models\HeapLog::whereIn('device', $targetSerials)
            ->where('timestamp', '>=', now()->subDays(7))
            ->orderBy('timestamp', 'asc')
            ->get();

        if ($logs->isEmpty()) {
            $logs = \App\Models\HeapLog::whereIn('device', $targetSerials)
                ->orderBy('timestamp', 'desc')
                ->limit(60)
                ->get()
                ->reverse();
        }

        $points = $logs->map(function ($log) {
            $heapKb = (float) $log->heap_kb;
            $zone = ($heapKb < 10.0) ? 'critique' : (($heapKb < 20.0) ? 'surveillance' : 'sain');
            return [
                'timestamp' => $log->timestamp instanceof \Carbon\Carbon ? $log->timestamp->toIso8601String() : $log->timestamp,
                'heap_kb'   => $heapKb,
                'zone'      => $zone,
                'status'    => $log->status ?? $log->level ?? 'OK',
                'uptime'    => $log->uptime,
                'event'     => $log->event,
            ];
        });

        $latestLog = $logs->last();
        $currentHeap = $latestLog ? (float) $latestLog->heap_kb : null;

        // Calcul état de santé unifié via HealthRuleEngine
        $evaluation = HealthRuleEngine::evaluateDevice($device, $currentHeap);

        // 3. Événements récents du module (depuis device_events, normalisés)
        $events = \App\Models\DeviceEvent::where('device_id', $device->id)
            ->orderByDesc('occurred_at')
            ->limit(20)
            ->get()
            ->map(function ($ev) {
                $type = EventNormalizerService::normalizeType($ev->type);
                $severity = EventNormalizerService::normalizeSeverity($ev->severity, $type, $ev->value);
                $message = EventNormalizerService::normalizeMessage($type, $ev->message, $ev->value);

                return [
                    'id'               => $ev->id,
                    'type'             => $type,
                    'severity'         => $severity,
                    'message'          => $message,
                    'valeur_technique' => $ev->value,
                    'occurred_at'      => $ev->occurred_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'ok' => true,
            'module' => [
                'id'            => $device->id,
                'serial_number' => $device->serial_number,
                'label'         => $device->label ?? $device->serial_number,
                'status'        => $device->status,
                'health'        => $evaluation['health'],
                'health_reason' => $evaluation['health_reason'],
                'info' => [
                    'model'        => $device->model?->name ?? '—',
                    'mcu'          => $device->model?->mcu ?? '—',
                    'guid'         => $device->guid ?? '—',
                    'serial_number'=> $device->serial_number,
                    'ip_address'   => $device->ip_address,
                    'legacy_key'   => $device->legacy_device_key ?? '—',
                    'mac'          => $device->mac ?? '—',
                    'firmware'     => $device->firmware ?? '—',
                    'status'       => $device->status,
                    'ota_capable'  => (bool) ($device->model?->ota_capable ?? false),
                ],
                'installation' => $installationInfo,
                // Bloc « Statut » tel qu'affiché par cloud.spiderhome.org / cloud.supla.org
                'supla_status' => [
                    'connected'          => $device->supla_connected,
                    'guid'               => $device->guid,
                    'firmware'           => $device->firmware,
                    'registered_at'      => $device->registered_at?->toIso8601String(),
                    'last_connected_at'  => $device->last_connected_at?->toIso8601String(),
                    'ip_address'         => $device->ip_address,
                    'mac'                => $device->mac,
                    'wifi_rssi'          => $device->wifi_rssi,
                    'wifi_quality_pct'   => $device->wifi_quality_pct,
                    'uptime_seconds'     => $device->last_uptime,
                    'connection_uptime'  => $device->connection_uptime,
                ],
                'latest_state' => [
                    'last_contact'      => $device->last_seen_at?->toIso8601String() ?? $latestLog?->timestamp?->toIso8601String() ?? now()->toIso8601String(),
                    'status'            => $device->status,
                    'current_heap_kb'   => $currentHeap,
                    'current_heap_zone' => $evaluation['heap_zone'],
                    'uptime_seconds'    => $latestLog?->uptime ?? null,
                ],
                'telemetry' => [
                    'thresholds' => [
                        'sain_min'         => HealthRuleEngine::THRESHOLD_SAIN_MIN,
                        'surveillance_min' => HealthRuleEngine::THRESHOLD_SURVEILLANCE_MIN,
                        'critique_max'     => HealthRuleEngine::THRESHOLD_SURVEILLANCE_MIN,
                    ],
                    'points' => $points,
                ],
                'recent_events' => $events,
            ]
        ]);
    }
}
