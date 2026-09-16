<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Services\FleetSyncService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * DeviceStatusController
 * ────────────────────────────────────────────────────────────────────────────
 * POST /api/ingest/status
 *
 * Reçoit le bloc « Statut » que le module publie déjà vers
 * cloud.spiderhome.org / cloud.supla.org :
 *
 *   guid, firmware, registered_at, last_connected_at, ip, mac,
 *   wifi_rssi, wifi_quality, uptime, connection_uptime, connected
 *
 * Le module peut également joindre `email` et `server` (saisis par le client
 * sur l'interface de configuration 192.168.4.1) : le client et le site sont
 * alors créés automatiquement, exactement comme pour `module_installs`.
 *
 * Authentification : en-tête `X-Ingest-Token` (ou `Authorization: Bearer …`)
 * comparé à SPIDERHOME_INGEST_TOKEN. Si le jeton n'est pas configuré,
 * l'endpoint est refusé — jamais ouvert par défaut.
 *
 * ⚠️  N'écrit jamais dans heap_logs ni module_installs.
 */
class DeviceStatusController extends Controller
{
    public function __invoke(Request $request, FleetSyncService $sync): JsonResponse
    {
        $expected = (string) config('spiderhome.ingest_token', '');

        if ($expected === '' || ! hash_equals($expected, $this->readToken($request))) {
            return response()->json(['ok' => false, 'error' => 'UNAUTHORIZED'], 401);
        }

        $data = $request->validate([
            'device'            => 'required_without:guid|nullable|string|max:128',
            'guid'              => 'required_without:device|nullable|string|max:64',
            'device_name'       => 'nullable|string|max:64',
            'firmware'          => 'nullable|string|max:64',
            'mac'               => 'nullable|string|max:32',
            'ip'                => 'nullable|ip',
            'wifi_rssi'         => 'nullable|integer|between:-120,0',
            'wifi_quality'      => 'nullable|integer|between:0,100',
            'uptime'            => 'nullable|integer|min:0',
            'connection_uptime' => 'nullable|integer|min:0',
            'registered_at'     => 'nullable|date',
            'last_connected_at' => 'nullable|date',
            'connected'         => 'nullable|boolean',
            'email'             => 'nullable|email|max:191',
            'server'            => 'nullable|string|max:128',
        ]);

        $key = trim((string) ($data['device'] ?? ''));

        $device = Device::when($key !== '', fn ($q) => $q->where('legacy_device_key', $key)->orWhere('serial_number', $key))
            ->when(! empty($data['guid']), fn ($q) => $q->orWhere('guid', $data['guid']))
            ->when(! empty($data['mac']), fn ($q) => $q->orWhere('mac', $data['mac']))
            ->first();

        $created = false;

        if (! $device) {
            if ($key === '') {
                return response()->json([
                    'ok'    => false,
                    'error' => 'DEVICE_KEY_REQUIRED',
                    'hint'  => 'Un module inconnu doit fournir « device » pour être créé.',
                ], 422);
            }

            $device = $sync->provisionDevice(
                key: $key,
                deviceName: $data['device_name'] ?? null,
                email: $data['email'] ?? null,
                server: $data['server'] ?? null
            );
            $created = true;
        }

        $device->fill(array_filter([
            'guid'              => $data['guid'] ?? null,
            'firmware'          => $data['firmware'] ?? null,
            'mac'               => $data['mac'] ?? null,
            'ip_address'        => $data['ip'] ?? null,
            'supla_server'      => $data['server'] ?? null,
            'wifi_rssi'         => $data['wifi_rssi'] ?? null,
            'wifi_quality_pct'  => $data['wifi_quality'] ?? null,
            'last_uptime'       => $data['uptime'] ?? null,
            'connection_uptime' => $data['connection_uptime'] ?? null,
            'registered_at'     => isset($data['registered_at']) ? Carbon::parse($data['registered_at']) : null,
            'last_connected_at' => isset($data['last_connected_at']) ? Carbon::parse($data['last_connected_at']) : null,
        ], fn ($v) => $v !== null));

        if (array_key_exists('connected', $data)) {
            $device->supla_connected = (bool) $data['connected'];
        }

        $device->last_seen_at = now();
        if ($device->status !== 'retired' && $device->status !== 'alert') {
            $device->status = 'online';
        }
        $device->save();

        return response()->json([
            'ok'        => true,
            'created'   => $created,
            'device_id' => $device->id,
            'stored_at' => now()->toIso8601String(),
        ], $created ? 201 : 200);
    }

    private function readToken(Request $request): string
    {
        $header = $request->header('X-Ingest-Token');

        if (! $header && $request->header('Authorization')) {
            $header = trim(str_ireplace('Bearer', '', $request->header('Authorization')));
        }

        return trim((string) $header);
    }
}
