<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\ServiceRequest;
use App\Models\Alert;
use App\Models\HeapLog;
use App\Services\EventNormalizerService;
use App\Services\HealthRuleEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class FleetDashboardController extends Controller
{
    /**
     * GET /api/fleet/overview
     * Vue globale des compteurs métiers, santé, modules, interventions et alertes 24h.
     */
    public function overview(): JsonResponse
    {
        try {
            // 1. Clients actifs
            $activeCustomersCount = Customer::where('status', 'active')->count();
            $totalCustomersCount  = Customer::count();

            // 2. Modules par statut (en ligne, hors ligne, alerte, retiré)
            $devices = Device::with(['site.customer', 'model'])->get();

            $modulesByStatus = [
                'online'  => $devices->where('status', 'online')->count(),
                'offline' => $devices->where('status', 'offline')->count(),
                'alert'   => $devices->where('status', 'alert')->count(),
                'retired' => $devices->where('status', 'retired')->count(),
                'total'   => $devices->count(),
            ];

            // 3. Demandes d'intervention par statut
            $requests = ServiceRequest::all();
            $interventionsByStatus = [
                'nouvelle'   => $requests->filter(fn($r) => in_array($r->status, ['nouvelle', 'open', 'new']))->count(),
                'en_analyse' => $requests->filter(fn($r) => in_array($r->status, ['en_analyse', 'in_analysis', 'analyzing']))->count(),
                'planifiee'  => $requests->filter(fn($r) => in_array($r->status, ['planifiee', 'planned', 'scheduled']))->count(),
                'terminee'   => $requests->filter(fn($r) => in_array($r->status, ['terminee', 'closed', 'resolved', 'done']))->count(),
                'total'      => $requests->count(),
            ];

            // 4. Alertes récentes (7 derniers jours) avec lien vers le module
            $recentAlerts = Alert::with('device:id,serial_number,mac,label,firmware,status')
                ->where('created_at', '>=', now()->subDays(7))
                ->orderByDesc('created_at')
                ->limit(20)
                ->get()
                ->map(function ($alert) {
                    return [
                        'id'         => $alert->id,
                        'type'       => EventNormalizerService::normalizeType($alert->type),
                        'severity'   => EventNormalizerService::normalizeSeverity($alert->severity, $alert->type),
                        'message'    => $alert->message,
                        'status'     => $alert->status,
                        'created_at' => $alert->created_at?->toIso8601String(),
                        'device'     => $alert->device ? [
                            'id'            => $alert->device->id,
                            'serial_number' => $alert->device->serial_number,
                            'label'         => $alert->device->label ?? $alert->device->serial_number,
                            'mac'           => $alert->device->mac,
                            'status'        => $alert->device->status,
                        ] : null,
                    ];
                });

            // 5. Évaluation unifiée de la santé des modules via HealthRuleEngine
            $fifteenMinutesAgo = now()->subMinutes(15);
            $twentyFourHoursAgo = now()->subHours(24);

            $healthSummary = ['sain' => 0, 'surveillance' => 0, 'critique' => 0];
            $deviceHealthList = [];

            // Récupérer le dernier heap_log par device
            $latestHeapLogs = HeapLog::select('device', 'heap_kb', 'timestamp', 'status')
                ->whereIn('id', function ($query) {
                    $query->selectRaw('MAX(id)')->from('heap_logs')->groupBy('device');
                })
                ->get()
                ->keyBy('device');

            // Événements critiques récents (< 15 min)
            $recentOfflineEvents = DeviceEvent::whereIn('type', [EventNormalizerService::TYPE_SUPLA_OFFLINE, EventNormalizerService::TYPE_WATCHDOG_RESET])
                ->where('occurred_at', '>=', $fifteenMinutesAgo)
                ->pluck('device_id')
                ->unique()
                ->toArray();

            // Alertes ouvertes récentes (< 24h)
            $activeAlertDeviceIds = Alert::where('status', 'open')
                ->where('created_at', '>=', $twentyFourHoursAgo)
                ->pluck('device_id')
                ->unique()
                ->toArray();

            $options = [
                'recent_offline_device_ids' => $recentOfflineEvents,
                'active_alert_device_ids'   => $activeAlertDeviceIds,
            ];

            foreach ($devices as $dev) {
                if ($dev->status === 'retired') {
                    continue;
                }

                $heap = $latestHeapLogs[$dev->serial_number] ?? null;
                $heapKb = $heap?->heap_kb ? (float) $heap->heap_kb : null;

                $evaluation = HealthRuleEngine::evaluateDevice($dev, $heapKb, $options);
                $health = $evaluation['health'];

                $healthSummary[$health]++;

                $deviceHealthList[] = [
                    'id'            => $dev->id,
                    'serial_number' => $dev->serial_number,
                    'label'         => $dev->label ?? $dev->serial_number,
                    'mac'           => $dev->mac,
                    'firmware'      => $dev->firmware,
                    'status'        => $dev->status,
                    'health'        => $health,
                    'health_reason' => $evaluation['health_reason'],
                    'current_heap'  => $heapKb,
                    'last_seen_at'  => $dev->last_seen_at?->toIso8601String(),
                ];
            }

            return response()->json([
                'ok' => true,
                'timestamp' => now()->toIso8601String(),
                'counters' => [
                    'active_customers' => $activeCustomersCount,
                    'total_customers'  => $totalCustomersCount,
                    'modules_status'   => $modulesByStatus,
                    'interventions'    => $interventionsByStatus,
                    'health_summary'   => $healthSummary,
                ],
                'recent_alerts' => $recentAlerts,
                'devices'       => $deviceHealthList,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'error' => 'OVERVIEW_FETCH_FAILED',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/fleet/events
     * Liste filtrable et paginée des événements de la flotte.
     * Types supportés : BOOT, WATCHDOG_RESET, LOW_HEAP, WIFI_LOST, SUPLA_OFFLINE, UPDATE_REQUIRED
     */
    public function events(Request $request): JsonResponse
    {
        try {
            $query = DeviceEvent::with('device:id,serial_number,mac,label,firmware,status');

            // Filtre période
            $period = $request->query('period', 'all');
            if ($period === '1h') {
                $query->where('occurred_at', '>=', now()->subHour());
            } elseif ($period === '24h') {
                $query->where('occurred_at', '>=', now()->subHours(24));
            } elseif ($period === '7d') {
                $query->where('occurred_at', '>=', now()->subDays(7));
            } elseif ($period === '30d') {
                $query->where('occurred_at', '>=', now()->subDays(30));
            }

            // Filtre type d'événement
            if ($type = $request->query('type')) {
                if ($type !== 'ALL') {
                    $canonicalType = EventNormalizerService::normalizeType($type);
                    $query->where('type', $canonicalType);
                }
            }

            // Filtre gravité (info, warning, critical, error)
            if ($severity = $request->query('severity')) {
                if ($severity !== 'ALL') {
                    $canonicalSev = EventNormalizerService::normalizeSeverity($severity);
                    $query->where('severity', $canonicalSev);
                }
            }

            // Filtre module (par serial_number, id ou mac)
            if ($device = $request->query('device')) {
                $query->whereHas('device', function ($q) use ($device) {
                    $q->where('serial_number', $device)
                      ->orWhere('id', $device)
                      ->orWhere('mac', $device);
                });
            }

            // Recherche textuelle
            if ($search = $request->query('search')) {
                $term = "%{$search}%";
                $query->where(function ($q) use ($term) {
                    $q->where('message', 'like', $term)
                      ->orWhere('value', 'like', $term)
                      ->orWhere('type', 'like', $term)
                      ->orWhereHas('device', function ($dq) use ($term) {
                          $dq->where('serial_number', 'like', $term)
                             ->orWhere('label', 'like', $term)
                             ->orWhere('mac', 'like', $term);
                      });
                });
            }

            $perPage = max(5, min(100, (int) $request->query('limit', 15)));
            $paginator = $query->orderByDesc('occurred_at')->paginate($perPage);

            $rows = collect($paginator->items())->map(function ($event) {
                $type = EventNormalizerService::normalizeType($event->type);
                $severity = EventNormalizerService::normalizeSeverity($event->severity, $type, $event->value);
                $message = EventNormalizerService::normalizeMessage($type, $event->message, $event->value);

                return [
                    'id'               => $event->id,
                    'device_id'        => $event->device_id ?? $event->device?->id,
                    'occurred_at'      => $event->occurred_at?->toIso8601String(),
                    'type'             => $type,
                    'severity'         => $severity,
                    'value'            => $event->value,
                    'message'          => $message,
                    'valeur_technique' => $event->value,
                    'device'           => $event->device ? [
                        'id'            => $event->device->id,
                        'serial_number' => $event->device->serial_number,
                        'label'         => $event->device->label ?? $event->device->serial_number,
                        'mac'           => $event->device->mac,
                    ] : null,
                ];
            });

            return response()->json([
                'ok'           => true,
                'rows'         => $rows,
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'error' => 'EVENTS_FETCH_FAILED',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/fleet/heap-history
     * Historique temporel des relevés de Heap pour un module sélectionné
     * avec zones de seuils (Sain >20KB, Surveillance 10-20KB, Critique <10KB).
     */
    public function heapHistory(Request $request): JsonResponse
    {
        try {
            $deviceSerial = trim((string) $request->query('device', ''));

            if ($deviceSerial === '') {
                return response()->json([
                    'ok'      => false,
                    'error'   => 'DEVICE_REQUIRED',
                    'message' => 'Paramètre « device » obligatoire.',
                ], 422);
            }
            $period = $request->query('period', '7d');

            $device = Device::where('serial_number', $deviceSerial)
                ->orWhere('id', $deviceSerial)
                ->orWhere('mac', $deviceSerial)
                ->orWhere('legacy_device_key', $deviceSerial)
                ->first();

            $targetSerials = array_filter(array_unique([
                $deviceSerial,
                $device?->serial_number,
                $device?->mac,
                $device?->legacy_device_key
            ]));

            $queryBuilder = function () use ($targetSerials, $period) {
                $q = HeapLog::whereIn('device', $targetSerials);
                if ($period === '24h') {
                    $q->where('timestamp', '>=', now()->subHours(24));
                } elseif ($period === '7d') {
                    $q->where('timestamp', '>=', now()->subDays(7));
                } elseif ($period === '30d') {
                    $q->where('timestamp', '>=', now()->subDays(30));
                }
                return $q;
            };

            $logs = $queryBuilder()->orderBy('timestamp', 'asc')->get();

            // ⚠️  NON-RÉGRESSION : aucune écriture dans heap_logs.
            // Si aucun relevé n'existe pour ce module, la réponse est simplement vide.
            // La version stage générait ici ~240 lignes de télémétrie fictive
            // directement dans la table de production : comportement supprimé.

            $points = $logs->map(function ($log) {
                $heapKb = (float) $log->heap_kb;
                $zone = ($heapKb < 10.0) ? 'critique' : (($heapKb < 20.0) ? 'surveillance' : 'sain');

                return [
                    'timestamp'   => $log->timestamp instanceof Carbon ? $log->timestamp->toIso8601String() : $log->timestamp,
                    'heap_kb'     => $heapKb,
                    'zone'        => $zone,
                    'status'      => $log->status ?? $log->level ?? 'OK',
                    'uptime'      => $log->uptime,
                    'event'       => $log->event,
                ];
            });

            // Calcul du statut de santé actuel du module via HealthRuleEngine
            $latest = $points->last();
            $currentHeap = $latest ? $latest['heap_kb'] : null;

            $evaluation = $device ? HealthRuleEngine::evaluateDevice($device, $currentHeap) : [
                'health' => ($currentHeap !== null && $currentHeap < 10.0) ? 'critique' : (($currentHeap !== null && $currentHeap < 20.0) ? 'surveillance' : 'sain'),
                'health_reason' => 'Évaluation basée sur les relevés Heap récents'
            ];

            return response()->json([
                'ok'            => true,
                'device'        => [
                    'serial_number'  => $device?->serial_number ?? $deviceSerial,
                    'label'          => $device?->label ?? $deviceSerial,
                    'firmware'       => $device?->firmware ?? '—',
                    'status'         => $device?->status ?? 'online',
                    'current_health' => $evaluation['health'],
                    'current_heap'   => $currentHeap,
                ],
                'thresholds' => [
                    'sain_min'         => HealthRuleEngine::THRESHOLD_SAIN_MIN,
                    'surveillance_min' => HealthRuleEngine::THRESHOLD_SURVEILLANCE_MIN,
                    'critique_max'     => HealthRuleEngine::THRESHOLD_SURVEILLANCE_MIN,
                ],
                'points' => $points,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'error' => 'HEAP_HISTORY_FETCH_FAILED',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
